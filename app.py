import os
import sqlite3
import threading
import time
import atexit
from datetime import datetime

from flask import Flask, jsonify, render_template, request


# ============================================================
# GPIO
# ============================================================

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    GPIO = None
    print("ADVERTENCIA: RPi.GPIO no disponible.")
    print("Modo simulación de GPIO.")


# ============================================================
# GI / D-BUS
# ============================================================

try:
    import gi

    gi.require_version("Gio", "2.0")
    gi.require_version("GLib", "2.0")

    from gi.repository import Gio, GLib

    GI_AVAILABLE = True

except Exception as e:
    GI_AVAILABLE = False
    Gio = None
    GLib = None

    print("ERROR cargando GI/PyGObject:")
    print(e)


# ============================================================
# CONFIGURACIÓN
# ============================================================

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DATABASE = os.path.join(
    BASE_DIR,
    "locker.db"
)


# ============================================================
# GPIO BCM
# ============================================================

RELAY_PIN = 17

LED_PINS = {
    1: 18,
    2: 23,
    3: 24,
    4: 25
}

BUTTON_PINS = {
    1: 5,
    2: 6,
    3: 13,
    4: 19
}


# ============================================================
# FLASK
# ============================================================

app = Flask(
    __name__,
    template_folder="templates",
    static_folder="static"
)


# ============================================================
# ESTADO GLOBAL
# ============================================================

locker_abierto = False

fingerprint_status = {
    "estado": "inactivo",
    "mensaje": "Lector esperando.",
    "resultado": None,
    "alumno_id": None
}

fingerprint_lock = threading.Lock()


# ============================================================
# BASE DE DATOS
# ============================================================

def conectar_db():

    conexion = sqlite3.connect(
        DATABASE,
        timeout=10
    )

    conexion.row_factory = sqlite3.Row

    return conexion


def inicializar_db():

    conexion = conectar_db()

    cursor = conexion.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS alumnos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero_lista INTEGER UNIQUE,
            nombre TEXT NOT NULL,
            apellido TEXT NOT NULL,
            usuario_huella TEXT,
            compartimento INTEGER,
            presente INTEGER DEFAULT 0,
            llego_tarde INTEGER DEFAULT 0,
            se_retiro INTEGER DEFAULT 0,
            hora_llegada TEXT,
            hora_retiro TEXT,
            trajo_celular INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS profesores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario_huella TEXT UNIQUE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS preceptores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            usuario_huella TEXT UNIQUE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            alumno_id INTEGER,
            tipo TEXT,
            fecha_hora TEXT,
            descripcion TEXT
        )
    """)

    conexion.commit()
    conexion.close()

    print("Base de datos lista.")


# ============================================================
# GPIO
# ============================================================

def configurar_gpio():

    if not GPIO_AVAILABLE:
        return

    GPIO.setmode(GPIO.BCM)

    GPIO.setup(
        RELAY_PIN,
        GPIO.OUT,
        initial=GPIO.LOW
    )

    for pin in LED_PINS.values():

        GPIO.setup(
            pin,
            GPIO.OUT,
            initial=GPIO.LOW
        )

    for pin in BUTTON_PINS.values():

        GPIO.setup(
            pin,
            GPIO.IN,
            pull_up_down=GPIO.PUD_UP
        )

    print("GPIO configurados.")


# ============================================================
# LOCKER
# ============================================================

def abrir_locker(segundos=3):

    global locker_abierto

    locker_abierto = True

    print("Abriendo locker...")

    if GPIO_AVAILABLE:

        GPIO.output(
            RELAY_PIN,
            GPIO.HIGH
        )

    time.sleep(segundos)

    if GPIO_AVAILABLE:

        GPIO.output(
            RELAY_PIN,
            GPIO.LOW
        )

    locker_abierto = False

    print("Locker cerrado.")


# ============================================================
# LED
# ============================================================

def encender_led(
    compartimento,
    segundos=2
):

    pin = LED_PINS.get(
        compartimento
    )

    if pin is None:
        return

    print(
        "Encendiendo LED del compartimento",
        compartimento
    )

    if not GPIO_AVAILABLE:
        return

    GPIO.output(
        pin,
        GPIO.HIGH
    )

    time.sleep(segundos)

    GPIO.output(
        pin,
        GPIO.LOW
    )


# ============================================================
# BOTÓN
# ============================================================

def boton_presionado(
    compartimento
):

    pin = BUTTON_PINS.get(
        compartimento
    )

    if pin is None:
        return False

    if not GPIO_AVAILABLE:
        return False

    return GPIO.input(pin) == GPIO.LOW


# ============================================================
# FINGERPRINT MANAGER
# ============================================================

class FingerprintManager:

    BUS_NAME = "net.reactivated.Fprint"

    MANAGER_PATH = (
        "/net/reactivated/Fprint/Manager"
    )

    MANAGER_INTERFACE = (
        "net.reactivated.Fprint.Manager"
    )

    DEVICE_INTERFACE = (
        "net.reactivated.Fprint.Device"
    )

    def __init__(self):

        self.bus = None
        self.device = None
        self.device_path = None

    # --------------------------------------------------------
    # CONECTAR D-BUS
    # --------------------------------------------------------

    def conectar(self):

        if not GI_AVAILABLE:

            fingerprint_status["estado"] = "error"

            fingerprint_status["mensaje"] = (
                "PyGObject/GI no está disponible."
            )

            return False

        try:

            self.bus = Gio.bus_get_sync(
                Gio.BusType.SYSTEM,
                None
            )

            print(
                "Conectado al D-Bus del sistema."
            )

            return True

        except Exception as e:

            print(
                "Error conectando a D-Bus:",
                e
            )

            fingerprint_status["estado"] = "error"

            fingerprint_status["mensaje"] = (
                str(e)
            )

            return False

    # --------------------------------------------------------
    # OBTENER LECTOR
    # --------------------------------------------------------

    def obtener_dispositivo(self):

        if not self.bus:

            if not self.conectar():
                return False

        try:

            manager = Gio.DBusProxy.new_sync(
                self.bus,
                Gio.DBusProxyFlags.NONE,
                None,
                self.BUS_NAME,
                self.MANAGER_PATH,
                self.MANAGER_INTERFACE,
                None
            )

            resultado = manager.call_sync(
                "GetDefaultDevice",
                None,
                Gio.DBusCallFlags.NONE,
                -1,
                None
            )

            self.device_path = (
                resultado.unpack()[0]
            )

            print(
                "Lector encontrado:",
                self.device_path
            )

            self.device = Gio.DBusProxy.new_sync(
                self.bus,
                Gio.DBusProxyFlags.NONE,
                None,
                self.BUS_NAME,
                self.device_path,
                self.DEVICE_INTERFACE,
                None
            )

            return True

        except Exception as e:

            print(
                "No se pudo obtener el lector:"
            )

            print(e)

            fingerprint_status["estado"] = "error"

            fingerprint_status["mensaje"] = (
                "No se pudo acceder al lector."
            )

            return False

    # --------------------------------------------------------
    # VERIFICAR HUELLA
    # --------------------------------------------------------

    def verificar(self):

        global fingerprint_status

        with fingerprint_lock:

            if not self.obtener_dispositivo():

                return {
                    "ok": False,
                    "resultado": "lector_no_disponible",
                    "mensaje": (
                        "No se pudo acceder al lector."
                    )
                }

            resultado_final = {
                "ok": False,
                "resultado": None,
                "mensaje": ""
            }

            fingerprint_status = {
                "estado": "esperando",
                "mensaje": (
                    "Coloque el dedo en el lector."
                ),
                "resultado": None,
                "alumno_id": None
            }

            loop = GLib.MainLoop()

            # ------------------------------------------------
            # SEÑALES D-BUS
            # ------------------------------------------------

            def recibir_senal(
                proxy,
                sender_name,
                signal_name,
                parameters
            ):

                try:

                    if signal_name == "VerifyStatus":

                        resultado, terminado = (
                            parameters.unpack()
                        )

                        print(
                            "VerifyStatus:",
                            resultado,
                            terminado
                        )

                        fingerprint_status[
                            "resultado"
                        ] = resultado

                        if resultado == "verify-match":

                            resultado_final["ok"] = True

                            resultado_final[
                                "resultado"
                            ] = "verify-match"

                            resultado_final[
                                "mensaje"
                            ] = (
                                "Huella reconocida."
                            )

                            fingerprint_status[
                                "estado"
                            ] = "reconocida"

                            fingerprint_status[
                                "mensaje"
                            ] = (
                                "Huella reconocida."
                            )

                            loop.quit()

                        elif terminado:

                            resultado_final["ok"] = False

                            resultado_final[
                                "resultado"
                            ] = resultado

                            resultado_final[
                                "mensaje"
                            ] = (
                                "La huella no coincide."
                            )

                            fingerprint_status[
                                "estado"
                            ] = "finalizado"

                            fingerprint_status[
                                "mensaje"
                            ] = (
                                "Huella no reconocida."
                            )

                            loop.quit()

                        else:

                            fingerprint_status[
                                "mensaje"
                            ] = self.traducir_estado(
                                resultado
                            )

                    elif signal_name == (
                        "VerifyFingerMatched"
                    ):

                        finger = (
                            parameters.unpack()[0]
                        )

                        print(
                            "Huella encontrada:",
                            finger
                        )

                        fingerprint_status[
                            "resultado"
                        ] = finger

                except Exception as e:

                    print(
                        "Error procesando señal:",
                        e
                    )

                    resultado_final["ok"] = False

                    resultado_final[
                        "resultado"
                    ] = "error"

                    resultado_final[
                        "mensaje"
                    ] = str(e)

                    fingerprint_status[
                        "estado"
                    ] = "error"

                    fingerprint_status[
                        "mensaje"
                    ] = str(e)

                    loop.quit()

            # ------------------------------------------------
            # CONECTAR SEÑALES
            # ------------------------------------------------

            self.device.connect(
                "g-signal",
                recibir_senal
            )

            try:

                print(
                    "Reclamando lector..."
                )

                # Usuario vacío = usuario actual.
                # Es el modo recomendado por fprintd
                # para usuarios normales.

                self.device.call_sync(
                    "Claim",
                    GLib.Variant(
                        "(s)",
                        ("",)
                    ),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

                print(
                    "Lector reclamado."
                )

                self.device.call_sync(
                    "VerifyStart",
                    GLib.Variant(
                        "(s)",
                        ("any",)
                    ),
                    Gio.DBusCallFlags.NONE,
                    -1,
                    None
                )

                print(
                    "Esperando huella..."
                )

                loop.run()

            except Exception as e:

                print(
                    "Error durante la verificación:"
                )

                print(e)

                resultado_final["ok"] = False

                resultado_final[
                    "resultado"
                ] = "error"

                resultado_final[
                    "mensaje"
                ] = str(e)

                fingerprint_status[
                    "estado"
                ] = "error"

                fingerprint_status[
                    "mensaje"
                ] = str(e)

            finally:

                try:

                    self.device.call_sync(
                        "VerifyStop",
                        None,
                        Gio.DBusCallFlags.NONE,
                        -1,
                        None
                    )

                except Exception:
                    pass

                try:

                    self.device.call_sync(
                        "Release",
                        None,
                        Gio.DBusCallFlags.NONE,
                        -1,
                        None
                    )

                except Exception:
                    pass

                fingerprint_status[
                    "estado"
                ] = (
                    "inactivo"
                    if resultado_final["ok"]
                    else fingerprint_status["estado"]
                )

            return resultado_final

    # --------------------------------------------------------
    # TRADUCIR ESTADOS
    # --------------------------------------------------------

    @staticmethod
    def traducir_estado(
        estado
    ):

        mensajes = {

            "verify-retry-scan":
                "No se pudo leer. Intente nuevamente.",

            "verify-finger-not-centered":
                "Coloque el dedo correctamente.",

            "verify-remove-and-retry":
                "Retire el dedo y vuelva a colocarlo.",

            "verify-too-fast":
                "Coloque el dedo nuevamente.",

            "verify-no-match":
                "La huella no coincide.",

            "verify-disconnected":
                "El lector fue desconectado.",

            "verify-unknown-error":
                "Error del lector."
        }

        return mensajes.get(
            estado,
            estado
        )


# ============================================================
# CREAR MANAGER
# ============================================================

fingerprint_manager = (
    FingerprintManager()
)


# ============================================================
# FUNCIONES AUXILIARES
# ============================================================

def obtener_alumno(
    alumno_id
):

    conexion = conectar_db()

    alumno = conexion.execute("""
        SELECT *
        FROM alumnos
        WHERE id = ?
    """, (
        alumno_id,
    )).fetchone()

    conexion.close()

    return alumno


def registrar_evento(
    alumno_id,
    tipo,
    descripcion
):

    ahora = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conexion = conectar_db()

    conexion.execute("""
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
    """, (
        alumno_id,
        tipo,
        ahora,
        descripcion
    ))

    conexion.commit()
    conexion.close()


# ============================================================
# PÁGINA
# ============================================================

@app.route("/")
def inicio():

    return render_template(
        "index.html"
    )


# ============================================================
# ESTADO
# ============================================================

@app.route("/api/estado")
def estado():

    return jsonify({

        "ok": True,

        "locker_abierto":
            locker_abierto,

        "huella":
            fingerprint_status,

        "gpio":
            GPIO_AVAILABLE,

        "lector":
            GI_AVAILABLE

    })


# ============================================================
# LOGIN
# ============================================================

@app.route(
    "/api/login/esperar-huella",
    methods=["POST"]
)
def login_huella():

    resultado = (
        fingerprint_manager.verificar()
    )

    if not resultado["ok"]:

        return jsonify({
            "ok": False,
            "mensaje":
                resultado.get(
                    "mensaje",
                    "Huella no reconocida."
                )
        })

    hilo = threading.Thread(
        target=abrir_locker,
        args=(3,),
        daemon=True
    )

    hilo.start()

    return jsonify({
        "ok": True,
        "mensaje":
            "Huella reconocida. Locker abierto."
    })


# ============================================================
# ALUMNO - ESPERAR HUELLA
# ============================================================

@app.route(
    "/api/alumno/esperar-huella",
    methods=["POST"]
)
def alumno_huella():

    resultado = (
        fingerprint_manager.verificar()
    )

    if not resultado["ok"]:

        return jsonify({
            "ok": False,
            "mensaje":
                resultado.get(
                    "mensaje",
                    "Huella no reconocida."
                )
        })

    # --------------------------------------------------------
    # IMPORTANTE
    #
    # fprintd verifica contra la huella del usuario Linux.
    # Por lo tanto, para identificar alumnos individualmente,
    # necesitamos asociar las huellas/alumnos en una etapa
    # posterior.
    #
    # Por ahora devolvemos el alumno asociado a la huella
    # configurada en la BD.
    # --------------------------------------------------------

    conexion = conectar_db()

    alumno = conexion.execute("""
        SELECT *
        FROM alumnos
        WHERE usuario_huella = ?
        LIMIT 1
    """, (
        os.environ.get(
            "LOCKER_HUELLA_USUARIO",
            os.getenv("USER", "alumno")
        ),
    )).fetchone()

    conexion.close()

    if alumno:

        return jsonify({

            "ok": True,

            "alumno_id":
                alumno["id"],

            "numero_lista":
                alumno["numero_lista"],

            "nombre":
                alumno["nombre"],

            "apellido":
                alumno["apellido"],

            "compartimento":
                alumno["compartimento"]

        })

    return jsonify({

        "ok": True,

        "alumno_id": None,

        "mensaje":
            "Huella reconocida, pero no está asociada a un alumno."

    })


# ============================================================
# LOCKER
# ============================================================

@app.route(
    "/api/locker/abrir",
    methods=["POST"]
)
def api_abrir_locker():

    if locker_abierto:

        return jsonify({
            "ok": False,
            "mensaje":
                "El locker ya está abierto."
        })

    hilo = threading.Thread(
        target=abrir_locker,
        args=(3,),
        daemon=True
    )

    hilo.start()

    return jsonify({
        "ok": True,
        "mensaje":
            "Locker abierto."
    })


# ============================================================
# LED
# ============================================================

@app.route(
    "/api/led/<int:compartimento>",
    methods=["POST"]
)
def api_led(compartimento):

    if compartimento not in LED_PINS:

        return jsonify({
            "ok": False,
            "mensaje":
                "Compartimento inválido."
        }), 400

    hilo = threading.Thread(
        target=encender_led,
        args=(compartimento, 2),
        daemon=True
    )

    hilo.start()

    return jsonify({
        "ok": True,
        "compartimento":
            compartimento
    })


# ============================================================
# BOTÓN
# ============================================================

@app.route(
    "/api/boton/<int:compartimento>"
)
def api_boton(compartimento):

    if compartimento not in BUTTON_PINS:

        return jsonify({
            "ok": False
        }), 400

    return jsonify({

        "ok": True,

        "presionado":
            boton_presionado(
                compartimento
            )
    })


# ============================================================
# ESPERAR BOTÓN CELULAR
# ============================================================

@app.route(
    "/api/celular/esperar-boton",
    methods=["POST"]
)
def esperar_boton_celular():

    datos = (
        request.get_json(
            silent=True
        ) or {}
    )

    compartimento = datos.get(
        "compartimento"
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    if compartimento not in BUTTON_PINS:

        return jsonify({
            "ok": False,
            "mensaje":
                "Compartimento inválido."
        })

    if not alumno_id:

        return jsonify({
            "ok": False,
            "mensaje":
                "Alumno inválido."
        })

    print(
        "Esperando botón del compartimento",
        compartimento
    )

    inicio = time.time()

    timeout = 60

    while time.time() - inicio < timeout:

        if boton_presionado(
            compartimento
        ):

            # Evitar rebote
            time.sleep(0.3)

            hilo = threading.Thread(
                target=encender_led,
                args=(compartimento, 2),
                daemon=True
            )

            hilo.start()

            conexion = conectar_db()

            conexion.execute("""
                UPDATE alumnos
                SET trajo_celular = 1
                WHERE id = ?
            """, (
                alumno_id,
            ))

            conexion.commit()
            conexion.close()

            return jsonify({
                "ok": True,
                "mensaje":
                    "Celular registrado correctamente."
            })

        time.sleep(0.1)

    return jsonify({
        "ok": False,
        "mensaje":
            "Tiempo de espera agotado."
    })


# ============================================================
# ALUMNOS
# ============================================================

@app.route("/api/alumnos")
def api_alumnos():

    conexion = conectar_db()

    alumnos = conexion.execute("""
        SELECT *
        FROM alumnos
        ORDER BY numero_lista
    """).fetchall()

    conexion.close()

    return jsonify({

        "ok": True,

        "alumnos": [
            dict(alumno)
            for alumno in alumnos
        ]

    })


# ============================================================
# ASISTENCIA
# ============================================================

@app.route(
    "/api/asistencia",
    methods=["POST"]
)
def api_asistencia():

    datos = (
        request.get_json(
            silent=True
        ) or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    estado = datos.get(
        "estado",
        "PRESENTE"
    )

    trajo_celular = bool(
        datos.get(
            "trajo_celular",
            False
        )
    )

    alumno = obtener_alumno(
        alumno_id
    )

    if not alumno:

        return jsonify({
            "ok": False,
            "mensaje":
                "Alumno inexistente."
        })

    ahora = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conexion = conectar_db()

    conexion.execute("""
        UPDATE alumnos
        SET presente = 1,
            llego_tarde = 0,
            hora_llegada = ?,
            trajo_celular = ?
        WHERE id = ?
    """, (
        ahora,
        int(trajo_celular),
        alumno_id
    ))

    conexion.execute("""
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
    """, (
        alumno_id,
        estado,
        ahora,
        "Asistencia registrada"
    ))

    conexion.commit()
    conexion.close()

    return jsonify({
        "ok": True,
        "hora": ahora
    })


# ============================================================
# AUSENTE
# ============================================================

@app.route(
    "/api/asistencia/ausente",
    methods=["POST"]
)
def api_ausente():

    datos = (
        request.get_json(
            silent=True
        ) or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    alumno = obtener_alumno(
        alumno_id
    )

    if not alumno:

        return jsonify({
            "ok": False,
            "mensaje":
                "Alumno inexistente."
        })

    ahora = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conexion = conectar_db()

    conexion.execute("""
        UPDATE alumnos
        SET presente = 0
        WHERE id = ?
    """, (
        alumno_id,
    ))

    conexion.execute("""
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
    """, (
        alumno_id,
        "ausente",
        ahora,
        "Alumno ausente"
    ))

    conexion.commit()
    conexion.close()

    return jsonify({
        "ok": True
    })


# ============================================================
# LLEGADA TARDE
# ============================================================

@app.route(
    "/api/llegada",
    methods=["POST"]
)
def api_llegada():

    datos = (
        request.get_json(
            silent=True
        ) or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    trajo_celular = bool(
        datos.get(
            "trajo_celular",
            False
        )
    )

    alumno = obtener_alumno(
        alumno_id
    )

    if not alumno:

        return jsonify({
            "ok": False,
            "mensaje":
                "Alumno inexistente."
        })

    ahora = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conexion = conectar_db()

    conexion.execute("""
        UPDATE alumnos
        SET presente = 1,
            llego_tarde = 1,
            hora_llegada = ?,
            trajo_celular = ?
        WHERE id = ?
    """, (
        ahora,
        int(trajo_celular),
        alumno_id
    ))

    conexion.execute("""
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
    """, (
        alumno_id,
        "llegada_tarde",
        ahora,
        "Llegada tarde registrada"
    ))

    conexion.commit()
    conexion.close()

    return jsonify({
        "ok": True,
        "hora": ahora
    })


# ============================================================
# RETIRO
# ============================================================

@app.route(
    "/api/retiro",
    methods=["POST"]
)
def api_retiro():

    datos = (
        request.get_json(
            silent=True
        ) or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    retiro_celular = bool(
        datos.get(
            "retiro_celular",
            False
        )
    )

    compartimento = datos.get(
        "compartimento"
    )

    alumno = obtener_alumno(
        alumno_id
    )

    if not alumno:

        return jsonify({
            "ok": False,
            "mensaje":
                "Alumno inexistente."
        })

    ahora = datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )

    conexion = conectar_db()

    conexion.execute("""
        UPDATE alumnos
        SET se_retiro = 1,
            hora_retiro = ?
        WHERE id = ?
    """, (
        ahora,
        alumno_id
    ))

    conexion.execute("""
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
    """, (
        alumno_id,
        "retiro",
        ahora,
        (
            "Retiro con celular"
            if retiro_celular
            else "Retiro sin celular"
        )
    ))

    conexion.commit()
    conexion.close()

    # Si retira el celular, encendemos el LED
    if retiro_celular and compartimento:

        hilo = threading.Thread(
            target=encender_led,
            args=(int(compartimento), 2),
            daemon=True
        )

        hilo.start()

    return jsonify({
        "ok": True,
        "hora": ahora
    })


# ============================================================
# FINALIZAR HORA
# ============================================================

@app.route(
    "/api/finalizar",
    methods=["POST"]
)
def api_finalizar():

    print(
        "Finalizando hora."
    )

    return jsonify({
        "ok": True
    })


# ============================================================
# LIMPIEZA
# ============================================================

def limpiar():

    if GPIO_AVAILABLE:

        try:
            GPIO.output(
                RELAY_PIN,
                GPIO.LOW
            )
        except Exception:
            pass

        GPIO.cleanup()

    print(
        "GPIO liberados."
    )


atexit.register(
    limpiar
)


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("=" * 60)
    print("SISTEMA DE LOCKER")
    print("RASPBERRY PI")
    print("=" * 60)

    inicializar_db()

    configurar_gpio()

    # --------------------------------------------------------
    # Detectar lector
    # --------------------------------------------------------

    if GI_AVAILABLE:

        print(
            "PyGObject disponible."
        )

        if fingerprint_manager.obtener_dispositivo():

            print(
                "DigitalPersona detectado correctamente."
            )

        else:

            print(
                "ADVERTENCIA: no se pudo obtener el lector."
            )

    else:

        print(
            "ADVERTENCIA: GI/PyGObject no disponible."
        )

    print()
    print(
        "Servidor iniciado."
    )
    print(
        "Puerto: 5000"
    )
    print(
        "Acceso: http://IP-DE-LA-RASPBERRY:5000"
    )
    print("=" * 60)

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        threaded=True
    )