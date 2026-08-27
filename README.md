# Sistema
# 🔐 Proyecto
Sistema de Locker Escolar con Control de Asistencia

Sistema automatizado para gestionar el almacenamiento de celulares de los alumnos y llevar el control de asistencia, llegadas tarde y retiros mediante una Raspberry Pi 3.

## 🛠️ Tecnologías utilizadas
Python 3
Flask
SQLite
HTML5
CSS3
JavaScript
RPi.GPIO
DigitalPersona 4500
Raspberry Pi 3
### 🚀 Instalación
1. Instalación de Python

El proyecto está pensado para ejecutarse principalmente en una Raspberry Pi 3 con Linux.

Actualizar la Raspberry Pi

Abrir una terminal y ejecutar:

sudo apt update
sudo apt upgrade -y
Instalar Python y pip
sudo apt install python3 python3-pip -y

#### Verificar que Python se haya instalado correctamente:

python3 --version

También se puede verificar pip con:

pip3 --version
2. Descargar el proyecto

Para descargar el proyecto desde GitHub, primero hay que tener instalado Git.

sudo apt install git -y

Luego clonar el repositorio:

git clone github.com/AresBenjamin/proyecto

Entrar en la carpeta del proyecto:
cd locker

### 3. Instalar las librerías necesarias

Antes de ejecutar el programa se deben instalar las librerías utilizadas por el proyecto.

## Flask

Flask se utiliza para crear el servidor web y las API que permiten la comunicación entre JavaScript y Python.

Instalar mediante:

pip3 install flask
RPi.GPIO

RPi.GPIO se utiliza para controlar los componentes conectados a los GPIO de la Raspberry Pi, como los LEDs, botones y relé.

Instalar mediante:

sudo apt install python3.rpi-gpio -y
Librerías que no necesitan instalación

Las siguientes librerías forman parte de Python y no necesitan descargarse:

sqlite3
datetime
time

Por lo tanto, no es necesario instalarlas mediante pip.

### 📦 Resumen de librerías

| Librería  | Instalación |
|-----------|-------------|
| Python 3  | `sudo apt install python3` |
| pip3      | `sudo apt install python3-pip` |
| Flask     | `pip3 install flask` |
| RPi.GPIO  | `sudo apt install python3.rpi-gpio` |
| sqlite3   | Incluida con Python |
| datetime  | Incluida con Python |
| time      | Incluida con Python |



### Hardware

| Componente | Cantidad |
|------------|----------|
| Raspberry Pi 3 | 1 |
| Lector de huellas DigitalPersona 4500 con conexión USB | 1 |
| Relé compatible con Raspberry Pi | 1 |
| LEDs verdes | 4 |
| Resistencias adecuadas para los LEDs | 4 |
| Botones físicos | 4 |
| Locker con 4 compartimentos | 1 |
| Cables y elementos necesarios para realizar las conexiones | — |
| Fuente de alimentación adecuada para los componentes que la requieran | — |


### 📌 Conexiones GPIO

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

# Resumen

El sistema centraliza la asistencia y gestión de celulares mediante una Raspberry Pi 3. El profesor o preceptor se identifica con huella, los alumnos también utilizan su huella para identificarse y el locker administra automáticamente los cuatro compartimentos disponibles.

La Raspberry Pi registra toda la información en SQLite y controla el relé, los LEDs y los botones, mientras que la interfaz web permite gestionar las diferentes operaciones del sistema.
