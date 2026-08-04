export const SOLAR_MISSION = [
    {
        id: "earth",
        name: "Tierra",
        type: "Planeta oceánico · Base de origen",
        code: "TER-HOME",
        background: null,
        home: true,
        accent: "#39DFF5",
        objective: "Prepara el lanzamiento e inicia la ruta hacia el Sol",
        intro: "Has vuelto a casa. La base terrestre y los sistemas de misión están disponibles para preparar un nuevo recorrido.",
        scanTarget: "Ruta de salida hacia el Sol",
        discovery: "La atmósfera y el campo magnético protegen la superficie de gran parte de la radiación espacial.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Roca, metal, agua y aire", detail: "La Tierra tiene un núcleo metálico, un manto rocoso, una corteza activa y una atmósfera dominada por nitrógeno y oxígeno." },
            temperature: { label: "TEMPERATURA", value: "≈15 °C de media", detail: "La temperatura media permite agua líquida estable, aunque existe una gran diversidad climática." },
            gravity: { label: "GRAVEDAD", value: "1,00 g", detail: "La referencia terrestre es de unos 9,81 m/s² al nivel del mar." },
            curiosity: { label: "CURIOSIDAD", value: "Planeta en movimiento", detail: "Las placas tectónicas reciclan la corteza y ayudan a regular el carbono durante escalas geológicas." },
            compare: { label: "COMPARAR", value: "Unidad de referencia", detail: "Usamos la Tierra como escala para comparar tamaño, gravedad, duración del día y habitabilidad de otros mundos." }
        },
        metrics: { diameter: "12.742 km", day: "23 h 56 min", year: "365,25 días", moons: "1" }
    },
    {
        id: "sun",
        name: "Sol",
        type: "Estrella",
        code: "SOL-00",
        background: "sun.jpg",
        accent: "#FFC857",
        objective: "Analiza la fuente de energía del Sistema Solar",
        intro: "Llegamos al Sol. Mantén la distancia de seguridad y usa el escáner para estudiar su estructura y actividad.",
        scanTarget: "Actividad de la fotosfera",
        discovery: "La luz solar tarda cerca de 8 minutos y 20 segundos en alcanzar la Tierra.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Hidrógeno y helio", detail: "Aproximadamente tres cuartas partes de su masa son hidrógeno. La fusión en el núcleo transforma hidrógeno en helio y libera energía." },
            temperature: { label: "TEMPERATURA", value: "5.500 °C en superficie", detail: "La fotosfera ronda los 5.500 °C, mientras que el núcleo alcanza cerca de 15 millones de °C." },
            gravity: { label: "GRAVEDAD", value: "28 veces la terrestre", detail: "La gravedad superficial es cercana a 274 m/s². Su masa mantiene a todos los planetas en órbita." },
            curiosity: { label: "CURIOSIDAD", value: "Rotación diferencial", detail: "El ecuador gira más rápido que las regiones polares porque el Sol es una esfera de plasma, no una superficie sólida." },
            compare: { label: "COMPARAR", value: "109 Tierras de diámetro", detail: "En el diámetro del Sol cabrían unas 109 Tierras. Su volumen podría contener alrededor de 1,3 millones de planetas como el nuestro." }
        },
        metrics: { diameter: "1.392.700 km", day: "25–35 días", year: "Centro orbital", moons: "No aplica" }
    },
    {
        id: "mercury",
        name: "Mercurio",
        type: "Planeta rocoso",
        code: "MER-01",
        background: "mercury.jpg",
        accent: "#C9B09A",
        objective: "Mide sus extremos térmicos y examina sus cráteres",
        intro: "Entramos en la órbita de Mercurio. Su cercanía al Sol no impide que sus noches sean extremadamente frías.",
        scanTarget: "Contraste térmico superficial",
        discovery: "Un año en Mercurio dura solo 88 días terrestres, pero un día solar dura 176 días terrestres.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Roca y gran núcleo metálico", detail: "Posee un núcleo rico en hierro que ocupa una gran parte de su interior y una corteza rocosa muy craterizada." },
            temperature: { label: "TEMPERATURA", value: "−180 a 430 °C", detail: "Sin una atmósfera densa que distribuya el calor, la diferencia entre el día y la noche es enorme." },
            gravity: { label: "GRAVEDAD", value: "0,38 g", detail: "La gravedad superficial es de unos 3,7 m/s². Una persona de 70 kg sentiría un peso equivalente a unos 27 kg terrestres." },
            curiosity: { label: "CURIOSIDAD", value: "Hielo cerca del Sol", detail: "Existen depósitos de hielo en cráteres polares que permanecen en sombra permanente." },
            compare: { label: "COMPARAR", value: "0,38 Tierras de diámetro", detail: "Mercurio es apenas un poco mayor que la Luna y es el planeta más pequeño del Sistema Solar." }
        },
        metrics: { diameter: "4.880 km", day: "58,6 días", year: "88 días", moons: "0" }
    },
    {
        id: "venus",
        name: "Venus",
        type: "Planeta rocoso",
        code: "VEN-02",
        background: "venus.jpg",
        accent: "#F5C56F",
        objective: "Estudia su atmósfera y el efecto invernadero extremo",
        intro: "Venus parece similar a la Tierra en tamaño, pero su atmósfera crea el entorno superficial más caliente entre los planetas.",
        scanTarget: "Capas atmosféricas",
        discovery: "Venus gira en sentido contrario al de la mayoría de los planetas y su día es más largo que su año.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Roca bajo nubes densas", detail: "Su atmósfera es principalmente dióxido de carbono, con nubes de ácido sulfúrico y una superficie volcánica." },
            temperature: { label: "TEMPERATURA", value: "≈465 °C", detail: "El intenso efecto invernadero mantiene temperaturas capaces de fundir plomo, incluso durante la noche." },
            gravity: { label: "GRAVEDAD", value: "0,90 g", detail: "La gravedad superficial es de unos 8,87 m/s², muy parecida a la terrestre." },
            curiosity: { label: "CURIOSIDAD", value: "Rotación retrógrada", detail: "En Venus, el Sol parecería salir por el oeste y ponerse por el este." },
            compare: { label: "COMPARAR", value: "0,95 Tierras de diámetro", detail: "Venus es el planeta más parecido a la Tierra en tamaño, aunque sus condiciones ambientales son radicalmente distintas." }
        },
        metrics: { diameter: "12.104 km", day: "243 días", year: "225 días", moons: "0" }
    },
    {
        id: "mars",
        name: "Marte",
        type: "Planeta rocoso",
        code: "MAR-04",
        background: "mars.jpg",
        accent: "#F07D5D",
        objective: "Busca señales de agua antigua y prepara una zona de exploración",
        intro: "Estamos en Marte. Sus valles, minerales y depósitos polares conservan pistas de un pasado más húmedo.",
        scanTarget: "Minerales hidratados",
        discovery: "Olympus Mons es el volcán más grande conocido del Sistema Solar y se eleva más de 20 km.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Roca rica en óxidos de hierro", detail: "El polvo oxidado produce su color rojizo. La atmósfera es tenue y está formada principalmente por dióxido de carbono." },
            temperature: { label: "TEMPERATURA", value: "≈−63 °C de media", detail: "Puede superar 0 °C localmente durante el día y caer por debajo de −120 °C en noches polares." },
            gravity: { label: "GRAVEDAD", value: "0,38 g", detail: "La gravedad es de unos 3,71 m/s², casi la misma proporción que en Mercurio." },
            curiosity: { label: "CURIOSIDAD", value: "Días casi terrestres", detail: "Un sol marciano dura 24 horas y 37 minutos, una duración muy cómoda para ritmos humanos." },
            compare: { label: "COMPARAR", value: "0,53 Tierras de diámetro", detail: "Marte tiene cerca de la mitad del diámetro terrestre y dos pequeñas lunas: Fobos y Deimos." }
        },
        metrics: { diameter: "6.779 km", day: "24 h 37 min", year: "687 días", moons: "2" }
    },
    {
        id: "jupiter",
        name: "Júpiter",
        type: "Gigante gaseoso",
        code: "JUP-05",
        background: "jupiter.jpg",
        accent: "#E1B56A",
        objective: "Escanea la Gran Mancha Roja y su intensa magnetosfera",
        intro: "Júpiter domina el sistema planetario por su masa. No posee una superficie sólida donde aterrizar.",
        scanTarget: "Gran Mancha Roja",
        discovery: "La Gran Mancha Roja es una tormenta gigantesca observada durante siglos.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Hidrógeno y helio", detail: "Bajo sus nubes, la presión transforma el hidrógeno en estados líquidos y metálicos alrededor de un interior profundo." },
            temperature: { label: "TEMPERATURA", value: "≈−110 °C en nubes", detail: "El interior emite más calor del que recibe del Sol, mientras las capas altas son extremadamente frías." },
            gravity: { label: "GRAVEDAD", value: "2,53 g", detail: "En la referencia de sus nubes, la gravedad es de unos 24,79 m/s²." },
            curiosity: { label: "CURIOSIDAD", value: "El día más rápido", detail: "Júpiter completa una rotación en menos de 10 horas, lo que ensancha su ecuador." },
            compare: { label: "COMPARAR", value: "11 Tierras de diámetro", detail: "Su volumen podría contener más de mil Tierras y está acompañado por decenas de lunas." }
        },
        metrics: { diameter: "139.820 km", day: "9 h 56 min", year: "11,86 años", moons: "95" }
    },
    {
        id: "saturn",
        name: "Saturno",
        type: "Gigante gaseoso",
        code: "SAT-06",
        background: "saturn.jpg",
        accent: "#DCC58A",
        objective: "Analiza la estructura de sus anillos y sus divisiones",
        intro: "Saturno presenta el sistema de anillos más espectacular. Cada banda está formada por incontables partículas en órbita.",
        scanTarget: "Anillos principales",
        discovery: "La densidad media de Saturno es menor que la del agua, aunque no existe un océano capaz de contenerlo.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Hidrógeno, helio y hielos", detail: "Es un gigante gaseoso con un interior sometido a enormes presiones. Sus anillos contienen sobre todo hielo de agua y roca." },
            temperature: { label: "TEMPERATURA", value: "≈−140 °C en nubes", detail: "Las capas visibles son muy frías, aunque el interior conserva y genera calor." },
            gravity: { label: "GRAVEDAD", value: "1,06 g", detail: "La gravedad cerca de las nubes es de unos 10,44 m/s², sorprendentemente parecida a la terrestre." },
            curiosity: { label: "CURIOSIDAD", value: "Anillos muy delgados", detail: "Se extienden cientos de miles de kilómetros, pero en muchas zonas su espesor es de apenas decenas de metros." },
            compare: { label: "COMPARAR", value: "9,1 Tierras de diámetro", detail: "Saturno es el segundo planeta más grande y posee una enorme familia de lunas." }
        },
        metrics: { diameter: "116.460 km", day: "≈10 h 42 min", year: "29,5 años", moons: "274" }
    },
    {
        id: "uranus",
        name: "Urano",
        type: "Gigante de hielo",
        code: "URA-07",
        background: "uranus.jpg",
        accent: "#86CBE0",
        objective: "Determina la orientación de su eje y estudia su atmósfera",
        intro: "Urano gira prácticamente acostado. Sus estaciones extremas están ligadas a una inclinación axial excepcional.",
        scanTarget: "Inclinación del eje",
        discovery: "Su eje está inclinado cerca de 98 grados, por lo que cada polo puede pasar décadas apuntando hacia el Sol.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Hidrógeno, helio, agua y metano", detail: "El metano absorbe luz roja y contribuye a su tonalidad azul verdosa. Su interior contiene materiales llamados hielos planetarios." },
            temperature: { label: "TEMPERATURA", value: "≈−195 °C", detail: "Urano posee algunas de las temperaturas atmosféricas más bajas medidas en un planeta." },
            gravity: { label: "GRAVEDAD", value: "0,89 g", detail: "La gravedad en la referencia de las nubes es de unos 8,69 m/s²." },
            curiosity: { label: "CURIOSIDAD", value: "Un planeta de lado", detail: "Probablemente una gran colisión temprana contribuyó a su orientación extrema, aunque su historia exacta sigue en estudio." },
            compare: { label: "COMPARAR", value: "4 Tierras de diámetro", detail: "Urano es unas cuatro veces más ancho que la Tierra y tarda 84 años terrestres en completar una órbita." }
        },
        metrics: { diameter: "50.724 km", day: "17 h 14 min", year: "84 años", moons: "29 conocidas" }
    },
    {
        id: "neptune",
        name: "Neptuno",
        type: "Gigante de hielo",
        code: "NEP-08",
        background: "neptune.jpg",
        accent: "#6088E8",
        objective: "Mide sus vientos supersónicos y completa la misión solar",
        intro: "Alcanzamos Neptuno, el planeta principal más lejano. Su atmósfera alberga algunos de los vientos más rápidos conocidos.",
        scanTarget: "Sistema de tormentas",
        discovery: "Los vientos de Neptuno pueden superar los 2.000 km/h pese a recibir muy poca energía solar.",
        topics: {
            composition: { label: "COMPOSICIÓN", value: "Hidrógeno, helio, metano y hielos", detail: "Su estructura incluye una atmósfera profunda y un manto rico en agua, amoníaco y metano bajo alta presión." },
            temperature: { label: "TEMPERATURA", value: "≈−200 °C", detail: "La atmósfera superior es extremadamente fría, pero el planeta emite más energía interna de la que recibe del Sol." },
            gravity: { label: "GRAVEDAD", value: "1,14 g", detail: "La gravedad cerca de las nubes es de unos 11,15 m/s²." },
            curiosity: { label: "CURIOSIDAD", value: "Descubierto con matemáticas", detail: "Su posición fue predicha a partir de perturbaciones en la órbita de Urano antes de ser observado directamente." },
            compare: { label: "COMPARAR", value: "3,9 Tierras de diámetro", detail: "Neptuno es ligeramente más pequeño que Urano, pero posee más masa y una atmósfera muy dinámica." }
        },
        metrics: { diameter: "49.244 km", day: "16 h 6 min", year: "164,8 años", moons: "16 conocidas" }
    }
];
export const MISSION_TOPIC_ORDER = ["composition", "temperature", "gravity", "curiosity", "compare"];
