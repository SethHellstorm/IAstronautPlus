# IAstronaut VR

IAstronaut VR es una experiencia web inmersiva de exploración del Sistema Solar construida con **PHP**, **Three.js** y **WebXR**. El usuario participa en la **Operación Helios**, una campaña interactiva en la que debe restaurar una red de balizas científicas mientras recibe asistencia por voz de IAstronaut, la oficial científica de la misión.

La aplicación puede utilizarse desde escritorio, dispositivos táctiles y visores compatibles con WebXR. La interfaz principal se renderiza dentro de la escena 3D y combina conversación por voz, paneles flotantes, navegación entre destinos y actividades que requieren apuntar, hacer clic, analizar lecturas o completar secuencias.

## Funcionalidades actuales

- Escena espacial 3D renderizada con Three.js.
- Modo inmersivo WebXR con controladores y seguimiento de manos.
- Campaña con progreso persistente entre sesiones.
- Nueve destinos: Tierra, Sol, Mercurio, Venus, Marte, Júpiter, Saturno, Urano y Neptuno.
- Paneles de control de vuelo, misión, ciencia y bitácora.
- Sonda visual que señala objetivos y comunica el estado de la operación.
- Conversación por voz.
- Contexto de misión enviado al asistente para obtener respuestas y pistas relacionadas con el estado actual.
- Órdenes de voz capaces de iniciar operaciones, navegar, abrir paneles o señalar objetivos.
- Controles adaptados para mouse, pantalla táctil, controladores XR y gestos.

## Requisitos

### Servidor

- PHP **8.0 o superior**.
- Extensión PHP **cURL** habilitada.
- Acceso HTTPS saliente a `api.openai.com`.
- Una clave válida de la API de OpenAI.

### Navegador

- Navegador moderno con WebGL, ES Modules y Canvas 2D.
- `MediaRecorder`, `getUserMedia` y Web Audio para conversación por voz.
- Contexto seguro HTTPS para usar el micrófono, excepto en `localhost`.
- Compatibilidad con sesiones `immersive-vr` para entrar en modo VR.
- Visor compatible, como Meta Quest, para controladores XR o seguimiento de manos.

## Uso

1. Abre la aplicación y revisa el panel **Control de vuelo**.
2. Selecciona **Iniciar operación** para desplegar la sonda y mostrar los objetivos del destino actual.
3. Gira la vista hasta localizar los objetivos distribuidos alrededor de la posición del usuario.
4. Apunta al objetivo y haz clic una vez para ejecutar la acción.
5. Sigue las instrucciones de IAstronaut y de las burbujas situadas junto a cada objetivo.
6. Completa la actividad para desbloquear el siguiente destino.
7. Usa los paneles de ciencia y bitácora para consultar datos y revisar el avance.

### Órdenes de voz disponibles

IAstronaut reconoce frases equivalentes a las siguientes:

- “Inicia la operación”.
- “Señala el siguiente objetivo”.
- “Repite las instrucciones”.
- “Abre la bitácora”.
- “Muestra el objetivo”.
- “Viaja al siguiente destino”.
- “Regresa al destino anterior”.
- “Vuelve a casa”.
- “Compara con la Tierra”.

El asistente también responde preguntas relacionadas con astronomía, exploración espacial, tecnología y el estado de la misión.

## Controles

### Escritorio

- **Clic:** completar una interacción de misión.
- **Clic:** activar botones y paneles.
- **MOVER + arrastrar:** desplazar el conjunto de paneles.
- **Rueda sobre el chat:** desplazar la conversación.
- **Shift + rueda:** acercar o alejar el panel.
- **Clic derecho + arrastrar:** cambiar la dirección de la vista.
- **Shift + arrastrar:** alternativa para cambiar la dirección de la vista.
- **RECALIBRAR:** recentrar los paneles frente a la cámara.

### Dispositivos táctiles

- **Toque:** activar botones y seleccionar elementos.
- **Arrastrar fuera de los paneles:** cambiar la dirección de la vista.
- **Arrastrar dentro del chat:** desplazar la conversación.
- **Gesto con dos dedos:** modificar la distancia del panel.

### VR / WebXR

- **Gatillo:** seleccionar botones y objetivos de misión.
- **Rayo del controlador:** apuntar a paneles y objetivos.
- **Arrastrar dentro del chat:** desplazar mensajes.
- **Joystick vertical sobre el chat:** desplazar mensajes.
- **Pinza con pulgar e índice:** interactuar mediante seguimiento de manos.
- **SALIR DE VR:** terminar la sesión inmersiva y volver al navegador.

## Licencia
GPLv3