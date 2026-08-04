export const MISSION_OPERATIONS = Object.freeze({
    earth: {
        title: "CALIBRACIÓN ORBITAL",
        tool: "Matriz de navegación",
        briefing: "Activa las tres balizas de calibración en el orden indicado para sincronizar la sonda y habilitar el lanzamiento.",
        hint: "Mantén el puntero sobre cada baliza y presiona el gatillo hasta completar el enlace.",
        success: "Calibración terminada. La sonda está sincronizada y la ruta hacia el Sol está disponible.",
        type: "sequence",
        sequence: ["earth-nav", "earth-probe", "earth-route"],
        targets: [
            { id: "earth-nav", label: "01 · NAVEGACIÓN", detail: "Alinear coordenadas orbitales", kind: "beacon", hold: 0.8, position: [-0.9, 0.35, 0] },
            { id: "earth-probe", label: "02 · SONDA", detail: "Sincronizar enlace de datos", kind: "probe", hold: 0.8, position: [0, 0.8, 0.08] },
            { id: "earth-route", label: "03 · RUTA SOL", detail: "Confirmar trayectoria de salida", kind: "waypoint", hold: 0.8, position: [0.9, 0.35, 0] }
        ]
    },
    sun: {
        title: "PROTOCOLO DE LLAMARADA",
        tool: "Escudos radiométricos",
        briefing: "Una llamarada se aproxima. Activa los tres escudos en secuencia antes de que la radiación alcance la sonda.",
        hint: "Sigue la numeración de los escudos. La ventana de protección es limitada.",
        success: "Escudos estabilizados. La sonda registró la actividad de la fotosfera sin daños.",
        type: "sequence",
        sequence: ["sun-shield-a", "sun-shield-b", "sun-shield-c"],
        event: { label: "IMPACTO DE RADIACIÓN", duration: 55, resetOnTimeout: true },
        targets: [
            { id: "sun-shield-a", label: "ESCUDO 01", detail: "Canal térmico", kind: "shield", hold: 0.9, position: [-1.0, 0.3, 0] },
            { id: "sun-shield-b", label: "ESCUDO 02", detail: "Canal magnético", kind: "shield", hold: 0.9, position: [0, 0.85, 0.08] },
            { id: "sun-shield-c", label: "ESCUDO 03", detail: "Canal de partículas", kind: "shield", hold: 0.9, position: [1.0, 0.3, 0] }
        ]
    },
    mercury: {
        title: "MAPA TÉRMICO",
        tool: "Escáner infrarrojo",
        briefing: "Analiza las tres regiones y vuelve a seleccionar la zona con menor temperatura para desplegar la baliza.",
        hint: "Cada región revela su lectura al completar el escaneo. Después vuelve a seleccionar la temperatura más baja.",
        selectionPrompt: "SELECCIONA DE NUEVO LA REGIÓN CON LA TEMPERATURA MÁS BAJA",
        retryPrompt: "REVISA LAS TRES TEMPERATURAS Y ELIGE LA MÁS BAJA",
        success: "Zona térmica segura localizada. La baliza quedó protegida de la radiación directa.",
        type: "survey",
        correctTarget: "mercury-cold",
        event: { label: "VENTANA TÉRMICA", duration: 90, resetOnTimeout: false },
        targets: [
            { id: "mercury-hot", label: "REGIÓN A", detail: "TEMPERATURA +421 °C", hiddenDetail: true, kind: "scan", hold: 1.1, position: [-1.05, 0.25, 0] },
            { id: "mercury-mid", label: "REGIÓN B", detail: "TEMPERATURA +88 °C", hiddenDetail: true, kind: "scan", hold: 1.1, position: [0, 0.9, 0.08] },
            { id: "mercury-cold", label: "REGIÓN C", detail: "TEMPERATURA −171 °C", hiddenDetail: true, kind: "scan", hold: 1.1, position: [1.05, 0.25, 0] }
        ]
    },
    venus: {
        title: "ANÁLISIS ATMOSFÉRICO",
        tool: "Colector espectral",
        briefing: "Recoge las muestras en el orden indicado para reconstruir el perfil atmosférico de Venus.",
        hint: "Primero el gas dominante, después el gas secundario y al final el aerosol de las nubes.",
        success: "Perfil atmosférico reconstruido. La sonda confirmó un efecto invernadero extremo.",
        type: "sequence",
        sequence: ["venus-co2", "venus-n2", "venus-acid"],
        targets: [
            { id: "venus-co2", label: "01 · CO₂", detail: "Gas dominante", kind: "sample", hold: 0.9, position: [-0.95, 0.35, 0] },
            { id: "venus-n2", label: "02 · N₂", detail: "Gas secundario", kind: "sample", hold: 0.9, position: [0, 0.9, 0.08] },
            { id: "venus-acid", label: "03 · H₂SO₄", detail: "Aerosoles de las nubes", kind: "sample", hold: 0.9, position: [0.95, 0.35, 0] }
        ]
    },
    mars: {
        title: "RADAR DE SUBSUELO",
        tool: "Radar de penetración",
        briefing: "Escanea las tres zonas y selecciona la que contiene la señal de hielo más intensa.",
        hint: "La lectura correcta combina alta reflectividad y señal de hielo. Después vuelve a seleccionar el mejor sector.",
        selectionPrompt: "SELECCIONA DE NUEVO EL SECTOR CON MAYOR REFLECTIVIDAD Y SEÑAL DE HIELO",
        retryPrompt: "COMPARA LAS REFLECTIVIDADES Y ELIGE EL SECTOR QUE CONTIENE HIELO",
        success: "Depósito de hielo localizado. La zona fue registrada como recurso para futuras misiones.",
        type: "survey",
        correctTarget: "mars-ice",
        targets: [
            { id: "mars-dry", label: "SECTOR A", detail: "REFLECTIVIDAD 18 % · ROCA SECA", hiddenDetail: true, kind: "scan", hold: 1.1, position: [-1.05, 0.25, 0] },
            { id: "mars-ice", label: "SECTOR B", detail: "REFLECTIVIDAD 82 % · SEÑAL DE HIELO", hiddenDetail: true, kind: "scan", hold: 1.1, position: [0, 0.9, 0.08] },
            { id: "mars-rock", label: "SECTOR C", detail: "REFLECTIVIDAD 41 % · ROCA", hiddenDetail: true, kind: "scan", hold: 1.1, position: [1.05, 0.25, 0] }
        ]
    },
    jupiter: {
        title: "CORREDOR DE TORMENTA",
        tool: "Sonda atmosférica",
        briefing: "Guía la sonda a través de los tres puntos de navegación para bordear la Gran Mancha Roja.",
        hint: "Activa los puntos en orden. Una ruta incorrecta desestabiliza la sonda.",
        success: "Trayectoria completada. La sonda recuperó datos de presión y velocidad de los vientos.",
        type: "sequence",
        sequence: ["jupiter-gate-a", "jupiter-gate-b", "jupiter-gate-c"],
        event: { label: "ESTABILIDAD DE SONDA", duration: 65, resetOnTimeout: true },
        targets: [
            { id: "jupiter-gate-a", label: "PUNTO 01", detail: "Entrada superior", kind: "waypoint", hold: 0.7, position: [-1.05, 0.55, 0] },
            { id: "jupiter-gate-b", label: "PUNTO 02", detail: "Borde de tormenta", kind: "waypoint", hold: 0.7, position: [0, 0.05, 0.08] },
            { id: "jupiter-gate-c", label: "PUNTO 03", detail: "Canal de salida", kind: "waypoint", hold: 0.7, position: [1.05, 0.65, 0] }
        ]
    },
    saturn: {
        title: "RESONANCIA DE ANILLOS",
        tool: "Analizador de frecuencias",
        briefing: "Sintoniza las tres bandas de los anillos desde la frecuencia más baja hasta la más alta.",
        hint: "Selecciona 42 kHz, después 68 kHz y finalmente 94 kHz.",
        success: "Resonancia sincronizada. Se identificó una separación dinámica entre las bandas de hielo.",
        type: "sequence",
        sequence: ["saturn-low", "saturn-mid", "saturn-high"],
        targets: [
            { id: "saturn-low", label: "42 kHz", detail: "Anillo C", kind: "frequency", hold: 0.65, position: [-1.05, 0.25, 0] },
            { id: "saturn-mid", label: "68 kHz", detail: "Anillo B", kind: "frequency", hold: 0.65, position: [0, 0.9, 0.08] },
            { id: "saturn-high", label: "94 kHz", detail: "Anillo A", kind: "frequency", hold: 0.65, position: [1.05, 0.25, 0] }
        ]
    },
    uranus: {
        title: "ALINEACIÓN AXIAL",
        tool: "Giroscopio holográfico",
        briefing: "Ajusta el eje del modelo hasta aproximarlo a 98 grados y confirma la orientación.",
        hint: "Usa los controles de giro. El margen aceptado es de cinco grados.",
        success: "Eje alineado. La trayectoria orbital de la sonda fue corregida para la rotación lateral de Urano.",
        type: "align",
        targetAngle: 98,
        step: 14,
        targets: [
            { id: "uranus-left", label: "−14°", detail: "Girar a la izquierda", kind: "control", hold: 0.18, position: [-1.05, 0.25, 0] },
            { id: "uranus-confirm", label: "CONFIRMAR", detail: "Objetivo: 98°", kind: "axis", hold: 0.8, position: [0, 0.8, 0.08] },
            { id: "uranus-right", label: "+14°", detail: "Girar a la derecha", kind: "control", hold: 0.18, position: [1.05, 0.25, 0] }
        ]
    },
    neptune: {
        title: "RUTA DE VIENTOS",
        tool: "Navegador aerodinámico",
        briefing: "Analiza los tres corredores y selecciona la ruta con menor velocidad de viento para recuperar la última baliza.",
        hint: "Mantén el puntero para leer cada corredor. Después vuelve a seleccionar la menor velocidad de viento.",
        selectionPrompt: "SELECCIONA DE NUEVO EL CORREDOR CON LA MENOR VELOCIDAD DE VIENTO",
        retryPrompt: "COMPARA LAS VELOCIDADES Y ELIGE EL CORREDOR MÁS ESTABLE",
        success: "Ruta segura confirmada. La red Helios está restaurada y la misión principal ha concluido.",
        type: "survey",
        correctTarget: "neptune-safe",
        event: { label: "FRENTE DE TORMENTA", duration: 70, resetOnTimeout: true },
        targets: [
            { id: "neptune-fast", label: "CORREDOR A", detail: "VIENTO 2.080 km/h", hiddenDetail: true, kind: "route", hold: 1.0, position: [-1.05, 0.25, 0] },
            { id: "neptune-safe", label: "CORREDOR B", detail: "VIENTO 760 km/h · ESTABLE", hiddenDetail: true, kind: "route", hold: 1.0, position: [0, 0.9, 0.08] },
            { id: "neptune-mid", label: "CORREDOR C", detail: "VIENTO 1.340 km/h", hiddenDetail: true, kind: "route", hold: 1.0, position: [1.05, 0.25, 0] }
        ]
    }
});
