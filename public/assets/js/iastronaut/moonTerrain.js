import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Compartido por la mision integrada y la pagina de prueba.
export function createMoonTerrain({ THREE, scene: escena, world: mundoLunar, renderer,
    samples: muestras, objects: objetosSeleccion, onChange: mostrarMision, base = "" }) {
    escena.add(new THREE.AmbientLight(0xffffff, 0.6));

    const sol = new THREE.DirectionalLight(0xffffff, 2);
    sol.position.set(5, 8, 3);
    sol.castShadow = true;
    sol.shadow.mapSize.set(1024, 1024);

    // Cubrir el terreno donde están las rocas.
    sol.shadow.camera.left = -15;
    sol.shadow.camera.right = 15;
    sol.shadow.camera.top = 15;
    sol.shadow.camera.bottom = -15;
    sol.shadow.camera.near = 0.5;
    sol.shadow.camera.far = 40;

    // Reducir marcas falsas sobre las superficies.
    sol.shadow.normalBias = 0.02;
    sol.shadow.camera.updateProjectionMatrix();
    mundoLunar.add(sol, sol.target);

    const cargador = new THREE.TextureLoader();
    cargador.load(
      `${base}/assets/sidequests/moon/textures/surface.png`,
      (textura) => {
        textura.colorSpace = THREE.SRGBColorSpace;
        textura.wrapS = THREE.RepeatWrapping;
        textura.wrapT = THREE.RepeatWrapping;
        textura.repeat.set(28, 28);
        textura.anisotropy = Math.min(
          8, renderer.capabilities.getMaxAnisotropy()
        );
        const geometriaSuelo = new THREE.PlaneGeometry(140, 140, 256, 256);

        // Orientar la geometría horizontalmente antes de modificar su altura.
        geometriaSuelo.rotateX(-Math.PI / 2);

        const posiciones = geometriaSuelo.attributes.position;
        // [centro X, centro Z, radio, profundidad, altura del borde]
        const crateres = [
          [-19, -12, 6, 1.8, 0.6],
          [ 20,  -8, 5, 1.4, 0.5],
          [  5,  25, 7, 2.0, 0.7]
        ];


        // Montañas distribuidas alrededor del área de exploración.
        // [centro X, centro Z, altura, anchura]
        const montañas = [
            [-35, -38,  8, 10],
            [ -8, -48,  4,  7],
            [ 30, -40, 11, 12],
            [ 48,  -5,  5,  8],
            [ 35,  38,  9, 11],
            [ -8,  48,  4,  9],
            [-42,  30, 10, 12],
            [-48,  -8,  5,  8]
        ];

        for (let i = 0; i < posiciones.count; i++) {
            const x = posiciones.getX(i);
            const z = posiciones.getZ(i);
            const distancia = Math.hypot(x, z);

            // Zona central plana; transición gradual hacia las colinas.
            // Mantener plana la zona central.
            const transicion = THREE.MathUtils.smoothstep(distancia, 12, 30);

            // Elevaciones amplias con pequeñas variaciones.
            let altura =
                1.5 +
                Math.sin(x * 0.09 + z * 0.04) * 0.8 +
                Math.cos(z * 0.12 - x * 0.03) * 0.6;


            for (const [cx, cz, elevacion, anchura] of montañas) {
                const distanciaCuadrada = (x - cx) ** 2 + (z - cz) ** 2;
                altura += elevacion *
                    Math.exp(-distanciaCuadrada / (2 * anchura ** 2));
            }
            // Aplicar la transición a las montañas antes de excavar los cráteres.
            altura *= transicion;
            for (const [cx, cz, radio, profundidad, borde] of crateres) {
              const distanciaCrater = Math.hypot(x - cx, z - cz);
              const r = distanciaCrater / radio;

              // Depresión suave: alcanza su profundidad máxima en el centro.
              if (r < 1) {
                altura -= profundidad * (1 - r * r) ** 2;
              }

              // Borde elevado alrededor del cráter, con transición suave.
              const anchoBorde = 0.3;
              const separacionBorde = Math.abs(r - 1) / anchoBorde;

              if (separacionBorde < 1) {
                altura += borde * (1 - separacionBorde ** 2) ** 2;
              }
            }
            posiciones.setY(i, altura);
        }

        posiciones.needsUpdate = true;
        geometriaSuelo.computeVertexNormals();

        const suelo = new THREE.Mesh(
          geometriaSuelo,
          new THREE.MeshStandardMaterial({
            map: textura,
            roughness: 1,
            metalness: 0
          })
        );

        suelo.receiveShadow = true;
        mundoLunar.add(suelo);
        objetosSeleccion.push(suelo);
        const cargadorRocas = new GLTFLoader();

        cargadorRocas.load(
        `${base}/assets/sidequests/moon/models/moon_rocks.glb`,
        (gltf) => {
            const conjunto = gltf.scene;
            conjunto.updateMatrixWorld(true);

            // Recoger las rocas antes de cambiar su organización.
            const piezas = [];
            conjunto.traverse((objeto) => {
            if (objeto.isMesh) piezas.push(objeto);
            });

            // Cada fila define una roca:
            // [posición X, posición Z, tamaño máximo en metros, giro en grados]
            const ubicaciones = [
            [-1.8, -2.6, 0.65, 20],
            [ 0, -3.2, 0.55, 75],
            [ 1.8, -2.6, 0.5, 130],
            [ 5,  1, 0.8,  40],
            [-6,  3, 1.2, 190],
            [ 3, -1, 0.5,  95],
            [-3,  5, 0.7, 250],
            [ 6, -5, 0.4,  10],
            [ 0, -6, 0.6, 160],
            [-5, -6, 0.9, 310],
            [ 4,  5, 0.5, 220],
            [-2,  1, 0.3,  55],
            [ 7,  3, 1.0, 110],
            [-7, -1, 0.5, 280],
            [ 1,  6, 0.4, 340]
            ];

            piezas.forEach((pieza, indice) => {
                pieza.castShadow = true;
                pieza.receiveShadow = true;
            // Conservar la orientación del modelo y liberar cada roca del grupo.
            escena.attach(pieza);

            const soporte = new THREE.Group();
            escena.add(soporte);
            soporte.attach(pieza);

            // Centrar la roca y colocar su base en el origen del soporte.
            const caja = new THREE.Box3().setFromObject(pieza);
            const centro = caja.getCenter(new THREE.Vector3());
            const tamaño = caja.getSize(new THREE.Vector3());
            const dimensionMayor = Math.max(tamaño.x, tamaño.y, tamaño.z);

            if (dimensionMayor <= 0) return;

            pieza.position.x -= centro.x;
            pieza.position.y -= caja.min.y;
            pieza.position.z -= centro.z;

            const [x, z, medida, giro] = ubicaciones[indice % ubicaciones.length];

            soporte.scale.setScalar(medida / dimensionMayor);
            soporte.rotation.y = THREE.MathUtils.degToRad(giro);
            // Hundir cada roca un 12 % de su altura final.
            const alturaFinal = tamaño.y * (medida / dimensionMayor);
            soporte.position.set(x, -alturaFinal * 0.12, z);
            // add conserva coordenadas locales, incluso si el GLB termina de
            // cargar despues de calibrar el mundo en VR.
            mundoLunar.add(soporte);
            objetosSeleccion.push(pieza);
            if (indice < 3) {
              const aro = new THREE.Mesh(
                new THREE.RingGeometry(medida * 0.65, medida * 0.65 + 0.05, 48),
                new THREE.MeshBasicMaterial({ color: 0x44dfff, side: THREE.DoubleSide,
                  toneMapped: false })
              );
              aro.rotation.x = -Math.PI / 2;
              aro.position.set(x, 0.025, z);
              mundoLunar.add(aro);
              const muestra = { id: indice, soporte, aro };
              pieza.userData.muestra = muestra;
              muestras.push(muestra);
            }
            });

            mostrarMision(muestras.length === 3 ? "" : "No se pudieron preparar las tres muestras.");
        },
        undefined,
        (error) => {
            console.error("Error al cargar las rocas:", error);
            mostrarMision("No se pudieron cargar las rocas. Recarga la pagina.");
        }
        );

        mostrarMision();
      },
      undefined,
      (error) => {
        console.error(error);
        mostrarMision("No se pudo cargar el suelo. Recarga la pagina.");
      }
    );

}
