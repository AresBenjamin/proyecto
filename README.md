# proyecto
Sistema de Locker Escolar con Control de Asistencia

Sistema automatizado para gestionar el almacenamiento de celulares de los alumnos y llevar el control de asistencia, llegadas tarde y retiros mediante una Raspberry Pi 3.

El proyecto utiliza:

Python 3
Flask
SQLite
HTML5
CSS3
JavaScript
RPi.GPIO
DigitalPersona 4500
Raspberry Pi 3
1. Instalación de Python

El proyecto está pensado para ejecutarse principalmente en una Raspberry Pi 3 con Linux.

Actualizar la Raspberry Pi

Abrir una terminal y ejecutar:

sudo apt update
sudo apt upgrade -y
Instalar Python y pip
sudo apt install python3 python3-pip -y

Verificar que Python se haya instalado correctamente:

python3 --version

También se puede verificar pip con:

pip3 --version
2. Descargar el proyecto

Para descargar el proyecto desde GitHub, primero hay que tener instalado Git.

sudo apt install git -y

Luego clonar el repositorio:

git clone https://github.com/usuario/link.git

Reemplazar https://github.com/usuario/link.git por el enlace real del repositorio.

Entrar en la carpeta del proyecto:

cd locker
3. Instalar las librerías necesarias

Antes de ejecutar el programa se deben instalar las librerías utilizadas por el proyecto.

Flask

Flask se utiliza para crear el servidor web y las API que permiten la comunicación entre JavaScript y Python.

Instalar mediante:

pip3 install flask
RPi.GPIO

RPi.GPIO se utiliza para controlar los componentes conectados a los GPIO de la Raspberry Pi, como los LEDs, botones y relé.

Instalar mediante:

sudo apt install python3-rpi.gpio -y
Librerías que no necesitan instalación

Las siguientes librerías forman parte de Python y no necesitan descargarse:

sqlite3
datetime
time

Por lo tanto, no es necesario instalarlas mediante pip.

Resumen de librerías
Librería	Instalación
Python 3	sudo apt install python3
pip3	sudo apt install python3-pip
Flask	pip3 install flask
RPi.GPIO	sudo apt install python3.rpi.gpio
sqlite3	Incluida con Python
datetime	Incluida con Python
time	Incluida con Python
4. Verificar las instalaciones
Verificar Flask

Ejecutar:

python3 -c "import flask; print('Flask OK')"

Si está instalado correctamente, debería aparecer:

Flask OK
Verificar RPi.GPIO

Ejecutar:

python3 -c "import RPi.GPIO; print('RPi.GPIO OK')"

Si está instalado correctamente:

RPi.GPIO OK
Funcionamiento general

El sistema utiliza una Raspberry Pi 3 como controlador principal. Se encarga de gestionar la interfaz web, registrar la información en la base de datos y controlar los componentes físicos del locker.

El funcionamiento comienza con la identificación del profesor o preceptor mediante huella digital. Una vez autorizado, el sistema permite acceder al menú principal y utilizar las opciones de:

Tomar asistencia.
Registrar llegadas tarde.
Registrar retiros.
Finalizar la hora.
Toma de asistencia

Durante la toma de lista, el sistema recorre los alumnos registrados y permite marcar cada uno como presente o ausente.

Si un alumno está presente, se verifica si llevó celular. En caso afirmativo, se utiliza su huella para identificarlo y se asigna un compartimento disponible. El alumno coloca el celular y presiona el botón correspondiente. El sistema registra la operación y enciende el LED del compartimento como confirmación.

Si no llevó celular, puede utilizar su huella como firma para confirmar su asistencia.

Llegadas tarde

Si un alumno llega tarde, se selecciona desde el sistema y se verifica su identidad mediante huella.

El sistema registra automáticamente la hora de llegada y actualiza su estado de asistencia. Si lleva celular, se le asigna su compartimento correspondiente.

Retiro

Para retirarse, el alumno coloca su huella y el sistema lo identifica.

Si tiene un celular almacenado, se identifica su compartimento, se retira el celular y se libera el espacio. También se registra la hora de salida.

Si no tiene celular guardado, simplemente se registra el retiro y la hora correspondiente.

Gestión del locker

El locker cuenta con cuatro compartimentos, cada uno equipado con:

Un LED verde.
Un botón físico.

Los botones permiten confirmar la colocación de los celulares y los LEDs indican visualmente que la operación fue realizada correctamente.

Un relé controla la apertura del locker y es accionado por la Raspberry Pi.

Registro de información

Toda la información importante del sistema se almacena en una base de datos SQLite (locker.db), incluyendo alumnos, usuarios, asistencia, llegadas, retiros, celulares y compartimentos asignados.

La comunicación entre la interfaz y el sistema se realiza mediante:

HTML + CSS + JavaScript
          ↓
       Flask
          ↓
       Python
       ↙     ↘
   SQLite     GPIO
              ↓
      Relé + LEDs + Botones
Elementos necesarios
Software
Raspberry Pi OS.
Python 3.
Flask.
RPi.GPIO.
SQLite.
HTML5.
CSS3.
JavaScript.

Las librerías sqlite3, datetime y time ya forman parte de Python.

Hardware
1 Raspberry Pi 3.
1 lector de huellas DigitalPersona 4500 con conexión USB.
1 relé compatible con Raspberry Pi.
4 LEDs verdes.
4 resistencias adecuadas para los LEDs.
4 botones físicos.
1 locker con 4 compartimentos.
Cables y elementos necesarios para realizar las conexiones.
Fuente de alimentación adecuada para los componentes que la requieran.
Conexiones GPIO
Componentes GPIO:

| Componente            | GPIO |
|-----------------------|------|
| Relé                  | GPIO 17 |
| LED compartimento 1   | GPIO 18 |
| LED compartimento 2   | GPIO 23 |
| LED compartimento 3   | GPIO 24 |
| LED compartimento 4   | GPIO 25 |
| Botón 1               | GPIO 5 |
| Botón 2               | GPIO 6 |
| Botón 3               | GPIO 13 |
| Botón 4               | GPIO 19 |

Los GPIO de la Raspberry Pi trabajan a 3,3 V. El relé y los LEDs deben conectarse utilizando los componentes de protección y resistencias correspondientes.

Resumen

El sistema centraliza la asistencia y gestión de celulares mediante una Raspberry Pi 3. El profesor o preceptor se identifica con huella, los alumnos también utilizan su huella para identificarse y el locker administra automáticamente los cuatro compartimentos disponibles.

La Raspberry Pi registra toda la información en SQLite y controla el relé, los LEDs y los botones, mientras que la interfaz web permite gestionar las diferentes operaciones del sistema.
