// ============================================================
// SISTEMA DE LOCKER
// JAVASCRIPT PRINCIPAL
// ============================================================


// ============================================================
// VARIABLES
// ============================================================

let alumnos = [];

let alumnoActual = 0;

let alumnoSeleccionado = null;

let alumnoRetiro = null;


// ============================================================
// INICIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "Sistema de locker iniciado."
        );

        mostrarPantalla(
            "pantallaLogin"
        );

    }
);


// ============================================================
// CAMBIAR PANTALLA
// ============================================================

function mostrarPantalla(id) {

    const pantallas =
        document.querySelectorAll(
            ".pantalla"
        );


    pantallas.forEach(
        function (pantalla) {

            pantalla.style.display =
                "none";

        }
    );


    const pantalla =
        document.getElementById(id);


    if (pantalla) {

        pantalla.style.display =
            "block";

    }


    // --------------------------------------------------------
    // Acciones al entrar a determinadas pantallas
    // --------------------------------------------------------

    if (
        id === "pantallaAsistencia"
    ) {

        cargarAlumnos();

    }


    if (
        id === "pantallaLlegada"
    ) {

        cargarAusentes();

    }


    if (
        id === "pantallaRetiro"
    ) {

        prepararRetiro();

    }

}


// ============================================================
// LOGIN
// ============================================================

async function iniciarLogin() {

    const boton =
        document.getElementById(
            "botonHuella"
        );


    const mensaje =
        document.getElementById(
            "mensajeLogin"
        );


    if (boton) {

        boton.disabled = true;

    }


    if (mensaje) {

        mensaje.innerText =
            "Coloque la huella del profesor/preceptor...";

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO:
        // Python tiene /api/login/esperar-huella
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/login/esperar-huella",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            if (mensaje) {

                mensaje.innerText =
                    datos.mensaje ||
                    "Huella no reconocida.";

            }


            if (boton) {

                boton.disabled = false;

            }


            return;

        }


        if (mensaje) {

            mensaje.innerText =
                "✓ Identificación correcta.";

        }


        setTimeout(
            function () {

                mostrarPantalla(
                    "pantallaMenu"
                );

            },
            800
        );


    } catch (error) {

        console.error(
            "Error en login:",
            error
        );


        if (mensaje) {

            mensaje.innerText =
                "Error de comunicación con la Raspberry Pi.";

        }


        if (boton) {

            boton.disabled = false;

        }

    }

}


// ============================================================
// CARGAR ALUMNOS
// ============================================================

async function cargarAlumnos() {

    try {

        const respuesta =
            await fetch(
                "/api/alumnos"
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            mostrarMensaje(
                "No se pudieron cargar los alumnos."
            );


            return;

        }


        alumnos =
            datos.alumnos || [];


        alumnoActual = 0;


        mostrarAlumno();


    } catch (error) {

        console.error(
            "Error cargando alumnos:",
            error
        );


        mostrarMensaje(
            "Error cargando alumnos."
        );

    }

}


// ============================================================
// MOSTRAR ALUMNO
// ============================================================

function mostrarAlumno() {

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


    mostrar(
        "preguntaPresente"
    );


    if (
        alumnoActual >= alumnos.length
    ) {

        finalizarLista();

        return;

    }


    const alumno =
        alumnos[alumnoActual];


    cambiarTexto(
        "numeroAlumno",
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreAlumno",
        alumno.nombre +
        " " +
        alumno.apellido
    );


    cambiarTexto(
        "progreso",
        "Alumno " +
        (alumnoActual + 1) +
        " de " +
        alumnos.length
    );

}


// ============================================================
// PRESENTE
// ============================================================

function marcarPresente() {

    ocultar(
        "preguntaPresente"
    );


    mostrar(
        "preguntaCelular"
    );

}


// ============================================================
// AUSENTE
// ============================================================

async function marcarAusente() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/asistencia/ausente",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            mostrarMensaje(
                datos.mensaje ||
                "No se pudo registrar la ausencia."
            );


            return;

        }


        siguienteAlumno();


    } catch (error) {

        console.error(
            "Error registrando ausencia:",
            error
        );


        mostrarMensaje(
            "Error registrando ausencia."
        );

    }

}


// ============================================================
// TRAJO CELULAR
// ============================================================

async function trajoCelular() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    ocultar(
        "preguntaCelular"
    );


    cambiarTexto(
        "numeroCompartimento",
        alumno.compartimento
    );


    cambiarTexto(
        "mensajeCelular",
        "Abriendo locker..."
    );


    mostrar(
        "esperandoCelular"
    );


    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            cambiarTexto(
                "mensajeCelular",
                datosApertura.mensaje ||
                "No se pudo abrir el locker."
            );


            return;

        }


        cambiarTexto(
            "mensajeCelular",

            "Coloque el celular en el compartimento " +
            alumno.compartimento +
            " y presione el botón."
        );


        // ----------------------------------------------------
        // ESPERAR BOTÓN
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/celular/esperar-boton",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        compartimento:
                            alumno.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeCelular",
                datos.mensaje ||
                "No se registró la colocación del celular."
            );


            return;

        }


        cambiarTexto(
            "mensajeCelular",
            "✓ Celular colocado correctamente."
        );


        mostrarLED();


        // ----------------------------------------------------
        // DESPUÉS DEL CELULAR:
        // PEDIR HUELLA
        // ----------------------------------------------------

        setTimeout(
            function () {

                pedirHuellaAlumno();

            },
            700
        );


    } catch (error) {

        console.error(
            "Error colocando celular:",
            error
        );


        cambiarTexto(
            "mensajeCelular",
            "Error de comunicación."
        );

    }

}


// ============================================================
// PEDIR HUELLA DEL ALUMNO
// ============================================================

function pedirHuellaAlumno() {

    ocultar(
        "esperandoCelular"
    );


    mostrar(
        "esperandoHuella"
    );


    cambiarTexto(
        "mensajeHuella",
        "✓ Celular registrado. Ahora coloque su huella."
    );


    verificarHuellaAlumno();

}


// ============================================================
// NO TRAJO CELULAR
// ============================================================

function noTrajoCelular() {

    ocultar(
        "preguntaCelular"
    );


    mostrar(
        "esperandoHuella"
    );


    cambiarTexto(
        "mensajeHuella",
        "Coloque la huella del alumno."
    );


    registrarHuellaSinCelular();

}


// ============================================================
// VERIFICAR HUELLA DEL ALUMNO ACTUAL
// ============================================================

async function verificarHuellaAlumno() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO:
        // Python tiene:
        // /api/alumno/<id>/verificar-huella
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumno.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuella",

                datos.mensaje ||
                "La huella no corresponde."
            );


            // No avanzar.
            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuella",
                        "Vuelva a colocar la huella del alumno."
                    );

                    verificarHuellaAlumno();

                },
                1200
            );


            return;

        }


        // ----------------------------------------------------
        // HUELLA CORRECTA
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeHuella",
            "✓ Huella reconocida."
        );


        // ----------------------------------------------------
        // REGISTRAR ASISTENCIA
        // ----------------------------------------------------

        const registro =
            await fetch(
                "/api/asistencia",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE",

                        trajo_celular:
                            true

                    })

                }
            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(
                "mensajeHuella",

                resultado.mensaje ||
                "No se pudo registrar la asistencia."
            );


            return;

        }


        // ----------------------------------------------------
        // SIGUIENTE ALUMNO
        // ----------------------------------------------------

        setTimeout(
            siguienteAlumno,
            1000
        );


    } catch (error) {

        console.error(
            "Error verificando huella:",
            error
        );


        cambiarTexto(
            "mensajeHuella",
            "Error de comunicación con el lector."
        );

    }

}


// ============================================================
// REGISTRAR HUELLA SIN CELULAR
// ============================================================

async function registrarHuellaSinCelular() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO:
        // Verificar alumno específico
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumno.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuella",

                datos.mensaje ||
                "La huella no corresponde."
            );


            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuella",
                        "Vuelva a colocar la huella del alumno."
                    );

                    registrarHuellaSinCelular();

                },
                1200
            );


            return;

        }


        cambiarTexto(
            "mensajeHuella",
            "✓ Huella reconocida."
        );


        // ----------------------------------------------------
        // REGISTRAR ASISTENCIA SIN CELULAR
        // ----------------------------------------------------

        const registro =
            await fetch(
                "/api/asistencia",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE_SIN_CELULAR",

                        trajo_celular:
                            false

                    })

                }
            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(
                "mensajeHuella",

                resultado.mensaje ||
                "No se pudo registrar la asistencia."
            );


            return;

        }


        setTimeout(
            siguienteAlumno,
            1000
        );


    } catch (error) {

        console.error(
            "Error registrando alumno sin celular:",
            error
        );


        cambiarTexto(
            "mensajeHuella",
            "Error de comunicación con el lector."
        );

    }

}


// ============================================================
// SIGUIENTE ALUMNO
// ============================================================

function siguienteAlumno() {

    alumnoActual++;


    mostrarAlumno();

}


// ============================================================
// FINALIZAR LISTA
// ============================================================

function finalizarLista() {

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


    cambiarTexto(
        "mensajeFinal",
        "La toma de lista terminó correctamente."
    );

}


// ============================================================
// LED VISUAL
// ============================================================

function mostrarLED() {

    const led =
        document.getElementById(
            "ledConfirmacion"
        );


    if (!led) {

        return;

    }


    led.classList.add(
        "led-activo"
    );


    setTimeout(
        function () {

            led.classList.remove(
                "led-activo"
            );

        },
        3000
    );

}


// ============================================================
// LLEGADA TARDE
// ============================================================

async function cargarAusentes() {

    alumnoSeleccionado = null;


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


    try {

        const respuesta =
            await fetch(
                "/api/alumnos/ausentes"
            );


        const datos =
            await respuesta.json();


        const lista =
            document.getElementById(
                "listaAusentes"
            );


        if (!lista) {

            return;

        }


        lista.innerHTML = "";


        if (
            !datos.ok ||
            !datos.alumnos ||
            datos.alumnos.length === 0
        ) {

            lista.innerHTML =
                "<h2>No hay alumnos ausentes.</h2>";


            return;

        }


        const titulo =
            document.createElement(
                "h2"
            );


        titulo.innerText =
            "Seleccione el alumno que llegó:";


        lista.appendChild(
            titulo
        );


        datos.alumnos.forEach(
            function (alumno) {

                const boton =
                    document.createElement(
                        "button"
                    );


                boton.className =
                    "alumno-boton";


                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;


                boton.onclick =
                    function () {

                        seleccionarAlumnoLlegada(
                            alumno
                        );

                    };


                lista.appendChild(
                    boton
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando ausentes:",
            error
        );


        mostrarMensaje(
            "Error cargando ausentes."
        );

    }

}


// ============================================================
// SELECCIONAR ALUMNO LLEGADA
// ============================================================

function seleccionarAlumnoLlegada(
    alumno
) {

    alumnoSeleccionado =
        alumno;


    ocultar(
        "listaAusentes"
    );


    mostrar(
        "alumnoSeleccionado"
    );


    cambiarTexto(
        "numeroSeleccionado",
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreSeleccionado",
        alumno.nombre +
        " " +
        alumno.apellido
    );


    mostrar(
        "esperandoHuellaLlegada"
    );


    cambiarTexto(
        "mensajeHuellaLlegada",
        "Coloque la huella del alumno."
    );


    verificarHuellaLlegada();

}


// ============================================================
// VERIFICAR HUELLA LLEGADA
// ============================================================

async function verificarHuellaLlegada() {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumnoSeleccionado.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaLlegada",

                datos.mensaje ||
                "La huella no corresponde."
            );


            // Volver a pedir huella
            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuellaLlegada",
                        "Coloque nuevamente la huella del alumno."
                    );

                    verificarHuellaLlegada();

                },
                1200
            );


            return;

        }


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
            "Error de comunicación."
        );

    }

}


// ============================================================
// LLEGADA CON CELULAR
// ============================================================

async function llegadaConCelular() {

    if (!alumnoSeleccionado) {

        return;

    }


    ocultar(
        "preguntaCelularLlegada"
    );


    mostrar(
        "esperandoCelularLlegada"
    );


    cambiarTexto(
        "numeroCompartimentoLlegada",
        alumnoSeleccionado.compartimento
    );


    cambiarTexto(
        "mensajeCelularLlegada",
        "Abriendo locker..."
    );


    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            cambiarTexto(
                "mensajeCelularLlegada",

                datosApertura.mensaje ||
                "No se pudo abrir el locker."
            );


            return;

        }


        cambiarTexto(
            "mensajeCelularLlegada",
            "Coloque el celular y presione el botón."
        );


        // ----------------------------------------------------
        // ESPERAR BOTÓN
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/celular/esperar-boton",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        compartimento:
                            alumnoSeleccionado.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeCelularLlegada",

                datos.mensaje ||
                "No se registró la colocación del celular."
            );


            return;

        }


        await registrarLlegada(
            true
        );


    } catch (error) {

        console.error(
            "Error en llegada con celular:",
            error
        );


        cambiarTexto(
            "mensajeCelularLlegada",
            "Error de comunicación."
        );

    }

}


// ============================================================
// LLEGADA SIN CELULAR
// ============================================================

async function llegadaSinCelular() {

    await registrarLlegada(
        false
    );

}


// ============================================================
// REGISTRAR LLEGADA
// ============================================================

async function registrarLlegada(
    trajoCelular
) {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/llegada",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        trajo_celular:
                            trajoCelular

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            mostrarMensaje(
                datos.mensaje ||
                "No se pudo registrar la llegada."
            );


            return;

        }


        ocultar(
            "preguntaCelularLlegada"
        );


        ocultar(
            "esperandoCelularLlegada"
        );


        mostrar(
            "resultadoLlegada"
        );


        cambiarTexto(
            "resultadoLlegada",

            "✓ Llegada registrada a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error registrando llegada:",
            error
        );


        mostrarMensaje(
            "Error de comunicación."
        );

    }

}


// ============================================================
// RETIRO
// ============================================================

function prepararRetiro() {

    alumnoRetiro = null;


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

function iniciarRetiro() {

    ocultar(
        "inicioRetiro"
    );


    mostrar(
        "esperandoHuellaRetiro"
    );


    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );


    identificarAlumnoRetiro();

}


// ============================================================
// IDENTIFICAR ALUMNO PARA RETIRO
// ============================================================
//
// Acá NO conocemos todavía al alumno.
// Por eso usamos la función Python:
// fingerprint_manager.identificar_alumno()
// mediante /api/alumno/esperar-huella
//
// ============================================================

async function identificarAlumnoRetiro() {

    try {

        const respuesta =
            await fetch(
                "/api/alumno/esperar-huella",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaRetiro",

                datos.mensaje ||
                "No se pudo identificar al alumno."
            );


            return;

        }


        // ----------------------------------------------------
        // Guardamos los datos recibidos
        // ----------------------------------------------------

        alumnoRetiro = {

            id:
                datos.alumno_id,

            alumno_id:
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
            datos.numero_lista
        );


        cambiarTexto(
            "nombreRetiro",

            datos.nombre +
            " " +
            datos.apellido
        );


        cambiarTexto(
            "compartimentoRetiro",
            datos.compartimento
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
            "Error comunicando con el lector."
        );

    }

}


// ============================================================
// CARGAR LISTA DE RETIRO
// ============================================================
//
// Esta función queda disponible por si el HTML utiliza una
// lista manual de alumnos para retiro.
//
// ============================================================

async function cargarListaRetiro() {

    try {

        const respuesta =
            await fetch(
                "/api/alumnos"
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            return;

        }


        alumnos =
            datos.alumnos || [];


        const lista =
            document.getElementById(
                "listaRetiro"
            );


        if (!lista) {

            return;

        }


        lista.innerHTML = "";


        alumnos.forEach(
            function (alumno) {

                if (
                    alumno.se_retiro === 1
                ) {

                    return;

                }


                const boton =
                    document.createElement(
                        "button"
                    );


                boton.className =
                    "alumno-boton";


                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;


                boton.onclick =
                    function () {

                        seleccionarAlumnoRetiro(
                            alumno
                        );

                    };


                lista.appendChild(
                    boton
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando lista de retiro:",
            error
        );

    }

}


// ============================================================
// SELECCIONAR RETIRO
// ============================================================

function seleccionarAlumnoRetiro(
    alumno
) {

    alumnoRetiro =
        alumno;


    cambiarTexto(
        "numeroRetiro",

        "Nº " +
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreRetiro",

        alumno.nombre +
        " " +
        alumno.apellido
    );


    cambiarTexto(
        "compartimentoRetiro",

        alumno.compartimento
    );


    ocultar(
        "inicioRetiro"
    );


    mostrar(
        "informacionRetiro"
    );


    mostrar(
        "esperandoHuellaRetiro"
    );


    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );


    verificarHuellaRetiro();

}


// ============================================================
// VERIFICAR HUELLA PARA RETIRO
// ============================================================
//
// IMPORTANTE:
// Esta función verifica la huella contra un alumno específico.
//
// Python:
// /api/alumno/<int:alumno_id>/verificar-huella
//
// ============================================================

async function verificarHuellaRetiro() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumnoRetiro.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaRetiro",

                datos.mensaje ||
                "La huella no corresponde."
            );


            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuellaRetiro",
                        "Coloque nuevamente la huella del alumno."
                    );

                    verificarHuellaRetiro();

                },
                1200
            );


            return;

        }


        ocultar(
            "esperandoHuellaRetiro"
        );


        mostrar(
            "preguntaRetiro"
        );


    } catch (error) {

        console.error(
            "Error verificando huella de retiro:",
            error
        );


        cambiarTexto(
            "mensajeHuellaRetiro",
            "Error comunicando con el lector."
        );

    }

}


// ============================================================
// RETIRAR CON CELULAR
// ============================================================

async function retirarConCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            alert(
                datosApertura.mensaje ||
                "No se pudo abrir el locker."
            );


            return;

        }


        // ----------------------------------------------------
        // REGISTRAR RETIRO
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            true,

                        compartimento:
                            alumnoRetiro.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje ||
                "No se pudo registrar el retiro."
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(
            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error en retiro con celular:",
            error
        );


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// RETIRAR SIN CELULAR
// ============================================================

async function retirarSinCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            false

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje ||
                "No se pudo registrar el retiro."
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(
            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error en retiro sin celular:",
            error
        );


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// FINALIZAR HORA
// ============================================================

async function finalizarHora() {

    const confirmar =
        confirm(
            "¿Está seguro de que desea finalizar la hora?"
        );


    if (!confirmar) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/finalizar",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (datos.ok) {

            mostrarPantalla(
                "pantallaLogin"
            );


            cambiarTexto(
                "mensajeLogin",
                "Esperando identificación..."
            );


            const boton =
                document.getElementById(
                    "botonHuella"
                );


            if (boton) {

                boton.disabled = false;

            }

        } else {

            alert(
                datos.mensaje ||
                "No se pudo finalizar la hora."
            );

        }


    } catch (error) {

        console.error(
            "Error finalizando hora:",
            error
        );


        alert(
            "No se pudo finalizar la hora."
        );

    }

}


// ============================================================
// FUNCIONES GENERALES
// ============================================================

function mostrar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "block";

    }

}


function ocultar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "none";

    }

}


function cambiarTexto(
    id,
    texto
) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.innerText =
            texto;

    }

}


function mostrarMensaje(
    texto
) {

    const elemento =
        document.getElementById(
            "mensajeGeneral"
        );


    if (elemento) {

        elemento.innerText =
            texto;

    }

}o.id,

                        compartimento:
                            alumno.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeCelular",
                datos.mensaje ||
                "No se registró la colocación del celular."
            );


            return;

        }


        cambiarTexto(
            "mensajeCelular",
            "✓ Celular colocado correctamente."
        );


        mostrarLED();


        // ----------------------------------------------------
        // DESPUÉS DEL CELULAR:
        // PEDIR HUELLA
        // ----------------------------------------------------

        setTimeout(
            function () {

                pedirHuellaAlumno();

            },
            700
        );


    } catch (error) {

        console.error(
            "Error colocando celular:",
            error
        );


        cambiarTexto(
            "mensajeCelular",
            "Error de comunicación."
        );

    }

}


// ============================================================
// PEDIR HUELLA DEL ALUMNO
// ============================================================

function pedirHuellaAlumno() {

    ocultar(
        "esperandoCelular"
    );


    mostrar(
        "esperandoHuella"
    );


    cambiarTexto(
        "mensajeHuella",
        "✓ Celular registrado. Ahora coloque su huella."
    );


    verificarHuellaAlumno();

}


// ============================================================
// NO TRAJO CELULAR
// ============================================================

function noTrajoCelular() {

    ocultar(
        "preguntaCelular"
    );


    mostrar(
        "esperandoHuella"
    );


    cambiarTexto(
        "mensajeHuella",
        "Coloque la huella del alumno."
    );


    registrarHuellaSinCelular();

}


// ============================================================
// VERIFICAR HUELLA DEL ALUMNO ACTUAL
// ============================================================

async function verificarHuellaAlumno() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO:
        // Python tiene:
        // /api/alumno/<id>/verificar-huella
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumno.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuella",

                datos.mensaje ||
                "La huella no corresponde."
            );


            // No avanzar.
            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuella",
                        "Vuelva a colocar la huella del alumno."
                    );

                    verificarHuellaAlumno();

                },
                1200
            );


            return;

        }


        // ----------------------------------------------------
        // HUELLA CORRECTA
        // ----------------------------------------------------

        cambiarTexto(
            "mensajeHuella",
            "✓ Huella reconocida."
        );


        // ----------------------------------------------------
        // REGISTRAR ASISTENCIA
        // ----------------------------------------------------

        const registro =
            await fetch(
                "/api/asistencia",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE",

                        trajo_celular:
                            true

                    })

                }
            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(
                "mensajeHuella",

                resultado.mensaje ||
                "No se pudo registrar la asistencia."
            );


            return;

        }


        // ----------------------------------------------------
        // SIGUIENTE ALUMNO
        // ----------------------------------------------------

        setTimeout(
            siguienteAlumno,
            1000
        );


    } catch (error) {

        console.error(
            "Error verificando huella:",
            error
        );


        cambiarTexto(
            "mensajeHuella",
            "Error de comunicación con el lector."
        );

    }

}


// ============================================================
// REGISTRAR HUELLA SIN CELULAR
// ============================================================

async function registrarHuellaSinCelular() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO:
        // Verificar alumno específico
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumno.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuella",

                datos.mensaje ||
                "La huella no corresponde."
            );


            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuella",
                        "Vuelva a colocar la huella del alumno."
                    );

                    registrarHuellaSinCelular();

                },
                1200
            );


            return;

        }


        cambiarTexto(
            "mensajeHuella",
            "✓ Huella reconocida."
        );


        // ----------------------------------------------------
        // REGISTRAR ASISTENCIA SIN CELULAR
        // ----------------------------------------------------

        const registro =
            await fetch(
                "/api/asistencia",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE_SIN_CELULAR",

                        trajo_celular:
                            false

                    })

                }
            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(
                "mensajeHuella",

                resultado.mensaje ||
                "No se pudo registrar la asistencia."
            );


            return;

        }


        setTimeout(
            siguienteAlumno,
            1000
        );


    } catch (error) {

        console.error(
            "Error registrando alumno sin celular:",
            error
        );


        cambiarTexto(
            "mensajeHuella",
            "Error de comunicación con el lector."
        );

    }

}


// ============================================================
// SIGUIENTE ALUMNO
// ============================================================

function siguienteAlumno() {

    alumnoActual++;


    mostrarAlumno();

}


// ============================================================
// FINALIZAR LISTA
// ============================================================

function finalizarLista() {

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


    cambiarTexto(
        "mensajeFinal",
        "La toma de lista terminó correctamente."
    );

}


// ============================================================
// LED VISUAL
// ============================================================

function mostrarLED() {

    const led =
        document.getElementById(
            "ledConfirmacion"
        );


    if (!led) {

        return;

    }


    led.classList.add(
        "led-activo"
    );


    setTimeout(
        function () {

            led.classList.remove(
                "led-activo"
            );

        },
        3000
    );

}


// ============================================================
// LLEGADA TARDE
// ============================================================

async function cargarAusentes() {

    alumnoSeleccionado = null;


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


    try {

        const respuesta =
            await fetch(
                "/api/alumnos/ausentes"
            );


        const datos =
            await respuesta.json();


        const lista =
            document.getElementById(
                "listaAusentes"
            );


        if (!lista) {

            return;

        }


        lista.innerHTML = "";


        if (
            !datos.ok ||
            !datos.alumnos ||
            datos.alumnos.length === 0
        ) {

            lista.innerHTML =
                "<h2>No hay alumnos ausentes.</h2>";


            return;

        }


        const titulo =
            document.createElement(
                "h2"
            );


        titulo.innerText =
            "Seleccione el alumno que llegó:";


        lista.appendChild(
            titulo
        );


        datos.alumnos.forEach(
            function (alumno) {

                const boton =
                    document.createElement(
                        "button"
                    );


                boton.className =
                    "alumno-boton";


                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;


                boton.onclick =
                    function () {

                        seleccionarAlumnoLlegada(
                            alumno
                        );

                    };


                lista.appendChild(
                    boton
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando ausentes:",
            error
        );


        mostrarMensaje(
            "Error cargando ausentes."
        );

    }

}


// ============================================================
// SELECCIONAR ALUMNO LLEGADA
// ============================================================

function seleccionarAlumnoLlegada(
    alumno
) {

    alumnoSeleccionado =
        alumno;


    ocultar(
        "listaAusentes"
    );


    mostrar(
        "alumnoSeleccionado"
    );


    cambiarTexto(
        "numeroSeleccionado",
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreSeleccionado",
        alumno.nombre +
        " " +
        alumno.apellido
    );


    mostrar(
        "esperandoHuellaLlegada"
    );


    cambiarTexto(
        "mensajeHuellaLlegada",
        "Coloque la huella del alumno."
    );


    verificarHuellaLlegada();

}


// ============================================================
// VERIFICAR HUELLA LLEGADA
// ============================================================

async function verificarHuellaLlegada() {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        // ----------------------------------------------------
        // CORREGIDO
        // ----------------------------------------------------

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumnoSeleccionado.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaLlegada",

                datos.mensaje ||
                "La huella no corresponde."
            );


            // Volver a pedir huella
            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuellaLlegada",
                        "Coloque nuevamente la huella del alumno."
                    );

                    verificarHuellaLlegada();

                },
                1200
            );


            return;

        }


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
            "Error de comunicación."
        );

    }

}


// ============================================================
// LLEGADA CON CELULAR
// ============================================================

async function llegadaConCelular() {

    if (!alumnoSeleccionado) {

        return;

    }


    ocultar(
        "preguntaCelularLlegada"
    );


    mostrar(
        "esperandoCelularLlegada"
    );


    cambiarTexto(
        "numeroCompartimentoLlegada",
        alumnoSeleccionado.compartimento
    );


    cambiarTexto(
        "mensajeCelularLlegada",
        "Abriendo locker..."
    );


    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            cambiarTexto(
                "mensajeCelularLlegada",

                datosApertura.mensaje ||
                "No se pudo abrir el locker."
            );


            return;

        }


        cambiarTexto(
            "mensajeCelularLlegada",
            "Coloque el celular y presione el botón."
        );


        // ----------------------------------------------------
        // ESPERAR BOTÓN
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/celular/esperar-boton",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        compartimento:
                            alumnoSeleccionado.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeCelularLlegada",

                datos.mensaje ||
                "No se registró la colocación del celular."
            );


            return;

        }


        await registrarLlegada(
            true
        );


    } catch (error) {

        console.error(
            "Error en llegada con celular:",
            error
        );


        cambiarTexto(
            "mensajeCelularLlegada",
            "Error de comunicación."
        );

    }

}


// ============================================================
// LLEGADA SIN CELULAR
// ============================================================

async function llegadaSinCelular() {

    await registrarLlegada(
        false
    );

}


// ============================================================
// REGISTRAR LLEGADA
// ============================================================

async function registrarLlegada(
    trajoCelular
) {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/llegada",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        trajo_celular:
                            trajoCelular

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            mostrarMensaje(
                datos.mensaje ||
                "No se pudo registrar la llegada."
            );


            return;

        }


        ocultar(
            "preguntaCelularLlegada"
        );


        ocultar(
            "esperandoCelularLlegada"
        );


        mostrar(
            "resultadoLlegada"
        );


        cambiarTexto(
            "resultadoLlegada",

            "✓ Llegada registrada a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error registrando llegada:",
            error
        );


        mostrarMensaje(
            "Error de comunicación."
        );

    }

}


// ============================================================
// RETIRO
// ============================================================

function prepararRetiro() {

    alumnoRetiro = null;


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

function iniciarRetiro() {

    ocultar(
        "inicioRetiro"
    );


    mostrar(
        "esperandoHuellaRetiro"
    );


    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );


    identificarAlumnoRetiro();

}


// ============================================================
// IDENTIFICAR ALUMNO PARA RETIRO
// ============================================================
//
// Acá NO conocemos todavía al alumno.
// Por eso usamos la función Python:
// fingerprint_manager.identificar_alumno()
// mediante /api/alumno/esperar-huella
//
// ============================================================

async function identificarAlumnoRetiro() {

    try {

        const respuesta =
            await fetch(
                "/api/alumno/esperar-huella",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaRetiro",

                datos.mensaje ||
                "No se pudo identificar al alumno."
            );


            return;

        }


        // ----------------------------------------------------
        // Guardamos los datos recibidos
        // ----------------------------------------------------

        alumnoRetiro = {

            id:
                datos.alumno_id,

            alumno_id:
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
            datos.numero_lista
        );


        cambiarTexto(
            "nombreRetiro",

            datos.nombre +
            " " +
            datos.apellido
        );


        cambiarTexto(
            "compartimentoRetiro",
            datos.compartimento
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
            "Error comunicando con el lector."
        );

    }

}


// ============================================================
// CARGAR LISTA DE RETIRO
// ============================================================
//
// Esta función queda disponible por si el HTML utiliza una
// lista manual de alumnos para retiro.
//
// ============================================================

async function cargarListaRetiro() {

    try {

        const respuesta =
            await fetch(
                "/api/alumnos"
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            return;

        }


        alumnos =
            datos.alumnos || [];


        const lista =
            document.getElementById(
                "listaRetiro"
            );


        if (!lista) {

            return;

        }


        lista.innerHTML = "";


        alumnos.forEach(
            function (alumno) {

                if (
                    alumno.se_retiro === 1
                ) {

                    return;

                }


                const boton =
                    document.createElement(
                        "button"
                    );


                boton.className =
                    "alumno-boton";


                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;


                boton.onclick =
                    function () {

                        seleccionarAlumnoRetiro(
                            alumno
                        );

                    };


                lista.appendChild(
                    boton
                );

            }
        );


    } catch (error) {

        console.error(
            "Error cargando lista de retiro:",
            error
        );

    }

}


// ============================================================
// SELECCIONAR RETIRO
// ============================================================

function seleccionarAlumnoRetiro(
    alumno
) {

    alumnoRetiro =
        alumno;


    cambiarTexto(
        "numeroRetiro",

        "Nº " +
        alumno.numero_lista
    );


    cambiarTexto(
        "nombreRetiro",

        alumno.nombre +
        " " +
        alumno.apellido
    );


    cambiarTexto(
        "compartimentoRetiro",

        alumno.compartimento
    );


    ocultar(
        "inicioRetiro"
    );


    mostrar(
        "informacionRetiro"
    );


    mostrar(
        "esperandoHuellaRetiro"
    );


    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );


    verificarHuellaRetiro();

}


// ============================================================
// VERIFICAR HUELLA PARA RETIRO
// ============================================================
//
// IMPORTANTE:
// Esta función verifica la huella contra un alumno específico.
//
// Python:
// /api/alumno/<int:alumno_id>/verificar-huella
//
// ============================================================

async function verificarHuellaRetiro() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumnoRetiro.id +
                "/verificar-huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaRetiro",

                datos.mensaje ||
                "La huella no corresponde."
            );


            setTimeout(
                function () {

                    cambiarTexto(
                        "mensajeHuellaRetiro",
                        "Coloque nuevamente la huella del alumno."
                    );

                    verificarHuellaRetiro();

                },
                1200
            );


            return;

        }


        ocultar(
            "esperandoHuellaRetiro"
        );


        mostrar(
            "preguntaRetiro"
        );


    } catch (error) {

        console.error(
            "Error verificando huella de retiro:",
            error
        );


        cambiarTexto(
            "mensajeHuellaRetiro",
            "Error comunicando con el lector."
        );

    }

}


// ============================================================
// RETIRAR CON CELULAR
// ============================================================

async function retirarConCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        // ----------------------------------------------------
        // ABRIR LOCKER
        // ----------------------------------------------------

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            alert(
                datosApertura.mensaje ||
                "No se pudo abrir el locker."
            );


            return;

        }


        // ----------------------------------------------------
        // REGISTRAR RETIRO
        // ----------------------------------------------------

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            true,

                        compartimento:
                            alumnoRetiro.compartimento

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje ||
                "No se pudo registrar el retiro."
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(
            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error en retiro con celular:",
            error
        );


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// RETIRAR SIN CELULAR
// ============================================================

async function retirarSinCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            false

                    })

                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje ||
                "No se pudo registrar el retiro."
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(
            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora
        );


    } catch (error) {

        console.error(
            "Error en retiro sin celular:",
            error
        );


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// FINALIZAR HORA
// ============================================================

async function finalizarHora() {

    const confirmar =
        confirm(
            "¿Está seguro de que desea finalizar la hora?"
        );


    if (!confirmar) {

        return;

    }


    try {

        const respuesta =
            await fetch(
                "/api/finalizar",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (datos.ok) {

            mostrarPantalla(
                "pantallaLogin"
            );


            cambiarTexto(
                "mensajeLogin",
                "Esperando identificación..."
            );


            const boton =
                document.getElementById(
                    "botonHuella"
                );


            if (boton) {

                boton.disabled = false;

            }

        } else {

            alert(
                datos.mensaje ||
                "No se pudo finalizar la hora."
            );

        }


    } catch (error) {

        console.error(
            "Error finalizando hora:",
            error
        );


        alert(
            "No se pudo finalizar la hora."
        );

    }

}


// ============================================================
// FUNCIONES GENERALES
// ============================================================

function mostrar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "block";

    }

}


function ocultar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "none";

    }

}


function cambiarTexto(
    id,
    texto
) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.innerText =
            texto;

    }

}


function mostrarMensaje(
    texto
) {

    const elemento =
        document.getElementById(
            "mensajeGeneral"
        );


    if (elemento) {

        elemento.innerText =
            texto;

    }

};


            // No avanzar.

            setTimeout(

                function () {

                    cambiarTexto(

                        "mensajeHuella",

                        "Vuelva a colocar la huella del alumno."

                    );

                    verificarHuellaAlumno();

                },

                1200

            );


            return;

        }


        // ----------------------------------------------------
        // HUella correcta
        // ----------------------------------------------------

        cambiarTexto(

            "mensajeHuella",

            "✓ Huella reconocida."

        );


        // ----------------------------------------------------
        // Registrar asistencia
        // ----------------------------------------------------

        const registro =
            await fetch(

                "/api/asistencia",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE",

                        trajo_celular:
                            true

                    })

                }

            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(

                "mensajeHuella",

                resultado.mensaje

            );


            return;

        }


        // ----------------------------------------------------
        // Siguiente
        // ----------------------------------------------------

        setTimeout(

            siguienteAlumno,

            1000

        );


    } catch (error) {

        console.error(error);


        cambiarTexto(

            "mensajeHuella",

            "Error de comunicación con el lector."

        );

    }

}


// ============================================================
// CASO SIN CELULAR
// ============================================================
//
// Reemplazamos el valor trajo_celular=true por false
// cuando el alumno no trae celular.
//
// ============================================================

// Para que la función anterior sea correcta en ambos casos,
// usamos esta versión especial.

async function registrarHuellaSinCelular() {

    const alumno =
        alumnos[alumnoActual];


    if (!alumno) {

        return;

    }


    try {

        const respuesta =
            await fetch(

            "/api/alumno/" +
            alumno.id +
            "/verificar-huella",

            {
                method: "POST"
            }

        );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(

                "mensajeHuella",

                "La huella no corresponde."

            );


            return;

        }


        const registro =
            await fetch(

                "/api/asistencia",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumno.id,

                        estado:
                            "PRESENTE_SIN_CELULAR",

                        trajo_celular:
                            false

                    })

                }

            );


        const resultado =
            await registro.json();


        if (!resultado.ok) {

            cambiarTexto(

                "mensajeHuella",

                resultado.mensaje

            );


            return;

        }


        siguienteAlumno();


    } catch (error) {

        console.error(error);

    }

}


// ============================================================
// CORREGIR NO CELULAR
// ============================================================
//
// Redefinimos la función para usar la función correcta.
// ============================================================

function noTrajoCelular() {

    ocultar(
        "preguntaCelular"
    );


    mostrar(
        "esperandoHuella"
    );


    cambiarTexto(

        "mensajeHuella",

        "Coloque la huella del alumno."

    );


    registrarHuellaSinCelular();

}


// ============================================================
// SIGUIENTE ALUMNO
// ============================================================

function siguienteAlumno() {

    alumnoActual++;


    mostrarAlumno();

}


// ============================================================
// FINALIZAR LISTA
// ============================================================

function finalizarLista() {

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


    cambiarTexto(

        "mensajeFinal",

        "La toma de lista terminó correctamente."

    );

}


// ============================================================
// LED VISUAL
// ============================================================

function mostrarLED() {

    const led =
        document.getElementById(
            "ledConfirmacion"
        );


    if (!led) {

        return;

    }


    led.classList.add(
        "led-activo"
    );


    setTimeout(

        function () {

            led.classList.remove(
                "led-activo"
            );

        },

        3000

    );

}


// ============================================================
// LLEGADA TARDE
// ============================================================

async function cargarAusentes() {

    alumnoSeleccionado = null;


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


    try {

        const respuesta =
            await fetch(

                "/api/alumnos/ausentes"

            );


        const datos =
            await respuesta.json();


        const lista =
            document.getElementById(
                "listaAusentes"
            );


        lista.innerHTML = "";


        if (
            !datos.ok ||
            datos.alumnos.length === 0
        ) {

            lista.innerHTML =
                "<h2>No hay alumnos ausentes.</h2>";


            return;

        }


        const titulo =
            document.createElement(
                "h2"
            );


        titulo.innerText =
            "Seleccione el alumno que llegó:";


        lista.appendChild(
            titulo
        );


        datos.alumnos.forEach(

            function (alumno) {

                const boton =
                    document.createElement(
                        "button"
                    );


                boton.className =
                    "alumno-boton";


                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;


                boton.onclick =
                    function () {

                        seleccionarAlumnoLlegada(
                            alumno
                        );

                    };


                lista.appendChild(
                    boton
                );

            }

        );


    } catch (error) {

        console.error(error);

        mostrarMensaje(
            "Error cargando ausentes."
        );

    }

}


// ============================================================
// SELECCIONAR ALUMNO LLEGADA
// ============================================================

function seleccionarAlumnoLlegada(
    alumno
) {

    alumnoSeleccionado =
        alumno;


    ocultar(
        "listaAusentes"
    );


    mostrar(
        "alumnoSeleccionado"
    );


    cambiarTexto(

        "numeroSeleccionado",

        alumno.numero_lista

    );


    cambiarTexto(

        "nombreSeleccionado",

        alumno.nombre +
        " " +
        alumno.apellido

    );


    mostrar(
        "esperandoHuellaLlegada"
    );


    cambiarTexto(

        "mensajeHuellaLlegada",

        "Coloque la huella del alumno."

    );


    verificarHuellaLlegada();

}


// ============================================================
// VERIFICAR HUELLA LLEGADA
// ============================================================

async function verificarHuellaLlegada() {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/alumno/" +
                alumnoSeleccionado.id +
                "/huella",

                {
                    method: "POST"
                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(

                "mensajeHuellaLlegada",

                datos.mensaje ||
                "La huella no corresponde."

            );


            return;

        }


        ocultar(
            "esperandoHuellaLlegada"
        );


        mostrar(
            "preguntaCelularLlegada"
        );


    } catch (error) {

        console.error(error);


        cambiarTexto(

            "mensajeHuellaLlegada",

            "Error de comunicación."

        );

    }

}


// ============================================================
// LLEGADA CON CELULAR
// ============================================================

async function llegadaConCelular() {

    if (!alumnoSeleccionado) {

        return;

    }


    ocultar(
        "preguntaCelularLlegada"
    );


    mostrar(
        "esperandoCelularLlegada"
    );


    cambiarTexto(

        "numeroCompartimentoLlegada",

        alumnoSeleccionado.compartimento

    );


    cambiarTexto(

        "mensajeCelularLlegada",

        "Abriendo locker..."

    );


    try {

        const apertura =
            await fetch(

                "/api/locker/abrir",

                {
                    method: "POST"
                }

            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            cambiarTexto(

                "mensajeCelularLlegada",

                "No se pudo abrir el locker."

            );


            return;

        }


        cambiarTexto(

            "mensajeCelularLlegada",

            "Coloque el celular y presione el botón."

        );


        const respuesta =
            await fetch(

                "/api/celular/esperar-boton",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        compartimento:
                            alumnoSeleccionado.compartimento

                    })

                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(

                "mensajeCelularLlegada",

                datos.mensaje

            );


            return;

        }


        await registrarLlegada(
            true
        );


    } catch (error) {

        console.error(error);


        cambiarTexto(

            "mensajeCelularLlegada",

            "Error de comunicación."

        );

    }

}


// ============================================================
// LLEGADA SIN CELULAR
// ============================================================

function llegadaSinCelular() {

    registrarLlegada(
        false
    );

}


// ============================================================
// REGISTRAR LLEGADA
// ============================================================

async function registrarLlegada(
    trajoCelular
) {

    if (!alumnoSeleccionado) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/llegada",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        trajo_celular:
                            trajoCelular

                    })

                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            mostrarMensaje(
                datos.mensaje
            );


            return;

        }


        ocultar(
            "preguntaCelularLlegada"
        );


        ocultar(
            "esperandoCelularLlegada"
        );


        mostrar(
            "resultadoLlegada"
        );


        cambiarTexto(

            "resultadoLlegada",

            "✓ Llegada registrada a las " +
            datos.hora

        );


    } catch (error) {

        console.error(error);

    }

}


// ============================================================
// RETIRO
// ============================================================

function prepararRetiro() {

    alumnoRetiro = null;


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

function iniciarRetiro() {

    ocultar(
        "inicioRetiro"
    );


    mostrar(
        "esperandoHuellaRetiro"
    );


    cambiarTexto(

        "mensajeHuellaRetiro",

        "Coloque la huella del alumno."

    );


    identificarAlumnoRetiro();

}


// ============================================================
// IDENTIFICAR ALUMNO PARA RETIRO
// ============================================================

async function identificarAlumnoRetiro() {

    try {

        const respuesta =
            await fetch(

                "/api/alumno/identificar-huella",

                {

                    method: "POST"

                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(

                "mensajeHuellaRetiro",

                datos.mensaje

            );


            return;

        }


        alumnoRetiro =
            datos;


        cambiarTexto(

            "numeroRetiro",

            datos.numero_lista

        );


        cambiarTexto(

            "nombreRetiro",

            datos.nombre +
            " " +
            datos.apellido

        );


        cambiarTexto(

            "compartimentoRetiro",

            datos.compartimento

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

        console.error(error);


        cambiarTexto(

            "mensajeHuellaRetiro",

            "Error comunicando con el lector."

        );

    }

}


// ============================================================
// RETIRAR CON CELULAR
// ============================================================

async function retirarConCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const apertura =
            await fetch(

                "/api/locker/abrir",

                {
                    method: "POST"
                }

            );


        const datosApertura =
            await apertura.json();


        if (!datosApertura.ok) {

            alert(
                "No se pudo abrir el locker."
            );


            return;

        }


        const respuesta =
            await fetch(

                "/api/retiro",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.alumno_id,

                        retiro_celular:
                            true

                    })

                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(

            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora

        );


    } catch (error) {

        console.error(error);


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// RETIRAR SIN CELULAR
// ============================================================

async function retirarSinCelular() {

    if (!alumnoRetiro) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/retiro",

                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.alumno_id,

                        retiro_celular:
                            false

                    })

                }

            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            alert(
                datos.mensaje
            );


            return;

        }


        ocultar(
            "preguntaRetiro"
        );


        mostrar(
            "resultadoRetiro"
        );


        cambiarTexto(

            "resultadoRetiro",

            "✓ Retiro registrado a las " +
            datos.hora

        );


    } catch (error) {

        console.error(error);


        alert(
            "Error de comunicación."
        );

    }

}


// ============================================================
// FINALIZAR HORA
// ============================================================

async function finalizarHora() {

    const confirmar =
        confirm(

            "¿Está seguro de que desea finalizar la hora?"

        );


    if (!confirmar) {

        return;

    }


    try {

        const respuesta =
            await fetch(

                "/api/finalizar",

                {

                    method: "POST"

                }

            );


        const datos =
            await respuesta.json();


        if (datos.ok) {

            mostrarPantalla(
                "pantallaLogin"
            );


        }


    } catch (error) {

        console.error(error);


        alert(
            "No se pudo finalizar la hora."
        );

    }

}


// ============================================================
// FUNCIONES GENERALES
// ============================================================

function mostrar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "block";

    }

}


function ocultar(id) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.style.display =
            "none";

    }

}


function cambiarTexto(
    id,
    texto
) {

    const elemento =
        document.getElementById(id);


    if (elemento) {

        elemento.innerText =
            texto;

    }

}


function mostrarMensaje(
    texto
) {

    const elemento =
        document.getElementById(
            "mensajeGeneral"
        );


    if (elemento) {

        elemento.innerText =
            texto;

    }

}
// ============================================================
// LLEGADA SIN CELULAR
// ============================================================

async function llegadaSinCelular() {

    await registrarLlegada(
        false
    );
}


// ============================================================
// REGISTRAR LLEGADA
// ============================================================

async function registrarLlegada(
    trajoCelular
) {

    try {

        const respuesta =
            await fetch(
                "/api/llegada",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoSeleccionado.id,

                        trajo_celular:
                            trajoCelular

                    })

                }
            );

        const datos =
            await respuesta.json();

        if (!datos.ok) {

            alert(
                datos.mensaje
            );

            return;
        }

        ocultar(
            "esperandoCelularLlegada"
        );

        mostrar(
            "resultadoLlegada"
        );

        cambiarTexto(
            "resultadoLlegada",
            "✓ Llegada registrada a las " +
            datos.hora
        );

    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// RETIRO
// ============================================================

async function cargarListaRetiro() {

    try {

        const respuesta =
            await fetch(
                "/api/alumnos"
            );

        const datos =
            await respuesta.json();

        if (!datos.ok) {
            return;
        }

        alumnos =
            datos.alumnos;

        const lista =
            document.getElementById(
                "listaRetiro"
            );

        lista.innerHTML = "";

        alumnos.forEach(
            function (alumno) {

                if (
                    alumno.se_retiro === 1
                ) {
                    return;
                }

                const boton =
                    document.createElement(
                        "button"
                    );

                boton.className =
                    "alumno-boton";

                boton.innerText =
                    alumno.numero_lista +
                    " - " +
                    alumno.nombre +
                    " " +
                    alumno.apellido;

                boton.onclick =
                    function () {

                        seleccionarAlumnoRetiro(
                            alumno
                        );

                    };

                lista.appendChild(
                    boton
                );

            }
        );

    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// SELECCIONAR RETIRO
// ============================================================

function seleccionarAlumnoRetiro(
    alumno
) {

    alumnoRetiro =
        alumno;

    cambiarTexto(
        "numeroRetiro",
        "Nº " +
        alumno.numero_lista
    );

    cambiarTexto(
        "nombreRetiro",
        alumno.nombre +
        " " +
        alumno.apellido
    );

    cambiarTexto(
        "compartimentoRetiro",
        alumno.compartimento
    );

    ocultar(
        "inicioRetiro"
    );

    mostrar(
        "informacionRetiro"
    );

    mostrar(
        "esperandoHuellaRetiro"
    );

    cambiarTexto(
        "mensajeHuellaRetiro",
        "Coloque la huella del alumno."
    );

    verificarHuellaRetiro();

}


// ============================================================
// HUELLA RETIRO
// ============================================================

async function verificarHuellaRetiro() {

    if (!alumnoRetiro) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/alumno/esperar-huella",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id

                    })

                }
            );

        const datos =
            await respuesta.json();

        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaRetiro",
                datos.mensaje
            );

            return;
        }

        ocultar(
            "esperandoHuellaRetiro"
        );

        mostrar(
            "preguntaRetiro"
        );

    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// RETIRO CON CELULAR
// ============================================================

async function retirarConCelular() {

    if (!alumnoRetiro) {
        return;
    }

    try {

        const apertura =
            await fetch(
                "/api/locker/abrir",
                {
                    method: "POST"
                }
            );

        const datosApertura =
            await apertura.json();

        if (!datosApertura.ok) {

            alert(
                datosApertura.mensaje
            );

            return;
        }

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            true

                    })

                }
            );

        const datos =
            await respuesta.json();

        if (!datos.ok) {

            alert(
                datos.mensaje
            );

            return;
        }

        ocultar(
            "preguntaRetiro"
        );

        mostrar(
            "resultadoRetiro"
        );

        cambiarTexto(
            "resultadoRetiro",
            "✓ Retiro registrado a las " +
            datos.hora
        );

    } catch (error) {

        console.error(error);

        alert(
            "Error de comunicación."
        );

    }
}


// ============================================================
// RETIRO SIN CELULAR
// ============================================================

async function retirarSinCelular() {

    if (!alumnoRetiro) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/retiro",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        alumno_id:
                            alumnoRetiro.id,

                        retiro_celular:
                            false

                    })

                }
            );

        const datos =
            await respuesta.json();

        if (!datos.ok) {

            alert(
                datos.mensaje
            );

            return;
        }

        ocultar(
            "preguntaRetiro"
        );

        mostrar(
            "resultadoRetiro"
        );

        cambiarTexto(
            "resultadoRetiro",
            "✓ Retiro registrado a las " +
            datos.hora
        );

    } catch (error) {

        console.error(error);

    }
}


// ============================================================
// FINALIZAR HORA
// ============================================================

async function finalizarHora() {

    const confirmar =
        confirm(
            "¿Está seguro de que desea finalizar la hora?"
        );

    if (!confirmar) {
        return;
    }

    try {

        const respuesta =
            await fetch(
                "/api/finalizar",
                {
                    method: "POST"
                }
            );

        const datos =
            await respuesta.json();

        if (datos.ok) {

            mostrarPantalla(
                "pantallaLogin"
            );

            cambiarTexto(
                "mensajeLogin",
                "Esperando identificación..."
            );

            const boton =
                document.getElementById(
                    "botonHuella"
                );

            if (boton) {
                boton.disabled = false;
            }

        }

    } catch (error) {

        console.error(error);

        alert(
            "No se pudo finalizar la hora."
        );

    }
}