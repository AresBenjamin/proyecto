// ============================================================
// SISTEMA DE LOCKER ESCOLAR
// JavaScript principal
// Compatible con index.html, style.css y app.py
// ============================================================

let alumnos = [];
let alumnoActual = 0;
let alumnoSeleccionado = null;
let alumnoRetiro = null;

let alumnosDevolucion = [];
let indiceDevolucion = 0;
let operacionEnCurso = false;


// ============================================================
// UTILIDADES
// ============================================================

function mostrar(id) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.style.display = "block";
    }
}

function ocultar(id) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.style.display = "none";
    }
}

function cambiarTexto(id, texto) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent =
            texto === null || typeof texto === "undefined"
                ? ""
                : texto;
    }
}

function nombreCompleto(alumno) {
    return `${alumno.nombre || ""} ${alumno.apellido || ""}`.trim();
}

function mostrarMensaje(texto, duracion = 3000) {
    const elemento = document.getElementById("mensajeGeneral");

    if (!elemento) {
        console.log(texto);
        return;
    }

    elemento.textContent = texto || "";
    elemento.style.display = "block";

    clearTimeout(mostrarMensaje.timer);

    mostrarMensaje.timer = setTimeout(() => {
        elemento.style.display = "none";
    }, duracion);
}

function bloquearBoton(id, bloqueado) {
    const boton = document.getElementById(id);

    if (boton) {
        boton.disabled = bloqueado;
    }
}


// ============================================================
// COMUNICACION CON FLASK
// ============================================================

async function jsonFetch(url, opciones = {}) {
    let respuesta;

    try {
        respuesta = await fetch(url, opciones);
    } catch (error) {
        throw new Error("No se pudo conectar con Flask.");
    }

    let datos;

    try {
        datos = await respuesta.json();
    } catch (error) {
        throw new Error(
            `Flask devolvio una respuesta invalida (HTTP ${respuesta.status}).`
        );
    }

    // IMPORTANTE:
    // Flask puede devolver HTTP 200 pero {"ok": false}.
    // Eso tambien debe considerarse un error.
    if (!respuesta.ok || datos.ok === false) {
        throw new Error(
            datos.mensaje ||
            datos.error ||
            `La operacion fallo (HTTP ${respuesta.status}).`
        );
    }

    return datos;
}

function postJSON(url, cuerpo = {}) {
    return jsonFetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(cuerpo)
    });
}


// ============================================================
// CAMBIO DE PANTALLA
// ============================================================

function mostrarPantalla(id) {
    document.querySelectorAll(".pantalla").forEach((pantalla) => {
        pantalla.style.display = "none";
    });

    const pantalla = document.getElementById(id);

    if (!pantalla) {
        console.error(`No existe la pantalla ${id}.`);
        return;
    }

    pantalla.style.display = "block";

    if (id === "pantallaAsistencia") {
        cargarAlumnos();
    }

    if (id === "pantallaLlegada") {
        cargarAusentes();
    }

    if (id === "pantallaRetiro") {
        prepararRetiro();
    }
}


// ============================================================
// LOGIN
// ============================================================

async function iniciarLogin() {

    console.log(
    "BOTON LEER HUELLA PRESIONADO"
);

    if (operacionEnCurso) {

        console.log(
            "Ya hay una lectura de huella en curso."
        );

        return;
    }

    ocultarBotonReintento(
        "botonReintentarLogin"
    );

    mostrarBotonHuella(
        "botonReintentarLogin"
    );

    operacionEnCurso = true;

    bloquearBoton(
        "botonHuella",
        true
    );

    cambiarTexto(
        "mensajeLogin",
        "Coloque la huella del profesor o preceptor..."
    );

    mostrarBotonHuella(
    "botonReintentarLogin"
);

    try {

        const datos =
            await postJSON(
                "/api/login/esperar-huella"
            );

        cambiarTexto(
            "mensajeLogin",
            `✓ Identificacion correcta (${datos.rol || "usuario autorizado"}).`
        );

        setTimeout(
            () => {

                operacionEnCurso =
                    false;

                mostrarPantalla(
                    "pantallaMenu"
                );

            },
            700
        );

    } catch (error) {

        console.error(
            "Error de login:",
            error
        );

        cambiarTexto(
            "mensajeLogin",
            error.message
        );

        mostrarBotonReintento(
            "botonReintentarLogin"
        );

        bloquearBoton(
            "botonHuella",
            false
        );

        operacionEnCurso =
            false;
    }
}


// ============================================================
// REINTENTAR LOGIN
// ============================================================

async function reintentarLogin() {

    

    ocultarBotonReintento(
        "botonReintentarLogin"
    );

    await iniciarLogin();
}

// ============================================================
// BOTONES DE REINTENTO DE HUELLA
// ============================================================

function mostrarBotonReintento(id) {

    const boton =
        document.getElementById(id);

    if (!boton) {
        return;
    }

    boton.style.display =
        "inline-block";
}


function ocultarBotonReintento(id) {

    const boton =
        document.getElementById(id);

    if (!boton) {
        return;
    }

    boton.style.display =
        "none";
}


function mostrarBotonHuella(
    id
) {

    const boton =
        document.getElementById(id);

    if (!boton) {
        return;
    }

    boton.style.display =
        "inline-block";
}
// ============================================================
// ASISTENCIA
// ============================================================

async function cargarAlumnos() {
    try {
        const datos = await jsonFetch(
            "/api/alumnos"
        );

        alumnos = Array.isArray(datos.alumnos)
            ? datos.alumnos
            : [];

        alumnoActual = 0;

        mostrarAlumno();

    } catch (error) {
        console.error("Error cargando alumnos:", error);
        mostrarMensaje(error.message);
    }
}

function mostrarAlumno() {
    ocultar("preguntaCelular");
    ocultar("esperandoCelular");
    ocultar("esperandoHuella");
    ocultar("listaTerminada");

    if (alumnoActual >= alumnos.length) {
        finalizarLista();
        return;
    }

    const alumno = alumnos[alumnoActual];

    cambiarTexto("numeroAlumno", alumno.numero_lista);
    cambiarTexto("nombreAlumno", nombreCompleto(alumno));
    cambiarTexto(
        "progreso",
        `Alumno ${alumnoActual + 1} de ${alumnos.length}`
    );

    mostrar("preguntaPresente");
}

function marcarPresente() {
    ocultar("preguntaPresente");
    mostrar("preguntaCelular");
}

async function marcarAusente() {
    if (operacionEnCurso) {
        return;
    }

    const alumno = alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    operacionEnCurso = true;

    try {
        await postJSON(
            "/api/asistencia/ausente",
            {
                alumno_id: alumno.id
            }
        );

        siguienteAlumno();

    } catch (error) {
        console.error("Error registrando ausencia:", error);
        mostrarMensaje(error.message);

    } finally {
        operacionEnCurso = false;
    }
}


// ============================================================
// ASISTENCIA - CON CELULAR
// ============================================================

async function trajoCelular() {
    if (operacionEnCurso) {
        return;
    }

async function reintentarHuellaAsistenciaConCelular() {

    const alumno =
        alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    ocultarBotonReintento(
        "botonReintentarAsistencia"
    );

    operacionEnCurso = true;

    mostrar(
        "esperandoHuella"
    );

    cambiarTexto(
        "mensajeHuella",
        "Coloque nuevamente la huella del alumno."
    );

    try {

        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo: true
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id:
                    alumno.id,

                estado:
                    "PRESENTE_CON_CELULAR",

                trajo_celular:
                    true
            }
        );

        siguienteAlumno();

    } catch (error) {

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

        mostrarBotonReintento(
            "botonReintentarAsistencia"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}

    const alumno = alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    operacionEnCurso = true;

    ocultar("preguntaCelular");
    mostrar("esperandoCelular");

    cambiarTexto(
        "numeroCompartimento",
        alumno.compartimento
    );

    cambiarTexto(
        "mensajeCelular",
        "Abriendo locker..."
    );

    try {
        await postJSON(
            "/api/locker/abrir"
        );

        cambiarTexto(
            "mensajeCelular",
            `Coloque el celular en el compartimento ${alumno.compartimento} y presione el boton.`
        );

        await postJSON(
            "/api/celular/esperar-boton",
            {
                alumno_id: alumno.id,
                compartimento: alumno.compartimento
            }
        );

        cambiarTexto(
            "mensajeCelular",
            "✓ Celular colocado correctamente."
        );

        mostrarLED("ledConfirmacion");

        // El lector se activa DESPUES de confirmar el celular.
        ocultar("esperandoCelular");
        mostrar("esperandoHuella");

        mostrarBotonHuella(
    "botonReintentarAsistencia"
);

        cambiarTexto(
            "mensajeHuella",
            "Coloque la huella del alumno."
        );

        // Se mantiene abierta la operacion hasta que la huella
        // del alumno haya sido verificada correctamente.
        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo: true
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id: alumno.id,
                estado: "PRESENTE_CON_CELULAR",
                trajo_celular: true
            }
        );

        siguienteAlumno();

    } catch (error) {
        console.error("Error guardando celular:", error);

        cambiarTexto(
            "mensajeCelular",
            error.message
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

    } finally {
        operacionEnCurso = false;
    }
}


// ============================================================
// ASISTENCIA - SIN CELULAR
// ============================================================

async function noTrajoCelular() {

    if (operacionEnCurso) {
        return;
    }

    asistenciaConCelularPendiente =
        false;

    const alumno =
        alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    operacionEnCurso =
        true;

    ocultar(
        "preguntaCelular"
    );

    mostrar(
        "esperandoHuella"
    );

    mostrarBotonHuella(
    "botonReintentarAsistencia"
);

    cambiarTexto(
        "mensajeHuella",
        "Coloque la huella del alumno para confirmar su asistencia."
    );

    try {

        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo: false
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id:
                    alumno.id,

                estado:
                    "PRESENTE_SIN_CELULAR",

                trajo_celular:
                    false
            }
        );

        cambiarTexto(
            "mensajeHuella",
            "✓ Asistencia confirmada. No trajo celular."
        );

        setTimeout(
            siguienteAlumno,
            700
        );

    } catch (error) {

        console.error(
            "Error verificando alumno:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

        mostrarBotonReintento(
            "botonReintentarAsistencia"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// ASISTENCIA - CON CELULAR
// ============================================================

let asistenciaConCelularPendiente = false;


async function trajoCelular() {

    if (operacionEnCurso) {
        return;
    }

    const alumno =
        alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    asistenciaConCelularPendiente =
        true;

    operacionEnCurso =
        true;

    ocultar(
        "preguntaCelular"
    );

    mostrar(
        "esperandoCelular"
    );

    mostrarBotonHuella(
        "botonReintentarAsistencia"
    );

    cambiarTexto(
        "numeroCompartimento",
        alumno.compartimento
    );

    cambiarTexto(
        "mensajeCelular",
        "Abriendo locker..."
    );

    try {

        await postJSON(
            "/api/locker/abrir"
        );

        cambiarTexto(
            "mensajeCelular",

            `Coloque el celular en el compartimento ${alumno.compartimento} y presione el boton.`
        );

        await postJSON(
            "/api/celular/esperar-boton",
            {
                alumno_id:
                    alumno.id,

                compartimento:
                    alumno.compartimento
            }
        );

        cambiarTexto(
            "mensajeCelular",
            "✓ Celular colocado correctamente."
        );

        mostrarLED(
            "ledConfirmacion"
        );

        ocultar(
            "esperandoCelular"
        );

        mostrar(
            "esperandoHuella"
        );

        mostrarBotonHuella(
            "botonReintentarAsistencia"
        );

        cambiarTexto(
            "mensajeHuella",
            "Coloque la huella del alumno."
        );

        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo:
                    true
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id:
                    alumno.id,

                estado:
                    "PRESENTE_CON_CELULAR",

                trajo_celular:
                    true
            }
        );

        asistenciaConCelularPendiente =
            false;

        ocultarBotonReintento(
            "botonReintentarAsistencia"
        );

        siguienteAlumno();

    } catch (error) {

        console.error(
            "Error en asistencia con celular:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

        mostrarBotonHuella(
            "botonReintentarAsistencia"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// REINTENTAR HUELLA - ASISTENCIA CON CELULAR
// ============================================================

async function reintentarHuellaAsistenciaConCelular() {

    const alumno =
        alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    if (operacionEnCurso) {
        return;
    }

    operacionEnCurso =
        true;

    ocultarBotonReintento(
        "botonReintentarAsistencia"
    );

    mostrar(
        "esperandoHuella"
    );

    cambiarTexto(
        "mensajeHuella",
        "Coloque nuevamente la huella del alumno."
    );

    try {

        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo:
                    true
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id:
                    alumno.id,

                estado:
                    "PRESENTE_CON_CELULAR",

                trajo_celular:
                    true
            }
        );

        asistenciaConCelularPendiente =
            false;

        siguienteAlumno();

    } catch (error) {

        console.error(
            "Error reintentando huella:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

        mostrarBotonHuella(
            "botonReintentarAsistencia"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// ASISTENCIA - SIN CELULAR
// ============================================================

async function noTrajoCelular() {

    if (operacionEnCurso) {
        return;
    }

    const alumno =
        alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    asistenciaConCelularPendiente =
        false;

    operacionEnCurso =
        true;

    ocultar(
        "preguntaCelular"
    );

    mostrar(
        "esperandoHuella"
    );

    mostrarBotonHuella(
        "botonReintentarAsistencia"
    );

    cambiarTexto(
        "mensajeHuella",
        "Coloque la huella del alumno para confirmar su asistencia."
    );

    try {

        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo:
                    false
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id:
                    alumno.id,

                estado:
                    "PRESENTE_SIN_CELULAR",

                trajo_celular:
                    false
            }
        );

        cambiarTexto(
            "mensajeHuella",
            "✓ Asistencia confirmada. No trajo celular."
        );

        ocultarBotonReintento(
            "botonReintentarAsistencia"
        );

        setTimeout(
            siguienteAlumno,
            700
        );

    } catch (error) {

        console.error(
            "Error verificando huella:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );

        mostrarBotonHuella(
            "botonReintentarAsistencia"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// BOTÓN REINTENTAR ASISTENCIA
// ============================================================

async function reintentarHuellaAsistencia() {

    if (operacionEnCurso) {
        return;
    }

    ocultarBotonReintento(
        "botonReintentarAsistencia"
    );

    if (
        asistenciaConCelularPendiente
    ) {

        await reintentarHuellaAsistenciaConCelular();

    } else {

        await noTrajoCelular();
    }
}

// ============================================================
// VERIFICAR HUELLA DE ALUMNO
// ============================================================

async function verificarHuellaAlumnoInterno(
    alumnoId
) {
    const datos = await postJSON(
        "/api/alumno/" +
        alumnoId +
        "/verificar-huella"
    );

    if (!datos.ok) {
        throw new Error(
            datos.mensaje ||
            "La huella no corresponde al alumno seleccionado."
        );
    }

    cambiarTexto(
        "mensajeHuella",
        "✓ Huella reconocida."
    );

    return datos;
}


// ============================================================
// FUNCIONES AUXILIARES DE HUELLA
// ============================================================

async function verificarHuellaAlumno(
    conCelular = false
) {
    const alumno = alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    try {
        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id: alumno.id,
                estado: conCelular
                    ? "PRESENTE_CON_CELULAR"
                    : "PRESENTE_SIN_CELULAR",
                trajo_celular: conCelular
            }
        );

        siguienteAlumno();

    } catch (error) {
        console.error(
            "Error verificando huella:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );
    }
}

async function registrarHuellaSinCelular() {
    const alumno = alumnos[alumnoActual];

    if (!alumno) {
        return;
    }

    try {
        await verificarHuellaAlumnoInterno(
            alumno.id
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/celular",
            {
                trajo: false
            }
        );

        await postJSON(
            "/api/asistencia",
            {
                alumno_id: alumno.id,
                estado: "PRESENTE_SIN_CELULAR",
                trajo_celular: false
            }
        );

        siguienteAlumno();

    } catch (error) {
        console.error(
            "Error registrando huella:",
            error
        );

        cambiarTexto(
            "mensajeHuella",
            error.message
        );
    }
}

function pedirHuellaAlumno() {
    ocultar("esperandoCelular");
    mostrar("esperandoHuella");

    cambiarTexto(
        "mensajeHuella",
        "Coloque la huella del alumno."
    );

    verificarHuellaAlumno();
}


// ============================================================
// SIGUIENTE ALUMNO
// ============================================================

function siguienteAlumno() {

    // Liberar cualquier estado de operación anterior.
    operacionEnCurso =
        false;

    // Ocultar botones de reintento antes
    // de mostrar el siguiente alumno.
    ocultarBotonReintento(
        "botonReintentarAsistencia"
    );

    alumnoActual += 1;

    mostrarAlumno();
}


// ============================================================
// FINALIZAR LISTA
// ============================================================

function finalizarLista() {

    ocultar("preguntaPresente");
    ocultar("preguntaCelular");
    ocultar("esperandoCelular");
    ocultar("esperandoHuella");

    // Ocultar el botón de reintento de huella
    // porque la toma de lista ya terminó.
    ocultarBotonReintento(
        "botonReintentarAsistencia"
    );

    asistenciaConCelularPendiente =
        false;

    operacionEnCurso =
        false;

    mostrar("listaTerminada");

    cambiarTexto(
        "mensajeFinal",
        "La toma de lista termino correctamente."
    );
}


// ============================================================
// LED
// ============================================================

function mostrarLED(
    id = "ledConfirmacion"
) {
    const led =
        document.getElementById(id);

    if (!led) {
        return;
    }

    led.classList.add(
        "led-activo"
    );

    setTimeout(
        () => {
            led.classList.remove(
                "led-activo"
            );
        },
        2500
    );
}


// ============================================================
// LLEGADA TARDE
// ============================================================

async function cargarAusentes() {

    alumnoSeleccionado = null;

    ocultar("alumnoSeleccionado");
    ocultar("esperandoHuellaLlegada");
    ocultar("preguntaCelularLlegada");
    ocultar("esperandoCelularLlegada");
    ocultar("resultadoLlegada");

    mostrar("listaAusentes");

    await actualizarListaAusentes();
}


// ============================================================
// ACTUALIZAR SOLAMENTE LA LISTA DE AUSENTES
// ============================================================

async function actualizarListaAusentes() {

    const contenedor =
        document.getElementById(
            "listaAusentes"
        );

    if (!contenedor) {
        return;
    }

    contenedor.innerHTML =
        "<h2>Actualizando alumnos...</h2>";

    try {

        const datos =
            await jsonFetch(
                "/api/alumnos"
            );

        const lista =
            (datos.alumnos || [])
                .filter(
                    function (alumno) {

                        return (
                            Number(alumno.presente) === 0 &&
                            Number(alumno.se_retiro) !== 1
                        );

                    }
                );

        contenedor.innerHTML = "";

        const titulo =
            document.createElement(
                "h2"
            );

        titulo.textContent =
            "Seleccione el alumno que llego tarde:";

        contenedor.appendChild(
            titulo
        );


        if (lista.length === 0) {

            const mensaje =
                document.createElement(
                    "p"
                );

            mensaje.textContent =
                "No hay alumnos ausentes.";

            contenedor.appendChild(
                mensaje
            );

            return;
        }


        lista.forEach(
            function (alumno) {

                const boton =
                    document.createElement(
                        "button"
                    );

                boton.className =
                    "alumno-boton";

                boton.type =
                    "button";

                boton.textContent =
                    `${alumno.numero_lista} - ${nombreCompleto(alumno)}`;

                boton.addEventListener(
                    "click",
                    function () {

                        seleccionarAlumnoLlegada(
                            alumno
                        );

                    }
                );

                contenedor.appendChild(
                    boton
                );

            }
        );

    } catch (error) {

        console.error(
            "Error actualizando alumnos ausentes:",
            error
        );

        contenedor.innerHTML =
            `<div class="error">${error.message}</div>`;
    }
}


// ============================================================
// SELECCIONAR ALUMNO - LLEGADA
// ============================================================

function seleccionarAlumnoLlegada(
    alumno
) {

    if (operacionEnCurso) {
        return;
    }

    alumnoSeleccionado =
        alumno;


    mostrar(
        "alumnoSeleccionado"
    );


    cambiarTexto(
        "numeroSeleccionado",
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreSeleccionado",
        nombreCompleto(
            alumno
        )
    );


    ocultar(
        "preguntaCelularLlegada"
    );


    ocultar(
        "esperandoCelularLlegada"
    );


    ocultar(
        "resultadoLlegada"
    );


    mostrarBotonHuella(
        "botonReintentarLlegada"
    );


    cambiarTexto(
        "mensajeHuellaLlegada",
        "Coloque la huella del alumno."
    );


    verificarHuellaLlegada();

}


// ============================================================
// VERIFICAR HUELLA - LLEGADA
// ============================================================

async function verificarHuellaLlegada() {

    if (!alumnoSeleccionado) {
        return;
    }

    ocultarBotonReintento(
        "botonReintentarLlegada"
    );

    try {

        await postJSON(
            "/api/alumno/" +
            alumnoSeleccionado.id +
            "/verificar-huella"
        );

        cambiarTexto(
            "mensajeHuellaLlegada",
            "✓ Huella reconocida."
        );

        ocultar(
            "esperandoHuellaLlegada"
        );

        mostrar(
            "preguntaCelularLlegada"
        );

    } catch (error) {

        console.error(
            "Error verificando huella de llegada:",
            error
        );

        cambiarTexto(
            "mensajeHuellaLlegada",
            error.message
        );

        mostrarBotonReintento(
            "botonReintentarLlegada"
        );
    }
}


// ============================================================
// REINTENTAR HUELLA - LLEGADA
// ============================================================

async function reintentarHuellaLlegada() {

    ocultarBotonReintento(
        "botonReintentarLlegada"
    );

    await verificarHuellaLlegada();
}

// ============================================================
// LLEGADA TARDE - CON CELULAR
// ============================================================

async function llegadaConCelular() {

    if (
        !alumnoSeleccionado ||
        operacionEnCurso
    ) {
        return;
    }

    operacionEnCurso = true;

    const alumnoProcesado =
        alumnoSeleccionado;

    ocultar(
        "preguntaCelularLlegada"
    );

    mostrar(
        "esperandoCelularLlegada"
    );

    cambiarTexto(
        "numeroCompartimentoLlegada",
        alumnoProcesado.compartimento
    );

    cambiarTexto(
        "mensajeCelularLlegada",
        "Abriendo locker..."
    );

    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        await postJSON(
            "/api/locker/abrir"
        );

        cambiarTexto(
            "mensajeCelularLlegada",

            `Coloque el celular en el compartimento ${alumnoProcesado.compartimento} y presione el boton.`
        );

        // ----------------------------------------------------
        // ESPERAR BOTÓN
        // ----------------------------------------------------

        await postJSON(
            "/api/celular/esperar-boton",
            {
                alumno_id:
                    alumnoProcesado.id,

                compartimento:
                    alumnoProcesado.compartimento
            }
        );

        // ----------------------------------------------------
        // REGISTRAR CELULAR
        // ----------------------------------------------------

        await postJSON(
            "/api/alumno/" +
            alumnoProcesado.id +
            "/celular",
            {
                trajo:
                    true
            }
        );

        // ----------------------------------------------------
        // REGISTRAR LLEGADA TARDE
        // ----------------------------------------------------

        const datos =
            await postJSON(
                "/api/llegada",
                {
                    alumno_id:
                        alumnoProcesado.id,

                    trajo_celular:
                        true
                }
            );

        mostrarLED(
            "ledConfirmacionLlegada"
        );

        ocultar(
            "esperandoCelularLlegada"
        );

        mostrarResultadoLlegada(
            "✓ Llegada tarde registrada a las " +
            (
                datos.hora ||
                "hora actual"
            ) +
            "."
        );

        await prepararSiguienteLlegada();

        // Actualizar la lista y permitir
        // seleccionar al siguiente alumno.


    } catch (error) {

        console.error(
            "Error registrando llegada con celular:",
            error
        );

        cambiarTexto(
            "mensajeCelularLlegada",
            error.message
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// LLEGADA TARDE - SIN CELULAR
// ============================================================

async function llegadaSinCelular() {

    if (
        !alumnoSeleccionado ||
        operacionEnCurso
    ) {
        return;
    }

    operacionEnCurso = true;

    const alumnoProcesado =
        alumnoSeleccionado;

    try {

        // ----------------------------------------------------
        // REGISTRAR QUE NO TRAJO CELULAR
        // ----------------------------------------------------

        await postJSON(
            "/api/alumno/" +
            alumnoProcesado.id +
            "/celular",
            {
                trajo:
                    false
            }
        );

        // ----------------------------------------------------
        // REGISTRAR LLEGADA TARDE
        // ----------------------------------------------------

        const datos =
            await postJSON(
                "/api/llegada",
                {
                    alumno_id:
                        alumnoProcesado.id,

                    trajo_celular:
                        false
                }
            );

        ocultar(
            "preguntaCelularLlegada"
        );

        mostrarResultadoLlegada(
            "✓ Llegada tarde registrada a las " +
            (
                datos.hora ||
                "hora actual"
            ) +
            ". El alumno no trajo celular."
        );

        await prepararSiguienteLlegada();

        // Actualizar lista y permitir
        // seleccionar al siguiente alumno.


    } catch (error) {

        console.error(
            "Error registrando llegada sin celular:",
            error
        );

        mostrarMensaje(
            error.message
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// MOSTRAR RESULTADO DE LLEGADA
// ============================================================

function mostrarResultadoLlegada(
    texto
) {

    mostrar(
        "resultadoLlegada"
    );

    cambiarTexto(
        "resultadoLlegada",
        texto
    );
}


// ============================================================
// PREPARAR SIGUIENTE LLEGADA
// ============================================================

async function prepararSiguienteLlegada() {

    alumnoSeleccionado =
        null;

    ocultar(
        "alumnoSeleccionado"
    );

    ocultar(
        "esperandoHuellaLlegada"
    );

    ocultar(
        "preguntaCelularLlegada"
    );

    ocultar(
        "esperandoCelularLlegada"
    );

    ocultar(
        "resultadoLlegada"
    );

    mostrar(
        "listaAusentes"
    );

    await actualizarListaAusentes();
}

// ============================================================
// PREPARAR RETIRO
// ============================================================

function prepararRetiro() {

    alumnoRetiro =
        null;

    ocultar(
        "esperandoHuellaRetiro"
    );

    ocultar(
        "informacionRetiro"
    );

    ocultar(
        "preguntaRetiro"
    );

    ocultar(
        "resultadoRetiro"
    );

    mostrar(
        "inicioRetiro"
    );
}

// ============================================================
// INICIAR RETIRO
// ============================================================

async function iniciarRetiro() {

    if (operacionEnCurso) {
        return;
    }

    ocultarBotonReintento(
        "botonReintentarRetiro"
    );

    operacionEnCurso =
        true;

    ocultar(
        "inicioRetiro"
    );

    mostrar(
        "esperandoHuellaRetiro"
    );

    mostrarBotonHuella(
    "botonReintentarRetiro"
);

    mostrarBotonHuella(
    "botonReintentarRetiro"
);

    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );

    try {

        const datos =
            await postJSON(
                "/api/alumno/esperar-huella"
            );

        alumnoRetiro = {

            id:
                datos.alumno_id,

            numero_lista:
                datos.numero_lista,

            nombre:
                datos.nombre,

            apellido:
                datos.apellido,

            compartimento:
                datos.compartimento,

            usuario_huella:
                datos.usuario_huella
        };

        cambiarTexto(
            "numeroRetiro",
            alumnoRetiro.numero_lista
        );

        cambiarTexto(
            "nombreRetiro",
            nombreCompleto(
                alumnoRetiro
            )
        );

        cambiarTexto(
            "compartimentoRetiro",
            alumnoRetiro.compartimento === null ||
            typeof alumnoRetiro.compartimento === "undefined"
                ? "Sin compartimento"
                : alumnoRetiro.compartimento
        );

        ocultar(
            "esperandoHuellaRetiro"
        );

        mostrar(
            "informacionRetiro"
        );

        mostrar(
            "preguntaRetiro"
        );

    } catch (error) {

        console.error(
            "Error identificando alumno para retiro:",
            error
        );

        cambiarTexto(
            "mensajeHuellaRetiro",
            error.message
        );

        ocultar(
            "esperandoHuellaRetiro"
        );

        mostrar(
            "inicioRetiro"
        );

        mostrarBotonReintento(
            "botonReintentarRetiro"
        );

    } finally {

        operacionEnCurso =
            false;
    }
}


// ============================================================
// REINTENTAR HUELLA - RETIRO
// ============================================================

async function reintentarHuellaRetiro() {

    ocultarBotonReintento(
        "botonReintentarRetiro"
    );

    await iniciarRetiro();
}
// ============================================================
// RETIRO - CON CELULAR
// ============================================================

async function retirarConCelular() {

    if (
        !alumnoRetiro ||
        operacionEnCurso
    ) {
        return;
    }

    operacionEnCurso = true;

    const alumno =
        alumnoRetiro;

    try {

        // ----------------------------------------------------
        // Abrir locker
        // ----------------------------------------------------

        await postJSON(
            "/api/locker/abrir"
        );

        cambiarTexto(
            "nombreRetiro",
            nombreCompleto(alumno)
        );

        cambiarTexto(
            "compartimentoRetiro",
            alumno.compartimento
        );

        mostrarMensaje(
            "Retire el celular del compartimento " +
            alumno.compartimento +
            "."
        );

        // ----------------------------------------------------
        // Esperar que el botón se libere.
        // Esto confirma que el celular fue retirado.
        // ----------------------------------------------------

        await postJSON(
            "/api/celular/esperar-liberacion",
            {
                alumno_id:
                    alumno.id,

                compartimento:
                    alumno.compartimento
            }
        );

        // ----------------------------------------------------
        // Registrar retiro
        // ----------------------------------------------------

        const datos =
            await postJSON(
                "/api/retiro",
                {
                    alumno_id:
                        alumno.id,

                    retiro_celular:
                        true,

                    compartimento:
                        alumno.compartimento
                }
            );

        // ----------------------------------------------------
        // Actualizar alumnos
        // ----------------------------------------------------

        const alumnosActualizados =
            await jsonFetch(
                "/api/alumnos"
            );

        alumnos =
            Array.isArray(
                alumnosActualizados.alumnos
            )
                ? alumnosActualizados.alumnos
                : [];

        mostrarResultadoRetiro(

            "✓ Retiro registrado a las " +
            (
                datos.hora ||
                "hora actual"
            ) +
            ". Celular retirado correctamente."

        );

    } catch (error) {

        console.error(
            "Error en retiro con celular:",
            error
        );

        mostrarMensaje(
            error.message
        );

    } finally {

        operacionEnCurso =
            false;
    }
}

// ============================================================
// RETIRO - SIN CELULAR
// ============================================================

async function retirarSinCelular() {

    if (
        !alumnoRetiro ||
        operacionEnCurso
    ) {
        return;
    }

    operacionEnCurso = true;

    try {

        const datos =
            await postJSON(
                "/api/retiro",
                {
                    alumno_id:
                        alumnoRetiro.id,

                    retiro_celular:
                        false
                }
            );

        // ----------------------------------------------------
        // Actualizar lista desde SQLite
        // ----------------------------------------------------

        await cargarAlumnos();

        // ----------------------------------------------------
        // Mostrar resultado
        // ----------------------------------------------------

        mostrarResultadoRetiro(
            "✓ Retiro temprano registrado a las " +
            (
                datos.hora ||
                "hora actual"
            ) +
            "."
        );

    } catch (error) {

        console.error(
            "Error en retiro sin celular:",
            error
        );

        mostrarMensaje(
            error.message
        );

    } finally {

        operacionEnCurso = false;
    }
}


// ============================================================
// RESULTADO RETIRO
// ============================================================

function mostrarResultadoRetiro(
    texto
) {

    ocultar(
        "preguntaRetiro"
    );

    ocultar(
        "esperandoHuellaRetiro"
    );

    mostrar(
        "resultadoRetiro"
    );

    cambiarTexto(
        "resultadoRetiro",
        texto
    );
}


// ============================================================
// TERMINAR HORA
// ============================================================
//
// Flujo:
//
// 1. Buscar alumnos con celular guardado.
// 2. Abrir locker.
// 3. Alumno retira celular.
// 4. Esperar que el boton quede libre.
// 5. Pedir huella.
// 6. Verificar identidad.
// 7. Registrar devolucion.
// 8. Pasar al siguiente alumno.
// 9. Cuando no quedan alumnos, finalizar hora.
//
// ============================================================

async function finalizarHora() {

    if (operacionEnCurso) {
        return;
    }

    const confirmar =
        window.confirm(
            "¿Está seguro de que desea terminar la hora?"
        );

    if (!confirmar) {
        return;
    }

    operacionEnCurso = true;

    try {

        // ----------------------------------------------------
        // Buscar alumnos que todavía tienen celular guardado.
        // ----------------------------------------------------

        const datos =
            await jsonFetch(
                "/api/finalizar/pendientes"
            );

        alumnosDevolucion =
            Array.isArray(
                datos.alumnos
            )
                ? datos.alumnos
                : [];

        indiceDevolucion = 0;

        // ----------------------------------------------------
        //  pantalla de devolución.
        // ----------------------------------------------------

        ocultar(
            "preguntaPresente"
        );

        ocultar(
            "preguntaCelular"
        );

        ocultar(
            "esperandoCelular"
        );

        ocultar(
            "esperandoHuella"
        );

        mostrar(
            "listaTerminada"
        );

        const titulo =
            document.querySelector(
                "#listaTerminada h2"
            );

        if (titulo) {
            titulo.textContent =
                "Devolución de celulares";
        }

        const boton =
            document.querySelector(
                "#listaTerminada button"
            );

        if (boton) {
            boton.style.display =
                "none";
        }

        // ----------------------------------------------------
        // Si nadie tiene celular guardado.
        // ----------------------------------------------------

        if (
            alumnosDevolucion.length === 0
        ) {

            cambiarTexto(
                "mensajeFinal",
                "No hay celulares guardados."
            );

            await terminarHoraDefinitivamente();

            return;
        }

        // ----------------------------------------------------
        // Comenzar devolución.
        // ----------------------------------------------------

        await procesarSiguienteDevolucion();

    } catch (error) {

        console.error(
            "Error iniciando devolución:",
            error
        );

        cambiarTexto(
            "mensajeFinal",
            "ERROR:\n\n" +
            error.message
        );
        

        operacionEnCurso = false;
    }
}


// ============================================================
// PROCESAR SIGUIENTE DEVOLUCION
// ============================================================

async function procesarSiguienteDevolucion() {

    // --------------------------------------------------------
    // ¿Ya terminamos todos?
    // --------------------------------------------------------

    if (
        indiceDevolucion >=
        alumnosDevolucion.length
    ) {

        await terminarHoraDefinitivamente();

        return;
    }

    const alumno =
        alumnosDevolucion[
            indiceDevolucion
        ];

    // --------------------------------------------------------
    // Mostrar información inicial.
    // --------------------------------------------------------

    cambiarTexto(
        "mensajeFinal",

        "Devolución " +
        (
            indiceDevolucion + 1
        ) +
        " de " +
        alumnosDevolucion.length +
        "\n\n" +

        "Alumno: " +
        alumno.numero_lista +
        " - " +
        nombreCompleto(
            alumno
        ) +
        "\n\n" +

        "Compartimento: " +
        alumno.compartimento
    );

    mostrarBotonReintento(
    "botonReintentarDevolucion"
);

    try {

        // ----------------------------------------------------
        // PASO 1:
        // Abrir locker.
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeFinal",

            "Alumno " +
            alumno.numero_lista +
            " - " +
            nombreCompleto(
                alumno
            ) +
            "\n\n" +

            "Abriendo locker..."
        );

        await postJSON(
            "/api/locker/abrir"
        );

        // ----------------------------------------------------
        // PASO 2:
        // Retirar celular.
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeFinal",

            "Alumno " +
            alumno.numero_lista +
            " - " +
            nombreCompleto(
                alumno
            ) +
            "\n\n" +

            "Retire el celular del compartimento " +
            alumno.compartimento +
            ".\n\n" +

            "Al sacar el celular, " +
            "el botón debe quedar LIBRE."
        );

        // ----------------------------------------------------
        // PASO 3:
        // Esperar liberación del botón.
        // ----------------------------------------------------

        await postJSON(
            "/api/celular/esperar-liberacion",
            {
                alumno_id:
                    alumno.id,

                compartimento:
                    alumno.compartimento
            }
        );

        // ----------------------------------------------------
        // PASO 4:
        // Pedir huella.
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeFinal",

            "✓ Celular retirado.\n\n" +

            "Alumno " +
            alumno.numero_lista +
            ":\n" +
            nombreCompleto(
                alumno
            ) +
            "\n\n" +

            "COLOQUE SU HUELLA EN EL LECTOR."
        );

        mostrarBotonHuella(
            "botonReintentarDevolucion"
        );

        console.log(
            "Solicitando huella para alumno:",
            alumno.id
        );

        // ----------------------------------------------------
        // PASO 5:
        // Verificar huella.
        //
        // Este fetch hace que Python llame al DigitalPersona.
        // ----------------------------------------------------

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/verificar-huella"
        );

        console.log(
            "Huella reconocida para alumno:",
            alumno.id
        );

        cambiarTexto(
            "mensajeFinal",

            "✓ Huella reconocida.\n\n" +
            "Registrando devolución..."
        );

        // ----------------------------------------------------
        // PASO 6:
        // Registrar devolución.
        // ----------------------------------------------------

        await postJSON(
            "/api/finalizar/devolver",
            {
                alumno_id:
                    alumno.id
            }
        );

        // ----------------------------------------------------
        // PASO 7:
        // Actualizar alumnos.
        // ----------------------------------------------------

        try {

            const datosActualizados =
                await jsonFetch(
                    "/api/alumnos"
                );

            alumnos =
                Array.isArray(
                    datosActualizados.alumnos
                )
                    ? datosActualizados.alumnos
                    : [];

        } catch (error) {

            console.warn(
                "No se pudo actualizar la lista:",
                error
            );
        }

        // ----------------------------------------------------
        // PASO 8:
        // Mostrar confirmación.
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeFinal",

            "✓ Devolución registrada.\n\n" +

            "Alumno " +
            alumno.numero_lista +
            " completado."
        );

        // ----------------------------------------------------
        // PASO 9:
        // Siguiente alumno.
        // ----------------------------------------------------

        indiceDevolucion += 1;

        setTimeout(
            function () {

                procesarSiguienteDevolucion();

            },
            1000
        );

    } catch (error) {

        console.error(
            "Error en devolución:",
            error
        );

        // ----------------------------------------------------
        // MUY IMPORTANTE:
        //
        // NO avanzamos al siguiente alumno.
        //
        // Si falla la liberación del botón o la huella,
        // el sistema queda detenido en este alumno.
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeFinal",

            "ERROR CON EL ALUMNO " +
            alumno.numero_lista +
            "\n\n" +

            error.message +
            "\n\n" +

            "No se continuará con el siguiente alumno " +
            "hasta completar esta devolución."
        );

        // No modificar indiceDevolucion.
        // No llamar a procesarSiguienteDevolucion().
    }
}

// ============================================================
// REINTENTAR HUELLA - DEVOLUCIÓN
// ============================================================

async function reintentarHuellaDevolucion() {

    const alumno =
        alumnosDevolucion[
            indiceDevolucion
        ];

    if (!alumno) {
        return;
    }

    ocultarBotonReintento(
        "botonReintentarDevolucion"
    );

    try {

        cambiarTexto(
            "mensajeFinal",

            "COLOQUE NUEVAMENTE SU HUELLA.\n\n" +
            alumno.nombre +
            " " +
            alumno.apellido
        );

        await postJSON(
            "/api/alumno/" +
            alumno.id +
            "/verificar-huella"
        );

        cambiarTexto(
            "mensajeFinal",
            "✓ Huella reconocida.\n\n" +
            "Registrando devolución..."
        );

        await postJSON(
            "/api/finalizar/devolver",
            {
                alumno_id:
                    alumno.id
            }
        );

        indiceDevolucion += 1;

        setTimeout(
            procesarSiguienteDevolucion,
            700
        );

    } catch (error) {

        console.error(
            "Error reintentando huella:",
            error
        );

        cambiarTexto(
            "mensajeFinal",
            "Huella incorrecta.\n\n" +
            "Presione REINTENTAR HUELLA."
        );

        mostrarBotonReintento(
            "botonReintentarDevolucion"
        );
    }
}


// ============================================================
// FnNALIZAR DEFINITIVAMENTE LA HORA
// ============================================================

async function terminarHoraDefinitivamente() {

    try {

        await postJSON(
            "/api/finalizar"
        );

        const titulo =
            document.querySelector(
                "#listaTerminada h2"
            );

        if (titulo) {

            titulo.textContent =
                "Hora terminada";
        }

        cambiarTexto(
            "mensajeFinal",

            "✓ Todos los celulares fueron retirados.\n\n" +
            "La hora terminó correctamente."
        );

        const boton =
            document.querySelector(
                "#listaTerminada button"
            );

        if (boton) {

            boton.style.display =
                "inline-block";

            boton.textContent =
                "VOLVER AL MENÚ";
        }

    } catch (error) {

        console.error(
            "Error finalizando hora:",
            error
        );

        cambiarTexto(
            "mensajeFinal",

            "Error finalizando la hora:\n\n" +
            error.message
        );

    } finally {

        operacionEnCurso =
            false;
    }
}

// ============================================================
// FUNCIONES AUXILIARES FINALES
// ============================================================

function regresarAlMenu() {
    mostrarPantalla(
        "pantallaMenu"
    );
}


// ============================================================
// ACTUALIZAR DATOS DE ALUMNOS
// ============================================================

async function actualizarAlumnos() {

    try {

        const datos =
            await jsonFetch(
                "/api/alumnos"
            );

        alumnos =
            Array.isArray(
                datos.alumnos
            )
                ? datos.alumnos
                : [];

        return alumnos;

    } catch (error) {

        console.error(
            "No se pudieron actualizar los alumnos:",
            error
        );

        return alumnos;
    }
}


// ============================================================
// COMPROBAR ESTADO DEL SISTEMA
// ============================================================

async function consultarEstado() {

    try {

        const datos =
            await jsonFetch(
                "/api/estado"
            );

        console.log(
            "Estado del sistema:",
            datos
        );

        return datos;

    } catch (error) {

        console.error(
            "No se pudo consultar el estado:",
            error
        );

        return null;
    }
}


// ============================================================
// COMPROBAR ESTADO DEL LECTOR
// ============================================================

async function consultarEstadoHuella() {

    try {

        const datos =
            await jsonFetch(
                "/api/huella/estado"
            );

        console.log(
            "Estado del lector:",
            datos
        );

        return datos;

    } catch (error) {

        console.error(
            "No se pudo consultar el lector:",
            error
        );

        return null;
    }
}


// ============================================================
// COMPROBAR BOTÓN DE UN COMPARTIMENTO
// ============================================================

async function consultarBoton(
    compartimento
) {

    try {

        const datos =
            await jsonFetch(
                "/api/boton/" +
                compartimento
            );

        return datos.presionado;

    } catch (error) {

        console.error(
            "Error consultando boton:",
            error
        );

        return false;
    }
}


// ============================================================
// ENCENDER LED MANUALMENTE
// ============================================================

async function encenderLED(
    compartimento
) {

    try {

        await postJSON(
            "/api/led/" +
            compartimento
        );

        mostrarLED(
            "ledConfirmacion"
        );

    } catch (error) {

        console.error(
            "Error encendiendo LED:",
            error
        );
    }
}


// ============================================================
// VOLVER A LA PANTALLA DE LOGIN
// ============================================================

function volverAlLogin() {

    alumnoSeleccionado =
        null;

    alumnoRetiro =
        null;

    alumnosDevolucion =
        [];

    indiceDevolucion =
        0;

    alumnoActual =
        0;

    operacionEnCurso =
        false;

    ocultar(
        "listaTerminada"
    );

    ocultar(
        "resultadoLlegada"
    );

    ocultar(
        "resultadoRetiro"
    );

    bloquearBoton(
        "botonHuella",
        false
    );

    cambiarTexto(
        "mensajeLogin",
        "Esperando identificación..."
    );

    mostrarPantalla(
        "pantallaLogin"
    );
}


// ============================================================
// REFRESCAR LISTA DESDE EL SERVIDOR
// ============================================================

async function refrescarListaActual() {

    try {

        const datos =
            await jsonFetch(
                "/api/alumnos"
            );

        alumnos =
            Array.isArray(
                datos.alumnos
            )
                ? datos.alumnos
                : [];

        return true;

    } catch (error) {

        console.error(
            "Error actualizando lista:",
            error
        );

        return false;
    }
}


// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        // ----------------------------------------------------
        // Estado inicial de la interfaz
        // ----------------------------------------------------

        ocultar(
            "mensajeGeneral"
        );

        ocultar(
            "preguntaCelular"
        );

        ocultar(
            "esperandoCelular"
        );

        ocultar(
            "esperandoHuella"
        );

        ocultar(
            "listaTerminada"
        );

        ocultar(
            "alumnoSeleccionado"
        );

        ocultar(
            "esperandoHuellaLlegada"
        );

        ocultar(
            "preguntaCelularLlegada"
        );

        ocultar(
            "esperandoCelularLlegada"
        );

        ocultar(
            "resultadoLlegada"
        );

        ocultar(
            "inicioRetiro"
        );

        ocultar(
            "esperandoHuellaRetiro"
        );

        ocultar(
            "informacionRetiro"
        );

        ocultar(
            "preguntaRetiro"
        );

        ocultar(
            "resultadoRetiro"
        );

        // ----------------------------------------------------
        // Mostrar login
        // ----------------------------------------------------

        mostrarPantalla(
            "pantallaLogin"
        );

        // ----------------------------------------------------
        // Consultas iniciales
        // ----------------------------------------------------

        consultarEstado();

    }
);


// ============================================================
// EVITAR SALIDAS ACCIDENTALES DURANTE UNA DEVOLUCIÓN
// ============================================================

window.addEventListener(
    "beforeunload",
    function (evento) {

        if (
            alumnosDevolucion.length > 0 &&
            indiceDevolucion <
                alumnosDevolucion.length
        ) {

            evento.preventDefault();

            evento.returnValue = "";

        }

    }
);


async function actualizarListaAusentes() {
    const contenedor =
        document.getElementById(
            "listaAusentes"
        );

    if (!contenedor) {
        return;
    }

    try {
        const datos =
            await jsonFetch(
                "/api/alumnos"
            );

        const lista =
            (datos.alumnos || [])
                .filter(
                    function (alumno) {
                        return (
                            Number(alumno.presente) === 0 &&
                            Number(alumno.se_retiro) !== 1
                        );
                    }
                );

        contenedor.innerHTML = "";

        const titulo =
            document.createElement(
                "h2"
            );

        titulo.textContent =
            "Seleccione el alumno que llego tarde:";

        contenedor.appendChild(
            titulo
        );

        if (lista.length === 0) {
            const mensaje =
                document.createElement(
                    "p"
                );

            mensaje.textContent =
                "No hay alumnos ausentes.";

            contenedor.appendChild(
                mensaje
            );

            return;
        }

        lista.forEach(
            function (alumno) {

                const boton =
                    document.createElement(
                        "button"
                    );

                boton.className =
                    "alumno-boton";

                boton.type =
                    "button";

                boton.textContent =
                    `${alumno.numero_lista} - ${nombreCompleto(alumno)}`;

                boton.addEventListener(
                    "click",
                    function () {
                        seleccionarAlumnoLlegada(
                            alumno
                        );
                    }
                );

                contenedor.appendChild(
                    boton
                );
            }
        );

    } catch (error) {

        console.error(
            "Error actualizando lista de ausentes:",
            error
        );

        mostrarMensaje(
            error.message
        );
    }
}