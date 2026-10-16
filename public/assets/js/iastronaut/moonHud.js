import { drawShell, drawBar, drawWrapped, drawButton } from "./panelCanvas.js";

// Comparte los componentes visuales principales sin depender de su director
// ni de su almacenamiento de progreso.
export function drawMoonMission(ctx, { ready, collected, total = 3, error = "" }) {
    const complete = ready && collected === total;
    const accent = error ? "#FFB454" : complete ? "#59F49B" : "#3FDCFF";
    drawShell(ctx, ctx.canvas.width, ctx.canvas.height, "LUNA / MISION OPCIONAL", accent);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = accent;
    ctx.font = "900 34px system-ui, sans-serif";
    ctx.fillText(error ? "NO SE PUDO CARGAR" : !ready ? "PREPARANDO EXPLORACION" :
        complete ? "MISION COMPLETADA" : "RECOLECCION DE MUESTRAS", 32, 94);
    ctx.fillStyle = "#E8FAFF";
    ctx.font = "750 27px system-ui, sans-serif";
    drawWrapped(ctx, error || (complete ? "Tres muestras recogidas. Puedes seguir explorando." :
        ready ? "Selecciona las rocas con aro azul: clic o gatillo del mando." :
        "Espera mientras se cargan las rocas lunares."), 32, 145, 960, 34, 2);
    drawBar(ctx, 32, 265, 960, collected / total * 100, accent,
        `MUESTRAS RECUPERADAS: ${collected} / ${total}`);
    ctx.fillStyle = "#A9E3F2";
    ctx.font = "700 23px system-ui, sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText("Actividad opcional. No modifica el progreso principal.", 32, 320);
}

export function drawMoonExit(ctx, { busy, hovered, error, immersive = true }) {
    drawShell(ctx, ctx.canvas.width, ctx.canvas.height, "SISTEMA XR", "#FF879C");
    drawButton(ctx, { x: 24, y: 92, w: 592, h: 86 },
        !immersive ? "MODO NAVEGADOR" : busy ? "SALIENDO..." : "SALIR DE VR", true, "#FF879C", busy || !immersive, 32, hovered);
    ctx.fillStyle = "#D8EDF9";
    ctx.font = "700 22px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(!immersive ? "Usa el boton VR inferior para entrar" : error ? "No se pudo salir. Pulsa para reintentar." :
        "VOLVER AL NAVEGADOR", 320, 216);
    ctx.textAlign = "left";
}
