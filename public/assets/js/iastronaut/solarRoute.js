import { SOLAR_MISSION } from "./missionData.js";
import { drawShell } from "./panelCanvas.js";
export function drawSolarRoute({ solarMap, state, director, isHovered, onMoon, activeMoon = false, t = 0 }) {
        const { ctx, canvas, texture } = solarMap;
        drawShell(ctx, canvas.width, canvas.height, "RUTA HOLOGRÁFICA", state.current.accent);
        solarMap.hitZones = [];
        const startX = 108;
        const gap = 148;
        const y = 170;
        let nextIndex = -1;
        if (state.task.completed) {
            for (let i = 1; i < SOLAR_MISSION.length; i++) {
                if (!state.completed.has(SOLAR_MISSION[i].id) && director.isUnlocked(i)) {
                    nextIndex = i;
                    break;
                }
            }
        }
        ctx.strokeStyle = "rgba(75, 206, 239, 0.30)";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(startX + gap * (SOLAR_MISSION.length - 1), y);
        ctx.stroke();
        if (nextIndex >= 0) {
            const routeStart = startX + gap * state.currentIndex;
            const routeEnd = startX + gap * nextIndex;
            ctx.save();
            ctx.shadowColor = "rgba(255,184,77,0.9)";
            ctx.shadowBlur = 24;
            ctx.strokeStyle = "#FFB84D";
            ctx.lineWidth = 10;
            ctx.beginPath();
            ctx.moveTo(routeStart, y);
            ctx.lineTo(routeEnd, y);
            ctx.stroke();
            ctx.restore();
        }
        for (let i = 0; i < SOLAR_MISSION.length; i++) {
            const item = SOLAR_MISSION[i];
            const x = startX + gap * i;
            const unlocked = director.isUnlocked(i);
            const done = state.completed.has(item.id);
            const active = !activeMoon && i === state.currentIndex;
            const next = i === nextIndex;
            const hovered = isHovered(solarMap, "destination", i);
            if (next) {
                const pulse = 1 + Math.sin(t * 2.1) * 0.07;
                ctx.save();
                ctx.shadowColor = "rgba(255,184,77,0.95)";
                ctx.shadowBlur = 34;
                ctx.strokeStyle = "#FFB84D";
                ctx.lineWidth = 7;
                ctx.beginPath();
                ctx.arc(x, y, 40 * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.strokeStyle = "rgba(255,218,157,0.78)";
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(x, y, 51 * pulse, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
                ctx.fillStyle = "#FFD89B";
                ctx.font = "900 21px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
                ctx.textAlign = "center";
                ctx.fillText("SIGUIENTE DESTINO", x, y - 62);
                ctx.fillStyle = "#FFB84D";
                ctx.beginPath();
                ctx.moveTo(x, y - 42);
                ctx.lineTo(x - 9, y - 56);
                ctx.lineTo(x + 9, y - 56);
                ctx.closePath();
                ctx.fill();
            }
            if (hovered || active) {
                ctx.save();
                ctx.shadowColor = hovered ? "rgba(255,255,255,0.95)" : item.accent;
                ctx.shadowBlur = hovered ? 30 : 20;
                ctx.strokeStyle = hovered ? "#FFFFFF" : item.accent;
                ctx.lineWidth = hovered ? 7 : 5;
                ctx.beginPath();
                ctx.arc(x, y, active ? 34 + Math.sin(t * 2.3) * 2 : 34, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            ctx.save();
            if (next) {
                ctx.shadowColor = "rgba(255,184,77,0.92)";
                ctx.shadowBlur = 24;
            }
            ctx.fillStyle = unlocked ? item.accent : "#405865";
            ctx.beginPath();
            ctx.arc(x, y, next ? (item.id === "sun" ? 28 : 24) : item.id === "sun" ? 22 : 17, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
            if (done) {
                ctx.strokeStyle = "#5CFF9D";
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(x, y, next ? 33 : 27, 0, Math.PI * 2);
                ctx.stroke();
            }
            ctx.fillStyle = hovered || next ? "#FFFFFF" : unlocked ? "#E8FAFF" : "#6E838D";
            ctx.font = `${next ? "900 23px" : "800 21px"} ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
            ctx.textAlign = "center";
            ctx.fillText(item.name.toUpperCase(), x, y + 52);
            solarMap.hitZones.push({ type: "destination", index: i, circle: { x, y, r: next ? 56 : 45 } });
        }
        const sidequests = [
            ["LUNA", "", true], ["CORONA", "SOLAR", false],
            ["PLUT\u00d3N", "", false], ["ESTACI\u00d3N", "ESPACIAL", false],
            ["CINTUR\u00d3N", "PRINCIPAL", false], ["EUROPA", "", false],
            ["TIT\u00c1N", "", false], ["COMETA", "", false],
            ["CINTUR\u00d3N", "DE KUIPER", false]
        ];
        sidequests.forEach(([label, secondLine, ready], i) => {
            const x = startX + gap * i;
            const unlocked = state.completed.has(SOLAR_MISSION[i].id);
            const enabled = ready && unlocked && !!onMoon && !state.traveling;
            const selectable = ready && !!onMoon && !state.traveling;
            const hovered = selectable && isHovered(solarMap, "moon", "");
            ctx.strokeStyle = unlocked ? "#78E8FF" : "#405865";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y + 65); ctx.lineTo(x, 320); ctx.stroke();
            ctx.fillStyle = enabled ? "#78E8FF" : "#405865";
            ctx.beginPath(); ctx.arc(x, 345, 23, 0, Math.PI * 2); ctx.fill();
            if (hovered || (activeMoon && i === 0)) {
                ctx.strokeStyle = "#FFFFFF"; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.arc(x, 345, 30, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillStyle = enabled ? "#E8FAFF" : "#93A8B2";
            ctx.font = "800 20px ui-monospace, monospace";
            ctx.fillText(label, x, 380);
            if (secondLine) ctx.fillText(secondLine, x, 404);
            ctx.font = "700 15px ui-monospace, monospace";
            ctx.fillStyle = enabled ? "#65F2A0" : "#93A8B2";
            ctx.fillText(!ready ? "PR\u00d3XIMAMENTE" : activeMoon && i === 0 ? "ACTUAL" : unlocked ? "DISPONIBLE" : "BLOQUEADA", x, 441);
            if (selectable) solarMap.hitZones.push({type: "moon", rect: {x: x - 62, y: 315, w: 124, h: 150}});
        });
        ctx.textAlign = "left";
        texture.needsUpdate = true;
    }
