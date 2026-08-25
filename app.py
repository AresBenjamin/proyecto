# ============================================================
# SISTEMA DE LOCKER
# RASPBERRY PI 3
#
# Flask + SQLite + GPIO + fprintd/D-Bus
#
# DigitalPersona U.are.U 4000/4000B/4500
# ============================================================

import os
import sqlite3
import threading
import time
from datetime import datetime

from flask import Flask, jsonify, render_template, request


# ============================================================
# CONFIGURACIÓN
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

DATABASE = os.path.join(
    BASE_DIR,
    "locker.db"
)

HOST = "0.0.0.0"
PORT = 5000


# ============================================================
# GPIO
# ============================================================

try:
    import RPi.GPIO as GPIO

    GPIO_AVAILABLE = True

except ImportError:

    GPIO_AVAILABLE = False

    print(
        "ADVERTENCIA: RPi.GPIO no está disponible."
    )

    print(
        "El sistema funcionará en modo simulación."
    )


# ============================================================
# GI / D-BUS
# ============================================================

try:

    import gi

    gi.require_version(
        "Gio",
        "2.0"
    )

    gi.require_version(
        "GLib",
        "2.0"
    )

    from gi.repository import Gio, GLib

    GI_AVAILABLE = True

except Exception as error:

    GI_AVAILABLE = False

    print(
        "ERROR cargando GI/PyGObject:",
        error
    )


# ============================================================
# PINES
# ============================================================

# ------------------------------------------------------------
# RELÉ
# ------------------------------------------------------------

RELAY_PIN = 17

# Cambiar a False si tu módulo de relé funciona
# con lógica activa en LOW.
RELAY_ACTIVE_HIGH = True

RELAY_OPEN_SECONDS = 3


# ------------------------------------------------------------
# LEDs
# ------------------------------------------------------------

LED_PINS = {

    1: 18,

    2: 23,

    3: 24,

    4: 25

}


# ------------------------------------------------------------
# BOTONES
# ------------------------------------------------------------

BUTTON_PINS = {

    1: 5,

    2: 6,

    3: 13,

    4: 19

}


# ============================================================
# HUELLAS
# ============================================================

# Usuario Linux que tiene registrada la huella
# del profesor/preceptor.
#
# En tu Raspberry ya tenés el usuario "alumno".
PROFESOR_USUARIO = "alumno"


# Usuarios Linux de los alumnos.
#
# Ya los registraste:
#
# locker_alumno_1
# locker_alumno_2
# locker_alumno_3
# locker_alumno_4

HUELLA_ALUMNOS = {

    1: "locker_alumno_1",

    2: "locker_alumno_2",

    3: "locker_alumno_3",

    4: "locker_alumno_4"

}


# ============================================================
# ALUMNOS INICIALES
# ============================================================

ALUMNOS_INICIALES = [

    {
        "numero_lista": 1,
        "nombre": "Alumno",
        "apellido": "1",
        "usuario_huella": "locker_alumno_1",
        "compartimento": 1
    },

    {
        "numero_lista": 2,
        "nombre": "Alumno",
        "apellido": "2",
        "usuario_huella": "locker_alumno_2",
        "compartimento": 2
    },

    {
        "numero_lista": 3,
        "nombre": "Alumno",
        "apellido": "3",
        "usuario_huella": "locker_alumno_3",
        "compartimento": 3
    },

    {
        "numero_lista": 4,
        "nombre": "Alumno",
        "apellido": "4",
        "usuario_huella": "locker_alumno_4",
        "compartimento": 4
    }

]


# ============================================================
# FLASK
# ============================================================

app = Flask(

    __name__,

    template_folder=BASE_DIR,

    static_folder=os.path.join(BASE_DIR, "static")

)


# ============================================================
# VARIABLES GLOBALES
# ============================================================

locker_abierto = False

sistema_finalizado = False


fingerprint_status = {

    "estado": "inactivo",

    "mensaje": "Lector esperando",

    "resultado": None,

    "usuario": None

}


# Solo una lectura de huella simultánea.

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


# ============================================================
# HORA ACTUAL
# ============================================================

def ahora():

    return datetime.now().strftime(
        "%Y-%m-%d %H:%M:%S"
    )


# ============================================================
# INICIALIZAR BASE DE DATOS
# ============================================================

def inicializar_db():

    conexion = conectar_db()

    cursor = conexion.cursor()

    # --------------------------------------------------------
    # TABLA ALUMNOS
    # --------------------------------------------------------

    cursor.execute(
        """
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
        """
    )

    # --------------------------------------------------------
    # TABLA PROFESORES
    # --------------------------------------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS profesores (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            nombre TEXT NOT NULL,

            usuario_huella TEXT UNIQUE

        )
        """
    )

    # --------------------------------------------------------
    # TABLA PRECEPTORES
    # --------------------------------------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS preceptores (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            nombre TEXT NOT NULL,

            usuario_huella TEXT UNIQUE

        )
        """
    )

    # --------------------------------------------------------
    # TABLA EVENTOS
    # --------------------------------------------------------

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS eventos (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            alumno_id INTEGER,

            tipo TEXT,

            fecha_hora TEXT,

            descripcion TEXT

        )
        """
    )

    # --------------------------------------------------------
    # MIGRACIÓN
    # --------------------------------------------------------

    cursor.execute(
        "PRAGMA table_info(alumnos)"
    )

    columnas_existentes = {

        fila["name"]

        for fila in cursor.fetchall()

    }

    columnas_necesarias = [

        ("apellido", "TEXT"),

        ("usuario_huella", "TEXT"),

        ("compartimento", "INTEGER"),

        ("presente", "INTEGER DEFAULT 0"),

        ("llego_tarde", "INTEGER DEFAULT 0"),

        ("se_retiro", "INTEGER DEFAULT 0"),

        ("hora_llegada", "TEXT"),

        ("hora_retiro", "TEXT"),

        ("trajo_celular", "INTEGER DEFAULT 0")

    ]

    for nombre_columna, tipo in columnas_necesarias:

        if nombre_columna not in columnas_existentes:

            print(
                "Agregando columna:",
                nombre_columna
            )

            cursor.execute(
                f"""
                ALTER TABLE alumnos
                ADD COLUMN {nombre_columna} {tipo}
                """
            )

    # --------------------------------------------------------
    # CREAR ALUMNOS SI NO EXISTEN
    # --------------------------------------------------------

    cantidad = cursor.execute(
        """
        SELECT COUNT(*)
        FROM alumnos
        """
    ).fetchone()[0]

    if cantidad == 0:

        print(
            "No había alumnos. Creando alumnos iniciales."
        )

        for alumno in ALUMNOS_INICIALES:

            cursor.execute(
                """
                INSERT INTO alumnos (
                    numero_lista,
                    nombre,
                    apellido,
                    usuario_huella,
                    compartimento
                )
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    alumno["numero_lista"],
                    alumno["nombre"],
                    alumno["apellido"],
                    alumno["usuario_huella"],
                    alumno["compartimento"]
                )
            )

    else:

        # ----------------------------------------------------
        # Completar datos de alumnos existentes
        # ----------------------------------------------------

        for alumno in ALUMNOS_INICIALES:

            existente = cursor.execute(
                """
                SELECT id
                FROM alumnos
                WHERE numero_lista = ?
                """,
                (
                    alumno["numero_lista"],
                )
            ).fetchone()

            if existente:

                cursor.execute(
                    """
                    UPDATE alumnos
                    SET
                        usuario_huella = ?,
                        compartimento = ?
                    WHERE numero_lista = ?
                    """,
                    (
                        alumno["usuario_huella"],
                        alumno["compartimento"],
                        alumno["numero_lista"]
                    )
                )

    # --------------------------------------------------------
    # PROFESOR
    # --------------------------------------------------------

    profesor = cursor.execute(
        """
        SELECT id
        FROM profesores
        WHERE usuario_huella = ?
        """,
        (
            PROFESOR_USUARIO,
        )
    ).fetchone()

    if profesor is None:

        cursor.execute(
            """
            INSERT INTO profesores (
                nombre,
                usuario_huella
            )
            VALUES (?, ?)
            """,
            (
                "Profesor",
                PROFESOR_USUARIO
            )
        )

    conexion.commit()

    conexion.close()

    print(
        "Base de datos lista."
    )


# ============================================================
# GPIO - CONFIGURAR
# ============================================================

def configurar_gpio():

    if not GPIO_AVAILABLE:

        return

    GPIO.setmode(
        GPIO.BCM
    )

    # --------------------------------------------------------
    # RELÉ
    # --------------------------------------------------------

    estado_inactivo = (
        GPIO.LOW
        if RELAY_ACTIVE_HIGH
        else GPIO.HIGH
    )

    GPIO.setup(
        RELAY_PIN,
        GPIO.OUT,
        initial=estado_inactivo
    )

    # --------------------------------------------------------
    # LEDs
    # --------------------------------------------------------

    for pin in LED_PINS.values():

        GPIO.setup(
            pin,
            GPIO.OUT,
            initial=GPIO.LOW
        )

    # --------------------------------------------------------
    # BOTONES
    # --------------------------------------------------------

    for pin in BUTTON_PINS.values():

        GPIO.setup(
            pin,
            GPIO.IN,
            pull_up_down=GPIO.PUD_UP
        )

    print(
        "GPIO configurados."
    )


# ============================================================
# GPIO - RELÉ
# ============================================================

def abrir_locker(segundos=None):

    global locker_abierto

    if segundos is None:

        segundos = RELAY_OPEN_SECONDS

    locker_abierto = True

    print(
        "ABRIENDO LOCKER"
    )

    try:

        if GPIO_AVAILABLE:

            if RELAY_ACTIVE_HIGH:

                GPIO.output(
                    RELAY_PIN,
                    GPIO.HIGH
                )

            else:

                GPIO.output(
                    RELAY_PIN,
                    GPIO.LOW
                )

        time.sleep(
            segundos
        )

    finally:

        if GPIO_AVAILABLE:

            if RELAY_ACTIVE_HIGH:

                GPIO.output(
                    RELAY_PIN,
                    GPIO.LOW
                )

            else:

                GPIO.output(
                    RELAY_PIN,
                    GPIO.HIGH
                )

        locker_abierto = False

        print(
            "LOCKER CERRADO"
        )


# ============================================================
# GPIO - LED
# ============================================================

def encender_led(
    compartimento,
    segundos=2
):

    pin = LED_PINS.get(
        compartimento
    )

    if pin is None:

        return False

    print(
        f"LED compartimento {compartimento}"
    )

    if not GPIO_AVAILABLE:

        return True

    GPIO.output(
        pin,
        GPIO.HIGH
    )

    try:

        time.sleep(
            segundos
        )

    finally:

        GPIO.output(
            pin,
            GPIO.LOW
        )

    return True


# ============================================================
# GPIO - BOTÓN
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

    return (
        GPIO.input(pin)
        == GPIO.LOW
    )


# ============================================================
# ESPERAR BOTÓN
# ============================================================

# ============================================================
# ESPERAR BOTÓN
# ============================================================

def esperar_boton(
    compartimento,
    timeout=120
):

    pin = BUTTON_PINS.get(
        compartimento
    )

    if pin is None:
        return False

    print(
        f"Esperando botón del compartimento "
        f"{compartimento}"
    )

    # --------------------------------------------------------
    # SIMULACIÓN
    # --------------------------------------------------------

    if not GPIO_AVAILABLE:

        print(
            "GPIO no disponible: "
            "simulación de botón."
        )

        time.sleep(1)

        return True

    inicio = time.time()

    # --------------------------------------------------------
    # Primero esperamos que el botón esté LIBRE.
    #
    # Esto evita tomar como válida una pulsación anterior.
    #
    # PUD_UP:
    #     HIGH = libre
    #     LOW  = presionado
    # --------------------------------------------------------

    while GPIO.input(pin) == GPIO.LOW:

        if time.time() - inicio > timeout:

            print(
                "Tiempo agotado esperando "
                "que el botón quede libre."
            )

            return False

        time.sleep(0.05)


    # --------------------------------------------------------
    # Ahora esperamos que el alumno PRESIONE el botón.
    # --------------------------------------------------------

    while time.time() - inicio < timeout:

        if GPIO.input(pin) == GPIO.LOW:

            # Antirrebote
            time.sleep(0.08)

            if GPIO.input(pin) == GPIO.LOW:

                print(
                    "Botón presionado."
                )

                # IMPORTANTE:
                #
                # NO esperamos a que el botón se libere.
                #
                # El estado PRESIONADO queda como confirmación
                # de que el celular fue colocado.
                #
                # Más adelante, durante la devolución,
                # esperar_liberacion() detectará cuando el alumno
                # saque el celular y el botón pase a HIGH.

                return True

        time.sleep(0.05)


    print(
        "Tiempo agotado esperando botón."
    )

    return False

# ============================================================
# ESPERAR LIBERACION DEL BOTON
# ============================================================
# Durante el guardado del celular, el boton pasa de libre a
# presionado. Al finalizar la hora, el alumno retira el celular
# y el boton vuelve a quedar libre.
#
# Con PUD_UP:
#     LOW  = presionado
#     HIGH = libre
# ============================================================

def esperar_liberacion(
    compartimento,
    timeout=120
):

    pin = BUTTON_PINS.get(
        compartimento
    )

    if pin is None:
        return False

    print(
        f"Esperando retiro del celular del compartimento {compartimento}"
    )

    if not GPIO_AVAILABLE:
        print(
            "GPIO no disponible: simulacion de retiro."
        )
        time.sleep(1)
        return True

    inicio = time.time()

    # --------------------------------------------------------
    # Primero esperamos a que el boton quede confirmado como
    # presionado. Esto evita aceptar accidentalmente un boton
    # que ya estaba libre antes de comenzar la devolucion.
    # --------------------------------------------------------

    while time.time() - inicio < 5:
        if GPIO.input(pin) == GPIO.LOW:
            break
        time.sleep(0.05)
    else:
        print(
            "No se detecto el boton presionado antes del retiro."
        )
        return False

    # --------------------------------------------------------
    # Ahora esperamos que el alumno retire el celular y el
    # boton pase de LOW a HIGH.
    # --------------------------------------------------------

    while time.time() - inicio < timeout:

        if GPIO.input(pin) == GPIO.HIGH:

            time.sleep(0.10)

            if GPIO.input(pin) == GPIO.HIGH:

                print(
                    "Boton liberado. Celular retirado."
                )
                return True

        time.sleep(0.05)

    print(
        "Tiempo agotado esperando la liberacion del boton."
    )
    return False


# ============================================================
# FINGERPRINT MANAGER
# ============================================================

class FingerprintManager:

    BUS_NAME = (
        "net.reactivated.Fprint"
    )

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

            return True

        except Exception as error:

            print(
                "Error conectando D-Bus:",
                error
            )

            fingerprint_status["estado"] = "error"

            fingerprint_status["mensaje"] = (
                str(error)
            )

            return False

    # --------------------------------------------------------
    # OBTENER DISPOSITIVO
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
                "Dispositivo de huella:",
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

        except Exception as error:

            print(
                "Error obteniendo lector:",
                error
            )

            self.device = None

            fingerprint_status["estado"] = "error"

            fingerprint_status["mensaje"] = (
                "No se pudo acceder al lector: "
                + str(error)
            )

            return False


    # ============================================================
    # VERIFICAR UN USUARIO
    # ============================================================

        # --------------------------------------------------------
    # VERIFICAR UN USUARIO
    # --------------------------------------------------------

    def verificar_usuario(
        self,
        usuario,
        mensaje=None
    ):

        with fingerprint_lock:

            if not self.obtener_dispositivo():

                return {
                    "ok": False,
                    "resultado":
                        "lector_no_disponible",
                    "usuario":
                        usuario
                }


            if mensaje is None:

                mensaje = (
                    "Coloque el dedo en el lector."
                )


            fingerprint_status[
                "estado"
            ] = "esperando"


            fingerprint_status[
                "mensaje"
            ] = mensaje


            fingerprint_status[
                "resultado"
            ] = None


            fingerprint_status[
                "usuario"
            ] = usuario


            # ----------------------------------------------------
            # Resultado final
            # ----------------------------------------------------

            resultado_final = {

                "ok":
                    False,

                "resultado":
                    None,

                "usuario":
                    usuario

            }


            # ----------------------------------------------------
            # CONTADOR DE INTENTOS DE ESTA LECTURA
            # ----------------------------------------------------

            MAX_INTENTOS = 3

            intentos = {

                "cantidad":
                    0

            }


            # ----------------------------------------------------
            # LOOP GLIB
            # ----------------------------------------------------

            loop = GLib.MainLoop()


            terminado = {

                "valor":
                    False

            }


            # ====================================================
            # SEÑALES DEL LECTOR
            # ====================================================

            def signal_handler(
                proxy,
                sender_name,
                signal_name,
                parameters
            ):

                # ------------------------------------------------
                # Obtener valores de la señal
                # ------------------------------------------------

                try:

                    valores = parameters.unpack()

                except Exception as error:

                    print(
                        "Error leyendo señal:",
                        error
                    )

                    return


                # =================================================
                # ESTADO DE VERIFICACIÓN
                # =================================================

                if signal_name == "VerifyStatus":

                    if len(valores) < 2:

                        return


                    estado = valores[0]


                    done = valores[1]


                    print(
                        "VerifyStatus:",
                        estado,
                        done
                    )


                    fingerprint_status[
                        "mensaje"
                    ] = estado


                    # =================================================
                    # HUELLA CORRECTA
                    # =================================================

                    if estado == "verify-match":

                        print(
                            "✓ Huella reconocida."
                        )


                        resultado_final[
                            "ok"
                        ] = True


                        resultado_final[
                            "resultado"
                        ] = "verify-match"


                        fingerprint_status[
                            "estado"
                        ] = "reconocida"


                        fingerprint_status[
                            "resultado"
                        ] = "verify-match"


                        fingerprint_status[
                            "mensaje"
                        ] = (
                            "Huella reconocida."
                        )


                        terminado[
                            "valor"
                        ] = True


                        try:

                            loop.quit()

                        except Exception:

                            pass


                        return


                    # =================================================
                    # HUELLA INCORRECTA
                    # =================================================
                    #
                    # MUY IMPORTANTE:
                    #
                    # NO hacemos VerifyStart() nuevamente acá.
                    #
                    # Terminamos esta lectura inmediatamente.
                    # JavaScript recibirá el error y mostrará
                    # REINTENTAR HUELLA.
                    #
                    # =================================================

                    if estado == "verify-no-match":

                        intentos[
                            "cantidad"
                        ] += 1


                        print(
                            "Huella no reconocida."
                        )


                        print(
                            f"Intento "
                            f"{intentos['cantidad']}/"
                            f"{MAX_INTENTOS}"
                        )


                        resultado_final[
                            "ok"
                        ] = False


                        resultado_final[
                            "resultado"
                        ] = "no-match"


                        fingerprint_status[
                            "estado"
                        ] = "finalizado"


                        if intentos[
                            "cantidad"
                        ] < MAX_INTENTOS:

                            fingerprint_status[
                                "mensaje"
                            ] = (

                                "Huella incorrecta. "

                                f"Intento "
                                f"{intentos['cantidad']} de "
                                f"{MAX_INTENTOS}. "

                                "Presione REINTENTAR HUELLA."

                            )

                        else:

                            fingerprint_status[
                                "mensaje"
                            ] = (

                                "Huella incorrecta. "

                                "Presione REINTENTAR HUELLA "
                                "para volver a intentar."

                            )


                        terminado[
                            "valor"
                        ] = True


                        try:

                            loop.quit()

                        except Exception:

                            pass


                        return


                    # =================================================
                    # ESCANEO INCORRECTO / DEDO MAL COLOCADO
                    # =================================================

                    if estado in (

                        "verify-retry-scan",

                        "verify-finger-not-centered",

                        "verify-remove-and-retry"

                    ):

                        fingerprint_status[
                            "estado"
                        ] = "reintento"


                        if estado == (
                            "verify-finger-not-centered"
                        ):

                            fingerprint_status[
                                "mensaje"
                            ] = (

                                "Coloque el dedo "
                                "correctamente en el centro "
                                "del lector."

                            )


                        elif estado == (
                            "verify-remove-and-retry"
                        ):

                            fingerprint_status[
                                "mensaje"
                            ] = (

                                "Retire el dedo y vuelva "
                                "a colocarlo."

                            )


                        else:

                            fingerprint_status[
                                "mensaje"
                            ] = (

                                "No se pudo leer "
                                "correctamente. "
                                "Vuelva a colocar el dedo."

                            )


                        # --------------------------------------------
                        # En estos casos fprintd todavía puede
                        # continuar con la misma lectura.
                        # --------------------------------------------

                        return


                    # =================================================
                    # LECTOR DESCONECTADO
                    # =================================================

                    if estado == "verify-disconnected":

                        resultado_final[
                            "ok"
                        ] = False


                        resultado_final[
                            "resultado"
                        ] = (
                            "verify-disconnected"
                        )


                        fingerprint_status[
                            "estado"
                        ] = "error"


                        fingerprint_status[
                            "mensaje"
                        ] = (
                            "El lector se desconectó."
                        )


                        terminado[
                            "valor"
                        ] = True


                        try:

                            loop.quit()

                        except Exception:

                            pass


                        return


                    # =================================================
                    # ERROR DESCONOCIDO
                    # =================================================

                    if estado == "verify-unknown-error":

                        resultado_final[
                            "ok"
                        ] = False


                        resultado_final[
                            "resultado"
                        ] = (
                            "verify-unknown-error"
                        )


                        fingerprint_status[
                            "estado"
                        ] = "error"


                        fingerprint_status[
                            "mensaje"
                        ] = (
                            "Ocurrió un error "
                            "en el lector."
                        )


                        terminado[
                            "valor"
                        ] = True


                        try:

                            loop.quit()

                        except Exception:

                            pass


                        return


                # =================================================
                # DEDO SELECCIONADO
                # =================================================

                elif (
                    signal_name ==
                    "VerifyFingerSelected"
                ):

                    try:

                        dedo = valores[0]


                        print(
                            "Dedo seleccionado:",
                            dedo
                        )

                    except Exception:

                        pass


            # ========================================================
            # CONECTAR SEÑAL
            # ========================================================

            signal_id = None


            try:

                signal_id = self.device.connect(
                        "g-signal",
                        signal_handler
                    )


                # ----------------------------------------------------
                # RECLAMAR LECTOR
                # ----------------------------------------------------

                print(
                    "Reclamando lector para:",
                    usuario
                )


                self.device.call_sync(

                    "Claim",

                    GLib.Variant(
                        "(s)",
                        (usuario,)
                    ),

                    Gio.DBusCallFlags.NONE,

                    -1,

                    None

                )


                print(
                    "Lector reclamado."
                )


                # ----------------------------------------------------
                # INICIAR VERIFICACIÓN
                # ----------------------------------------------------

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


                # ----------------------------------------------------
                # TIMEOUT
                #
                # Este timeout solamente actúa si nadie coloca
                # el dedo.
                #
                # Una huella incorrecta NO espera este timeout:
                # VerifyStatus -> verify-no-match -> loop.quit()
                # ----------------------------------------------------

                def timeout():

                    if not terminado[
                        "valor"
                    ]:

                        print(
                            "Tiempo agotado "
                            "esperando huella."
                        )


                        resultado_final[
                            "ok"
                        ] = False


                        resultado_final[
                            "resultado"
                        ] = "timeout"


                        fingerprint_status[
                            "estado"
                        ] = "timeout"


                        fingerprint_status[
                            "mensaje"
                        ] = (
                            "Tiempo agotado. "
                            "Presione REINTENTAR HUELLA."
                        )


                        terminado[
                            "valor"
                        ] = True


                        try:

                            loop.quit()

                        except Exception:

                            pass


                    return False


                GLib.timeout_add(

                    30000,

                    timeout

                )


                # ----------------------------------------------------
                # ESPERAR EVENTOS
                # ----------------------------------------------------

                loop.run()


            except Exception as error:

                print(
                    "Error durante "
                    "verificación:",
                    error
                )


                resultado_final[
                    "ok"
                ] = False


                resultado_final[
                    "resultado"
                ] = str(error)


                fingerprint_status[
                    "estado"
                ] = "error"


                fingerprint_status[
                    "mensaje"
                ] = str(error)


            finally:

                # ----------------------------------------------------
                # DETENER VERIFICACIÓN
                # ----------------------------------------------------

                try:

                    self.device.call_sync(

                        "VerifyStop",

                        None,

                        Gio.DBusCallFlags.NONE,

                        -1,

                        None

                    )

                except Exception as error:

                    print(
                        "Aviso VerifyStop:",
                        error
                    )


                # ----------------------------------------------------
                # LIBERAR LECTOR
                # ----------------------------------------------------

                try:

                    self.device.call_sync(

                        "Release",

                        None,

                        Gio.DBusCallFlags.NONE,

                        -1,

                        None

                    )

                except Exception as error:

                    print(
                        "Aviso Release:",
                        error
                    )


                # ----------------------------------------------------
                # DESCONECTAR SEÑAL
                # ----------------------------------------------------

                if signal_id is not None:

                    try:

                        self.device.disconnect(
                            signal_id
                        )

                    except Exception:

                        pass


            # --------------------------------------------------------
            # DEVOLVER SIEMPRE UN DICCIONARIO
            # --------------------------------------------------------

            return resultado_final

    # --------------------------------------------------------
    # IDENTIFICAR ALUMNO
    # --------------------------------------------------------

    def identificar_alumno(self):

        alumnos = obtener_alumnos()

        if not alumnos:

            return {
                "ok": False,
                "resultado": "sin_alumnos"
            }

        # ----------------------------------------------------
        # IMPORTANTE
        #
        # fprintd verifica contra un usuario específico.
        #
        # Por eso probamos cada usuario registrado.
        # ----------------------------------------------------

        for alumno in alumnos:

            usuario = alumno[
                "usuario_huella"
            ]

            if not usuario:

                continue

            resultado = self.verificar_usuario(

                usuario,

                "Coloque la huella del alumno."

            )

            if resultado["ok"]:

                alumno_dict = dict(
                    alumno
                )

                alumno_dict[
                    "alumno_id"
                ] = alumno_dict["id"]

                alumno_dict[
                    "resultado"
                ] = "verify-match"

                return {
                    "ok": True,
                    "alumno": alumno_dict
                }

            # ------------------------------------------------
            # Si hubo un error real, no continuar
            # ------------------------------------------------

            if resultado["resultado"] in (

                "lector_no_disponible",

                "timeout"

            ):

                return {
                    "ok": False,
                    "resultado":
                        resultado["resultado"],
                    "mensaje":
                        fingerprint_status[
                            "mensaje"
                        ]
                }

        return {
            "ok": False,
            "resultado": "no-match",
            "mensaje":
                "La huella no corresponde a ningún alumno."
        }


# ============================================================
# CREAR MANAGER
# ============================================================

fingerprint_manager = (
    FingerprintManager()
)


# ============================================================
# FUNCIONES DE ALUMNOS
# ============================================================

def obtener_alumnos():

    conexion = conectar_db()

    filas = conexion.execute(
        """
        SELECT *
        FROM alumnos
        ORDER BY numero_lista
        """
    ).fetchall()

    conexion.close()

    return filas


def obtener_alumno(alumno_id):

    conexion = conectar_db()

    alumno = conexion.execute(
        """
        SELECT *
        FROM alumnos
        WHERE id = ?
        """,
        (
            alumno_id,
        )
    ).fetchone()

    conexion.close()

    return alumno


# ============================================================
# REGISTRAR EVENTO
# ============================================================

def registrar_evento(
    alumno_id,
    tipo,
    descripcion
):

    fecha = ahora()

    conexion = conectar_db()

    conexion.execute(
        """
        INSERT INTO eventos (
            alumno_id,
            tipo,
            fecha_hora,
            descripcion
        )
        VALUES (?, ?, ?, ?)
        """,
        (
            alumno_id,
            tipo,
            fecha,
            descripcion
        )
    )

    conexion.commit()

    conexion.close()


# ============================================================
# PÁGINAS
# ============================================================

@app.route("/")
def inicio():

    return render_template(
        "index.html"
    )


# ============================================================
# API ESTADO
# ============================================================

@app.route(
    "/api/estado"
)
def api_estado():

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
# API ALUMNOS
# ============================================================

@app.route(
    "/api/alumnos"
)
def api_alumnos():

    alumnos = obtener_alumnos()

    return jsonify({

        "ok": True,

        "alumnos": [
            dict(alumno)
            for alumno in alumnos
        ]

    })


# ============================================================
# USUARIOS AUTORIZADOS
# ============================================================

def obtener_usuarios_personal():

    conexion = conectar_db()

    profesores = conexion.execute(
        "SELECT nombre, usuario_huella, 'profesor' AS tipo FROM profesores WHERE usuario_huella IS NOT NULL AND usuario_huella != ''"
    ).fetchall()

    preceptores = conexion.execute(
        "SELECT nombre, usuario_huella, 'preceptor' AS tipo FROM preceptores WHERE usuario_huella IS NOT NULL AND usuario_huella != ''"
    ).fetchall()

    conexion.close()

    usuarios = []

    for fila in profesores + preceptores:
        usuarios.append(dict(fila))

    # Mantener también el usuario configurado como profesor aunque
    # todavía no exista en la tabla por una base antigua.
    if PROFESOR_USUARIO:
        existe = any(
            usuario["usuario_huella"] == PROFESOR_USUARIO
            for usuario in usuarios
        )

        if not existe:
            usuarios.insert(
                0,
                {
                    "nombre": "Profesor",
                    "usuario_huella": PROFESOR_USUARIO,
                    "tipo": "profesor"
                }
            )

    return usuarios


def identificar_personal():

    usuarios = obtener_usuarios_personal()

    if not usuarios:
        return {
            "ok": False,
            "resultado": "sin_usuarios",
            "mensaje": "No hay profesores o preceptores autorizados."
        }

    for usuario in usuarios:

        resultado = fingerprint_manager.verificar_usuario(
            usuario["usuario_huella"],
            "Coloque la huella del profesor o preceptor."
        )

        if resultado["ok"]:
            return {
                "ok": True,
                "usuario": usuario["usuario_huella"],
                "nombre": usuario["nombre"],
                "tipo": usuario["tipo"]
            }

        if resultado.get("resultado") in (
            "lector_no_disponible",
            "timeout"
        ):
            return {
                "ok": False,
                "resultado": resultado["resultado"],
                "mensaje": fingerprint_status.get(
                    "mensaje",
                    "No se pudo utilizar el lector."
                )
            }

    return {
        "ok": False,
        "resultado": "no-match",
        "mensaje": "La huella no corresponde a un profesor o preceptor autorizado."
    }


# ============================================================
# API LOGIN
# ============================================================

@app.route(
    "/api/login/esperar-huella",
    methods=["POST"]
)
def api_login():

    global sistema_finalizado

    resultado = identificar_personal()

    if resultado["ok"]:

        sistema_finalizado = False

        return jsonify({

            "ok": True,

            "mensaje":
                "Identificación autorizada.",

            "usuario":
                resultado["usuario"],

            "nombre":
                resultado["nombre"],

            "rol":
                resultado["tipo"]

        })

    return jsonify({

        "ok": False,

        "mensaje":
            resultado.get(
                "mensaje",
                "La huella no corresponde a un usuario autorizado."
            ),

        "resultado":
            resultado.get(
                "resultado"
            )

    })


# ============================================================
# API HUELLA - IDENTIFICAR ALUMNO
# ============================================================

@app.route(
    "/api/alumno/esperar-huella",
    methods=["POST"]
)
def api_alumno_huella():

    resultado = (
        fingerprint_manager.identificar_alumno()
    )

    if not resultado["ok"]:

        return jsonify({

            "ok": False,

            "mensaje":
                resultado.get(
                    "mensaje",
                    "No se pudo identificar al alumno."
                ),

            "resultado":
                resultado.get(
                    "resultado"
                )

        })

    alumno = resultado["alumno"]

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
            alumno["compartimento"],

        "usuario_huella":
            alumno["usuario_huella"]

    })


# ============================================================
# API HUELLA - VERIFICAR ALUMNO ESPECÍFICO
# ============================================================

@app.route(
    "/api/alumno/<int:alumno_id>/verificar-huella",
    methods=["POST"]
)
def api_verificar_alumno(
    alumno_id
):

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    usuario = alumno[
        "usuario_huella"
    ]

    if not usuario:

        return jsonify({

            "ok": False,

            "mensaje":
                "El alumno no tiene huella registrada."

        })

    resultado = (
        fingerprint_manager.verificar_usuario(

            usuario,

            "Coloque la huella del alumno."
        )
    )

    if not resultado["ok"]:

        return jsonify({

            "ok": False,

            "mensaje":
                "La huella no corresponde "
                "al alumno seleccionado.",

            "resultado":
                resultado["resultado"]

        })

    return jsonify({

        "ok": True,

        "alumno_id":
            alumno_id

    })


# ============================================================
# API ESTADO HUELLA
# ============================================================

@app.route(
    "/api/huella/estado"
)
def api_huella_estado():

    return jsonify(
        fingerprint_status
    )


# ============================================================
# API BOTÓN
# ============================================================

@app.route(
    "/api/boton/<int:compartimento>"
)
def api_boton(
    compartimento
):

    if compartimento not in BUTTON_PINS:

        return jsonify({

            "ok": False,

            "mensaje":
                "Compartimento inválido."

        }), 400

    return jsonify({

        "ok": True,

        "presionado":
            boton_presionado(
                compartimento
            )

    })


# ============================================================
# API ESPERAR BOTÓN
# ============================================================

@app.route(
    "/api/celular/esperar-boton",
    methods=["POST"]
)
def api_esperar_boton():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    compartimento = datos.get(
        "compartimento"
    )

    if not alumno_id:

        return jsonify({

            "ok": False,

            "mensaje":
                "Falta alumno_id."

        }), 400

    try:

        compartimento = int(
            compartimento
        )

    except Exception:

        return jsonify({

            "ok": False,

            "mensaje":
                "Compartimento inválido."

        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    if (
        alumno["compartimento"]
        != compartimento
    ):

        return jsonify({

            "ok": False,

            "mensaje":
                "El compartimento no corresponde "
                "al alumno."

        }), 400

    correcto = esperar_boton(
        compartimento
    )

    if not correcto:

        return jsonify({

            "ok": False,

            "mensaje":
                "No se presionó el botón "
                "dentro del tiempo permitido."

        })

    # --------------------------------------------------------
    # Encender LED de confirmación
    # --------------------------------------------------------

    hilo_led = threading.Thread(

        target=encender_led,

        args=(
            compartimento,
            2
        ),

        daemon=True

    )

    hilo_led.start()

    return jsonify({

        "ok": True,

        "mensaje":
            "Celular registrado correctamente."

    })


# ============================================================
# API LED
# ============================================================

@app.route(
    "/api/led/<int:compartimento>",
    methods=["POST"]
)
def api_led(
    compartimento
):

    if compartimento not in LED_PINS:

        return jsonify({

            "ok": False,

            "mensaje":
                "Compartimento inválido."

        }), 400

    hilo = threading.Thread(

        target=encender_led,

        args=(
            compartimento,
            2
        ),

        daemon=True

    )

    hilo.start()

    return jsonify({

        "ok": True,

        "compartimento":
            compartimento

    })


# ============================================================
# API ASISTENCIA - PRESENTE
# ============================================================

@app.route(
    "/api/asistencia",
    methods=["POST"]
)
def api_asistencia():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
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

    if not alumno_id:

        return jsonify({

            "ok": False,

            "mensaje":
                "Falta alumno_id."

        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    fecha = ahora()

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos

        SET
            presente = 1,
            llego_tarde = 0,
            hora_llegada = ?,
            trajo_celular = ?,
            se_retiro = 0

        WHERE id = ?
        """,
        (
            fecha,
            1 if trajo_celular else 0,
            alumno_id
        )
    )

    conexion.commit()

    conexion.close()

    registrar_evento(

        alumno_id,

        "asistencia",

        (
            "Alumno presente. "
            f"Estado: {estado}. "
            f"Trajo celular: "
            f"{trajo_celular}"
        )

    )

    return jsonify({

        "ok": True,

        "hora": fecha

    })


# ============================================================
# API ASISTENCIA - AUSENTE
# ============================================================

@app.route(
    "/api/asistencia/ausente",
    methods=["POST"]
)
def api_ausente():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    if not alumno_id:

        return jsonify({

            "ok": False,

            "mensaje":
                "Falta alumno_id."

        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos

        SET
            presente = 0,
            llego_tarde = 0,
            hora_llegada = NULL,
            trajo_celular = 0

        WHERE id = ?
        """,
        (
            alumno_id,
        )
    )

    conexion.commit()

    conexion.close()

    registrar_evento(

        alumno_id,

        "ausente",

        "Alumno marcado como ausente."

    )

    return jsonify({

        "ok": True

    })


# ============================================================
# API LLEGADA TARDE
# ============================================================

@app.route(
    "/api/llegada",
    methods=["POST"]
)
def api_llegada():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
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

    if not alumno_id:

        return jsonify({

            "ok": False,

            "mensaje":
                "Falta alumno_id."

        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    fecha = ahora()

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos

        SET
            presente = 1,
            llego_tarde = 1,
            hora_llegada = ?,
            trajo_celular = ?,
            se_retiro = 0

        WHERE id = ?
        """,
        (
            fecha,
            1 if trajo_celular else 0,
            alumno_id
        )
    )

    conexion.commit()

    conexion.close()

    registrar_evento(

        alumno_id,

        "llegada_tarde",

        (
            "Llegada tarde registrada. "
            f"Trajo celular: "
            f"{trajo_celular}"
        )

    )

    return jsonify({

        "ok": True,

        "hora": fecha

    })


# ============================================================
# API CELULAR
# ============================================================

@app.route(
    "/api/alumno/<int:alumno_id>/celular",
    methods=["POST"]
)
def api_celular(alumno_id):

    datos = (
        request.get_json(
            silent=True
        )
        or {}
    )

    trajo = bool(
        datos.get(
            "trajo",
            False
        )
    )

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos

        SET
            trajo_celular = ?

        WHERE id = ?
        """,
        (
            1 if trajo else 0,
            alumno_id
        )
    )

    conexion.commit()
    conexion.close()

    registrar_evento(
        alumno_id,
        "celular",
        (
            "Estado de celular actualizado. "
            f"Trajo celular: {trajo}"
        )
    )

    return jsonify({

        "ok": True,

        "trajo":
            trajo,

        "compartimento":
            alumno["compartimento"]

    })


# ============================================================
# API ABRIR LOCKER
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

        args=(
            RELAY_OPEN_SECONDS,
        ),

        daemon=True

    )

    hilo.start()

    return jsonify({

        "ok": True,

        "mensaje":
            "Locker abierto."

    })


# ============================================================
# API RETIRO
# ============================================================

@app.route(
    "/api/retiro",
    methods=["POST"]
)
def api_retiro():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
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

    if not alumno_id:

        return jsonify({

            "ok": False,

            "mensaje":
                "Falta alumno_id."

        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:

        return jsonify({

            "ok": False,

            "mensaje":
                "Alumno inexistente."

        }), 404

    if retiro_celular:

        if compartimento is None:
            compartimento = alumno["compartimento"]

        try:
            compartimento = int(compartimento)
        except (TypeError, ValueError):
            return jsonify({
                "ok": False,
                "mensaje": "Compartimento inválido."
            }), 400

        if compartimento != alumno["compartimento"]:
            return jsonify({
                "ok": False,
                "mensaje": "El compartimento no corresponde al alumno."
            }), 400

    fecha = ahora()

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos

        SET
            presente = 0,
            se_retiro = 1,
            hora_retiro = ?,
            trajo_celular = ?

        WHERE id = ?
        """,
        (
            fecha,
            0,
            alumno_id
        )
    )

    conexion.commit()
    conexion.close()

    registrar_evento(
        alumno_id,
        "retiro",
        (
            "Retiro registrado. "
            f"Retiro de celular: {retiro_celular}. "
            f"Compartimento: {compartimento if retiro_celular else 'sin celular'}"
        )
    )

    return jsonify({

        "ok": True,

        "hora": fecha,

        "alumno_id": alumno_id

    })


# ============================================================
# API - ALUMNOS CON CELULAR GUARDADO
# ============================================================

@app.route(
    "/api/finalizar/pendientes"
)
def api_finalizar_pendientes():

    conexion = conectar_db()

    filas = conexion.execute(
        """
        SELECT
            id,
            numero_lista,
            nombre,
            apellido,
            compartimento,
            usuario_huella
        FROM alumnos
        WHERE trajo_celular = 1
          AND se_retiro = 0
        ORDER BY compartimento, numero_lista
        """
    ).fetchall()

    conexion.close()

    return jsonify({
        "ok": True,
        "alumnos": [
            dict(fila)
            for fila in filas
        ]
    })


# ============================================================
# API - ESPERAR LIBERACION DEL BOTON
# ============================================================

@app.route(
    "/api/celular/esperar-liberacion",
    methods=["POST"]
)
def api_esperar_liberacion():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    compartimento = datos.get(
        "compartimento"
    )

    if not alumno_id:
        return jsonify({
            "ok": False,
            "mensaje": "Falta alumno_id."
        }), 400

    try:
        compartimento = int(
            compartimento
        )
    except (TypeError, ValueError):
        return jsonify({
            "ok": False,
            "mensaje": "Compartimento invalido."
        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:
        return jsonify({
            "ok": False,
            "mensaje": "Alumno inexistente."
        }), 404

    if alumno["compartimento"] != compartimento:
        return jsonify({
            "ok": False,
            "mensaje": "El compartimento no corresponde al alumno."
        }), 400

    if int(alumno["trajo_celular"] or 0) != 1:
        return jsonify({
            "ok": False,
            "mensaje": "Este alumno no tiene un celular guardado."
        }), 400

    correcto = esperar_liberacion(
        compartimento
    )

    if not correcto:
        return jsonify({
            "ok": False,
            "mensaje":
                "No se detecto el retiro del celular. "
                "Compruebe que el boton haya estado presionado "
                "y luego haya quedado libre."
        })

    return jsonify({
        "ok": True,
        "mensaje":
            "Celular retirado. Ahora coloque la huella."
    })


# ============================================================
# API - CONFIRMAR DEVOLUCION DE CELULAR
# ============================================================

@app.route(
    "/api/finalizar/devolver",
    methods=["POST"]
)
def api_finalizar_devolver():

    datos = (
        request.get_json(
            silent=True
        )
        or {}
    )

    alumno_id = datos.get(
        "alumno_id"
    )

    if not alumno_id:
        return jsonify({
            "ok": False,
            "mensaje": "Falta alumno_id."
        }), 400

    alumno = obtener_alumno(
        alumno_id
    )

    if alumno is None:
        return jsonify({
            "ok": False,
            "mensaje": "Alumno inexistente."
        }), 404

    if int(alumno["trajo_celular"] or 0) != 1:
        return jsonify({
            "ok": False,
            "mensaje": "El alumno no tiene un celular registrado en el locker."
        }), 400

    fecha = ahora()

    conexion = conectar_db()

    conexion.execute(
        """
        UPDATE alumnos
        SET trajo_celular = 0
        WHERE id = ?
        """,
        (alumno_id,)
    )

    conexion.commit()
    conexion.close()

    registrar_evento(
        alumno_id,
        "devolucion_celular",
        "Celular retirado al finalizar la hora."
    )

    return jsonify({
        "ok": True,
        "hora": fecha
    })


# ============================================================
# API FINALIZAR
# ============================================================

@app.route(
    "/api/finalizar",
    methods=["POST"]
)
def api_finalizar():

    global sistema_finalizado

    sistema_finalizado = True

    return jsonify({

        "ok": True,

        "mensaje":
            "Hora finalizada."

    })


@app.route(
    "/api/terminar-hora",
    methods=["POST"]
)
def api_terminar_hora():
    return api_finalizar()


# ============================================================
# LIMPIAR GPIO
# ============================================================

def limpiar():

    if not GPIO_AVAILABLE:

        return

    try:

        GPIO.output(
            RELAY_PIN,
            GPIO.LOW
            if RELAY_ACTIVE_HIGH
            else GPIO.HIGH
        )

    except Exception:

        pass

    try:

        GPIO.cleanup()

    except Exception:

        pass

    print(
        "GPIO liberados."
    )


# ============================================================
# MAIN
# ============================================================

if __name__ == "__main__":

    print("=" * 60)

    print(
        "SISTEMA DE LOCKER"
    )

    print(
        "Raspberry Pi 3"
    )

    print("=" * 60)

    # --------------------------------------------------------
    # BASE DE DATOS
    # --------------------------------------------------------

    inicializar_db()

    # --------------------------------------------------------
    # GPIO
    # --------------------------------------------------------

    configurar_gpio()

    # --------------------------------------------------------
    # LECTOR
    # --------------------------------------------------------

    if GI_AVAILABLE:

        print(
            "GI/PyGObject disponible."
        )

        if fingerprint_manager.obtener_dispositivo():

            print(
                "DigitalPersona detectado correctamente."
            )

        else:

            print(
                "ADVERTENCIA: "
                "no se pudo obtener el lector."
            )

    else:

        print(
            "ADVERTENCIA: "
            "GI/PyGObject no disponible."
        )

    # --------------------------------------------------------
    # INFORMACIÓN
    # --------------------------------------------------------

    print()

    print(
        "Pines GPIO:"
    )

    print(
        f"  Relé: GPIO {RELAY_PIN}"
    )

    print(
        f"  LED 1: GPIO {LED_PINS[1]}"
    )

    print(
        f"  LED 2: GPIO {LED_PINS[2]}"
    )

    print(
        f"  LED 3: GPIO {LED_PINS[3]}"
    )

    print(
        f"  LED 4: GPIO {LED_PINS[4]}"
    )

    print(
        f"  Botón 1: GPIO {BUTTON_PINS[1]}"
    )

    print(
        f"  Botón 2: GPIO {BUTTON_PINS[2]}"
    )

    print(
        f"  Botón 3: GPIO {BUTTON_PINS[3]}"
    )

    print(
        f"  Botón 4: GPIO {BUTTON_PINS[4]}"
    )

    print()

    print(
        "Servidor:"
    )

    print(
        f"http://IP-DE-LA-RASPBERRY:{PORT}"
    )

    print("=" * 60)

    try:

        app.run(

            host=HOST,

            port=PORT,

            debug=False,

            threaded=True

        )

    except KeyboardInterrupt:

        print(
            "\nServidor detenido."
        )

    finally:

        limpiar()