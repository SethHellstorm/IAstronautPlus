# IAstronauta VR

IAstronauta VR es una experiencia web inmersiva construida con **PHP**, **Three.js** y **WebXR**. Presenta una asistente astronauta en un entorno espacial 3D/VR que responde preguntas sobre el espacio mediante voz o texto, reproduce respuestas con audio generado por IA.

## Características principales

- Escena 3D espacial con Three.js.
- Soporte WebXR para experiencias VR compatibles.
- Panel flotante de conversación dentro de la escena.
- Interacción con mouse, touch, controladores VR y hand tracking.
- Entrada por micrófono
- Detección de voz/silencio para conversación manos libres.
- Transcripción de audio con OpenAI STT.
- Respuestas conversacionales con modelo de chat de OpenAI.
- Voz sintetizada con OpenAI TTS.
- Búsqueda de imágenes espaciales.

## Stack tecnológico

- **Backend:** PHP 8+
- **Frontend:** JavaScript ES Modules
- **3D / VR:** Three.js `0.160.0` + WebXR
- **IA:** OpenAI Chat, STT y TTS
- **Imágenes:** Wikimedia Commons API
- **Dependencias PHP:** `vlucas/phpdotenv`

## Requisitos

- PHP **8.0 o superior**.
- Extensión PHP **cURL** habilitada.
- Composer, si deseas reinstalar dependencias.
- Una API key de OpenAI.
- Navegador moderno.
- HTTPS para usar micrófono y WebXR en producción.
- Dispositivo compatible con WebXR para modo VR, por ejemplo Meta Quest u otro visor compatible.

## Configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/franciscocervera/iastronauta.git
cd iastronauta
```

### 2. Configurar variables de entorno

Crea un archivo `.env` en la raíz del proyecto:

```env
OPENAI_API_KEY=tu_api_key_de_openai
```

### 3. Instalar dependencias PHP

El proyecto incluye `composer.json` dentro de `public/assets`:

```bash
cd public/assets
composer install
cd ../..
```

Si el directorio `vendor/` ya viene incluido, este paso puede no ser necesario, pero para un repositorio limpio se recomienda instalar dependencias con Composer en lugar de versionar `vendor/`.

### 4. Ejecutar en desarrollo

Desde la raíz del proyecto:

```bash
php -S localhost:8000 -t public
```

## Uso

1. Abre la aplicación en el navegador.
2. Presiona **Hablar** para activar el micrófono.
3. Formula una pregunta sobre astronomía, el universo, misiones espaciales o vida en la ISS.
4. La app transcribe tu voz, consulta el modelo de OpenAI y responde en el panel.
5. Si se solicita audio, la respuesta se reproduce con voz generada por IA.
6. Si pides imágenes, la app busca recursos relacionados en Wikimedia Commons.

## Controles

### Escritorio

- Click en **Hablar** para activar o detener el micrófono.
- Click en **Centrar** para recentrar el panel.
- Click en **Salir** para abandonar la experiencia.
- Arrastra el área lateral del panel para moverlo.
- Usa la rueda del mouse para hacer scroll en el chat.
- Usa `Shift + rueda` para acercar o alejar el panel.

### Móvil

- Touch sobre el panel para interactuar.
- Gestos táctiles para mover, hacer scroll y ajustar la vista.
- Requiere navegador compatible y permisos de micrófono.

### VR / WebXR

- Usa el botón de VR.
- Apunta al panel con el controlador y selecciona botones.
- Usa controladores para arrastrar o hacer scroll.
- Con hand tracking, usa gesto de pinch para interactuar con el chat.

## Licencia

```text
GPLv3
```
