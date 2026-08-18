// ============================================================
// SISTEMA DE LOCKER
// JAVASCRIPT
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

        cargarAlumnos();

    }
);


// ============================================================
// MOSTRAR PANTALLA
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


    // ------------------------------------------
    // Acciones específicas
    // ------------------------------------------

    if (id === "pantallaAsistencia") {

        cargarAlumnos();

    }

    if (id === "pantallaLlegada") {

        cargarAusentes();

    }

    if (id === "pantallaRetiro") {

        reiniciarRetiro();

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


    boton.disabled = true;

    mensaje.innerText =
        "Coloque el dedo en el lector...";


    try {

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

            mensaje.innerText =
                datos.mensaje ||
                "Huella no reconocida.";

            boton.disabled = false;

            return;

        }


        mensaje.innerText =
            "✓ Huella reconocida. Locker abierto.";


        activarLED(
            "ledLogin"
        );


        setTimeout(
            function () {

                boton.disabled = false;

                mostrarPantalla(
                    "pantallaMenu"
                );

            },
            1000
        );


    } catch (error) {

        console.error(error);

        mensaje.innerText =
            "Error de comunicación con la Raspberry Pi.";

        boton.disabled = false;

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

            return;

        }


        alumnos =
            datos.alumnos || [];


        alumnoActual = 0;


        if (
            document.getElementById(
                "pantallaAsistencia"
            ).style.display !== "none"
        ) {

            mostrarAlumno();

        }


    } catch (error) {

        console.error(error);

    }

}


// ============================================================
// MOSTRAR ALUMNO
// ============================================================

function mostrarAlumno() {

    if (
        alumnoActual >=
        alumnos.length
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


    mostrar(
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

    ocultar(
        "listaTerminada"
    );

}


// ============================================================
// AUSENTE
// ============================================================

async function marcarAusente() {

    const alumno =
        alumnos[alumnoActual];


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

                    body:
                        JSON.stringify({
                            alumno_id:
                                alumno.id
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


        siguienteAlumno();


    } catch (error) {

        console.error(error);

        alert(
            "Error al registrar ausencia."
        );

    }

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
// TRAJO CELULAR
// ============================================================

function trajoCelular() {

    const alumno =
        alumnos[alumnoActual];


    cambiarTexto(
        "numeroCompartimento",
        alumno.compartimento || "-"
    );


    ocultar(
        "preguntaCelular"
    );

    mostrar(
        "esperandoCelular"
    );


    cambiarTexto(
        "mensajeCelular",
        "Coloque el celular y presione el botón."
    );


    esperarBotonCelular(
        alumno
    );

}


// ============================================================
// ESPERAR BOTÓN CELULAR
// ============================================================

async function esperarBotonCelular(
    alumno
) {

    try {

        const respuesta =
            await fetch(
                "/api/celular/esperar-boton",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

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
                datos.mensaje
            );

            return;

        }


        cambiarTexto(
            "mensajeCelular",
            "✓ Celular registrado correctamente."
        );


        activarLED(
            "ledConfirmacion"
        );


        setTimeout(
            siguienteAlumno,
            1200
        );


    } catch (error) {

        console.error(error);

        cambiarTexto(
            "mensajeCelular",
            "Error de comunicación."
        );

    }

}


// ============================================================
// SIN CELULAR
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
        "Coloque su huella en el lector."
    );


    verificarHuellaAlumno();

}


// ============================================================
// HUELLA ALUMNO
// ============================================================

async function verificarHuellaAlumno() {

    const alumno =
        alumnos[alumnoActual];


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
                "mensajeHuella",
                datos.mensaje
            );

            return;

        }


        if (
            !datos.alumno_id
        ) {

            cambiarTexto(
                "mensajeHuella",
                "Huella reconocida, pero no está asociada a un alumno."
            );

            return;

        }


        if (
            datos.alumno_id !==
            alumno.id
        ) {

            cambiarTexto(
                "mensajeHuella",
                "La huella no corresponde al alumno."
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

                    body:
                        JSON.stringify({

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

        cambiarTexto(
            "mensajeHuella",
            "Error de comunicación."
        );

    }

}


// ============================================================
// SIGUIENTE
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
// LLEGADA TARDE
// ============================================================

async function cargarAusentes() {

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
                "listaAusentes"
            );


        lista.innerHTML =
            "<h2>Seleccione el alumno</h2>";


        alumnos.forEach(
            function (alumno) {

                // Solo alumnos que no figuran presentes
                if (
                    Number(
                        alumno.presente
                    ) === 1
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


    cambiarTexto(
        "nombreSeleccionado",
        alumno.nombre +
        " " +
        alumno.apellido
    );


    cambiarTexto(
        "numeroSeleccionado",
        alumno.numero_lista
    );


    ocultar(
        "listaAusentes"
    );


    mostrar(
        "alumnoSeleccionado"
    );


    mostrar(
        "esperandoHuellaLlegada"
    );


    cambiarTexto(
        "mensajeHuellaLlegada",
        "Coloque la huella del alumno."
    );

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
                "/api/alumno/esperar-huella",
                {
                    method: "POST"
                }
            );


        const datos =
            await respuesta.json();


        if (!datos.ok) {

            cambiarTexto(
                "mensajeHuellaLlegada",
                datos.mensaje
            );

            return;

        }


        if (
            !datos.alumno_id ||
            datos.alumno_id !==
            alumnoSeleccionado.id
        ) {

            cambiarTexto(
                "mensajeHuellaLlegada",
                "La huella no corresponde al alumno."
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


    cambiarTexto(
        "numeroCompartimentoLlegada",
        alumnoSeleccionado.compartimento || "-"
    );


    ocultar(
        "preguntaCelularLlegada"
    );


    mostrar(
        "esperandoCelularLlegada"
    );


    try {

        const respuesta =
            await fetch(
                "/api/celular/esperar-boton",
                {

                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

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

                    body:
                        JSON.stringify({

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

        ocultar(
            "preguntaCelularLlegada"
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

function reiniciarRetiro() {

    alumnoRetiro = null;

    mostrar(
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

}


// ============================================================
// INICIAR RETIRO
// ============================================================

async function iniciarRetiro() {

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
                datos.mensaje
            );

            return;

        }


        if (!datos.alumno_id) {

            cambiarTexto(
                "mensajeHuellaRetiro",
                "Huella reconocida, pero no asociada."
            );

            return;

        }


        alumnoRetiro =
            datos;


        cambiarTexto(
            "nombreRetiro",
            datos.nombre +
            " " +
            datos.apellido
        );


        cambiarTexto(
            "numeroRetiro",
            datos.numero_lista
        );


        cambiarTexto(
            "compartimentoRetiro",
            datos.compartimento || "-"
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
            "Error de comunicación."
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

                    body:
                        JSON.stringify({

                            alumno_id:
                                alumnoRetiro.alumno_id,

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

                    body:
                        JSON.stringify({

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


function activarLED(id) {

    const led =
        document.getElementById(id);


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
        2000
    );

}