import { resonanceInWindow, resonancePosition } from "./missionMath.js";
export function createMissionEnvironment({ THREE, environmentGroup, successGroup }) {
    let successUntil = 0;
    let environmentStageId = "";

    function disposeGroup(group) {
        while (group.children.length) {
            const child = group.children[0];
            group.remove(child);
            child.traverse?.((node) => {
                node.geometry?.dispose?.();
                if (node.material) {
                    const materials = Array.isArray(node.material) ? node.material : [node.material];
                    for (const material of materials) {
                        material.map?.dispose?.();
                        material.dispose?.();
                    }
                }
            });
        }
    }

    function basicGlow(color, opacity = 0.55) {
        return new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    }

    function standardGlow(color, intensity = 1.1, opacity = 0.8) {
        return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, metalness: 0.28, roughness: 0.34, transparent: true, opacity });
    }

    function createStageEnvironment(state) {
        disposeGroup(environmentGroup);
        environmentStageId = state.current.id;
        const accent = new THREE.Color(state.current.accent || "#45E6FF");
        const id = state.current.id;
        if (id === "earth") {
            const core = new THREE.Mesh(new THREE.SphereGeometry(0.36, 28, 18), standardGlow(accent, 1.35, 0.92));
            core.position.set(0, 0.05, -3.2);
            const shell = new THREE.Mesh(new THREE.SphereGeometry(0.44, 22, 14), basicGlow(accent, 0.13));
            shell.position.copy(core.position);
            const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.035, 10, 52), basicGlow(accent, 0.76));
            ringA.position.copy(core.position);
            ringA.rotation.x = Math.PI / 2;
            const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.018, 8, 48), basicGlow(0xffffff, 0.38));
            ringB.position.copy(core.position);
            ringB.rotation.y = Math.PI / 2;
            environmentGroup.add(core, shell, ringA, ringB);
            const installedTargets = (state.operation?.targets || []).filter((target) => Array.isArray(target.installedWorld));
            for (const target of installedTargets) {
                const [x, y, z] = target.installedWorld;
                const slot = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 8, 30), basicGlow(accent, 0.5));
                slot.position.set(x, y, z + 0.02);
                slot.rotation.x = Math.PI / 2;
                const lineGeometry = new THREE.BufferGeometry().setFromPoints([
                    core.position.clone(),
                    new THREE.Vector3(x, y, z),
                ]);
                const arm = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }));
                environmentGroup.add(slot, arm);
            }
            environmentGroup.userData.core = core;
        }
        else if (id === "sun") {
            const sun = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), standardGlow(0xff9f35, 2.2, 0.9));
            sun.position.set(0, 1.75, -5.3);
            const corona = new THREE.Mesh(new THREE.SphereGeometry(0.82, 24, 16), basicGlow(0xffc14f, 0.15));
            corona.position.copy(sun.position);
            const flare = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 12), standardGlow(0xff5b35, 3.2, 0.9));
            flare.position.set(3.6, 1.4, -4.4);
            const light = new THREE.PointLight(0xff6845, 2.4, 5, 2);
            flare.add(light);
            environmentGroup.add(sun, corona, flare);
            environmentGroup.userData.flare = flare;
        }
        else if (id === "mercury") {
            const rimMaterial = new THREE.MeshStandardMaterial({ color: 0x6b594d, emissive: 0x241a15, emissiveIntensity: 0.18, roughness: 0.88, metalness: 0.08 });
            const rim = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.25, 16, 72), rimMaterial);
            rim.position.set(0, -0.7, -3.1);
            rim.rotation.x = Math.PI / 2;
            const innerRim = new THREE.Mesh(new THREE.TorusGeometry(1.48, 0.055, 10, 64), new THREE.MeshStandardMaterial({ color: 0x3c322d, roughness: 0.94, metalness: 0.02 }));
            innerRim.position.set(0, -0.735, -3.1);
            innerRim.rotation.x = Math.PI / 2;
            const floorMesh = new THREE.Mesh(new THREE.CircleGeometry(1.74, 72), new THREE.MeshStandardMaterial({ color: 0x211d1b, emissive: 0x080707, emissiveIntensity: 0.15, roughness: 1, metalness: 0 }));
            floorMesh.position.set(0, -0.78, -3.1);
            floorMesh.rotation.x = -Math.PI / 2;
            const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.56, 40), basicGlow(0x2a6584, 0.36));
            shadow.position.set(1.18, -0.764, -3.2);
            shadow.rotation.x = -Math.PI / 2;
            const shadowRing = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.018, 8, 42), basicGlow(0x5bc8ff, 0.26));
            shadowRing.position.copy(shadow.position);
            shadowRing.rotation.x = Math.PI / 2;
            environmentGroup.add(floorMesh, rim, innerRim, shadow, shadowRing);
            const rocks = [
                [-1.25, -0.64, -2.15, 0.16], [-0.55, -0.7, -4.48, 0.1], [0.75, -0.67, -4.3, 0.13],
                [1.58, -0.63, -2.22, 0.12], [-1.65, -0.68, -3.75, 0.09], [0.1, -0.71, -1.6, 0.08],
            ];
            for (const [x, y, z, scale] of rocks) {
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(scale, 0), new THREE.MeshStandardMaterial({ color: 0x50443d, roughness: 1, metalness: 0 }));
                rock.position.set(x, y, z);
                rock.rotation.set(x * 0.4, z * 0.25, x * 0.18);
                environmentGroup.add(rock);
            }
            environmentGroup.userData.shadow = shadow;
        }
        else if (id === "venus") {
            const colors = [0xf6d58a, 0xe0ad55, 0xb87936, 0x7e442e];
            const levelYs = [1.35, 0.62, -0.12, -0.88];
            const layers = [];
            const levelLocks = [];
            levelYs.forEach((y, index) => {
                const layer = new THREE.Mesh(new THREE.TorusGeometry(1.15 - index * 0.08, 0.025, 8, 48), basicGlow(colors[index], 0.28 + index * 0.05));
                layer.position.set(0, y, -4.05);
                layer.rotation.x = Math.PI / 2;
                environmentGroup.add(layer);
                layers.push(layer);
                if (index > 0) {
                    const lock = new THREE.Group();
                    const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.13, 0.05), basicGlow(0xffc857, 0.82));
                    body.position.y = -0.035;
                    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 7, 18, Math.PI), basicGlow(0xffd98a, 0.9));
                    shackle.rotation.z = Math.PI;
                    shackle.position.y = 0.055;
                    lock.add(body, shackle);
                    lock.position.set(1.35, y, -3.72);
                    lock.visible = false;
                    environmentGroup.add(lock);
                    levelLocks[index] = lock;
                }
            });
            const cloudShell = new THREE.Mesh(new THREE.SphereGeometry(1.05, 24, 16), basicGlow(0xe9aa52, 0.08));
            cloudShell.scale.set(1.35, 1.7, 0.72);
            cloudShell.position.set(0, 0.18, -4.05);
            const probeMarker = new THREE.Mesh(new THREE.OctahedronGeometry(0.18, 1), standardGlow(accent, 2.0, 0.95));
            probeMarker.position.set(0, levelYs[0], -3.55);
            const probeRing = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.018, 8, 28), basicGlow(accent, 0.55));
            probeRing.rotation.x = Math.PI / 2;
            probeMarker.add(probeRing);
            environmentGroup.add(cloudShell, probeMarker);
            environmentGroup.userData.levelYs = levelYs;
            environmentGroup.userData.probeMarker = probeMarker;
            environmentGroup.userData.venusLayers = layers;
            environmentGroup.userData.levelLocks = levelLocks;
        }
        else if (id === "mars") {
            const ground = new THREE.Mesh(new THREE.CircleGeometry(1.8, 64), new THREE.MeshStandardMaterial({ color: 0x4d2118, roughness: 0.95, metalness: 0 }));
            ground.position.set(0, -0.86, -3.08);
            ground.rotation.x = -Math.PI / 2;
            const groundRing = new THREE.Mesh(new THREE.TorusGeometry(1.82, 0.025, 8, 64), basicGlow(0xe56f47, 0.22));
            groundRing.position.copy(ground.position);
            groundRing.rotation.x = Math.PI / 2;
            const ice = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 12), standardGlow(0x7de9ff, 2.4, 0.85));
            ice.position.set(0, -0.72, -2.98);
            ice.visible = false;
            environmentGroup.add(ground, groundRing, ice);
            for (const [x, z, sc] of [[-1.25,-2.3,.11],[1.4,-3.6,.09],[-.75,-4.0,.08],[1.0,-2.15,.07]]) {
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(sc, 0), new THREE.MeshStandardMaterial({ color: 0x7b3927, roughness: 1 }));
                rock.position.set(x, -0.78, z);
                environmentGroup.add(rock);
            }
            const beams = [];
            const stationPositions = (state.operation?.targets || [])
                .filter((target) => (state.operation?.stations || []).includes(target.id))
                .map((target) => target.world || [0, 0, -3]);
            for (const pos of stationPositions) {
                const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...pos), new THREE.Vector3(0, -0.68, -2.98)]);
                const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0x7de9ff, transparent: true, opacity: 0.42 }));
                line.visible = false;
                environmentGroup.add(line);
                beams.push(line);
            }
            environmentGroup.userData.ice = ice;
            environmentGroup.userData.beams = beams;
        }
        else if (id === "jupiter") {
            const storm = new THREE.Mesh(new THREE.SphereGeometry(1.15, 28, 18), new THREE.MeshStandardMaterial({ color: 0xb95a39, emissive: 0x4b170e, emissiveIntensity: 0.9, roughness: 0.74 }));
            storm.scale.set(1.5, 0.68, 0.42);
            storm.position.set(0, 0.35, -5.45);
            const stormRing = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.08, 12, 64), basicGlow(0xff8c5b, 0.32));
            stormRing.scale.y = 0.55;
            stormRing.position.copy(storm.position);
            const stormRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.28, 0.035, 10, 64), basicGlow(0xffd1a7, 0.24));
            stormRing2.scale.y = 0.5;
            stormRing2.position.copy(storm.position);
            stormRing2.rotation.z = 0.45;
            const stormRing3 = new THREE.Mesh(new THREE.TorusGeometry(1.78, 0.024, 8, 64), basicGlow(0xff6b45, 0.18));
            stormRing3.scale.y = 0.58;
            stormRing3.position.copy(storm.position);
            stormRing3.rotation.z = -0.3;
            environmentGroup.add(storm, stormRing, stormRing2, stormRing3);
            environmentGroup.userData.storm = storm;
            environmentGroup.userData.stormRing = stormRing;
        }
        else if (id === "saturn") {
            const planet = new THREE.Mesh(new THREE.SphereGeometry(0.62, 28, 18), new THREE.MeshStandardMaterial({ color: 0xd7bb75, emissive: 0x4b3e20, emissiveIntensity: 0.45, roughness: 0.72 }));
            planet.position.set(0, 1.05, -4.85);
            const ring1 = new THREE.Mesh(new THREE.RingGeometry(0.84, 1.08, 72), basicGlow(0xf3e6bd, 0.34));
            const ring2 = new THREE.Mesh(new THREE.RingGeometry(1.12, 1.38, 72), basicGlow(0xc9ad70, 0.26));
            const ring3 = new THREE.Mesh(new THREE.RingGeometry(1.42, 1.64, 72), basicGlow(0x9e865a, 0.2));
            for (const ring of [ring1, ring2, ring3]) {
                ring.position.copy(planet.position);
                ring.rotation.x = 1.18;
            }
            const resonance = new THREE.Mesh(new THREE.TorusGeometry(1.24, 0.035, 10, 64), basicGlow(accent, 0.32));
            resonance.position.copy(planet.position);
            resonance.rotation.x = 1.18;
            environmentGroup.add(planet, ring1, ring2, ring3, resonance);
            environmentGroup.userData.resonance = resonance;
        }
        else if (id === "uranus") {
            const planetGroup = new THREE.Group();
            planetGroup.position.set(0, 0.85, -4.05);
            const planet = new THREE.Mesh(new THREE.SphereGeometry(0.7, 28, 18), standardGlow(0x65d8e8, 0.65, 0.88));
            const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.76, 24, 16), basicGlow(0x8aefff, 0.1));
            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.025, 8, 64), basicGlow(0xb7f5ff, 0.45));
            ring.rotation.x = Math.PI / 2;
            const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.012, 8, 56), basicGlow(0x67d8ed, 0.28));
            ring2.rotation.x = Math.PI / 2;
            const axis = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 2.2, 8), basicGlow(0xffffff, 0.8));
            planetGroup.add(planet, atmosphere, ring, ring2, axis);
            const referenceGroup = new THREE.Group();
            referenceGroup.position.copy(planetGroup.position);
            referenceGroup.rotation.z = THREE.MathUtils.degToRad(state.operation?.targetAngle || 98);
            const referenceAxis = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.45, 8), basicGlow(0xffd166, 0.5));
            const referenceRing = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.012, 8, 64), basicGlow(0xffd166, 0.2));
            referenceRing.rotation.x = Math.PI / 2;
            referenceGroup.add(referenceAxis, referenceRing);
            environmentGroup.add(referenceGroup, planetGroup);
            environmentGroup.userData.planetGroup = planetGroup;
            environmentGroup.userData.referenceGroup = referenceGroup;
        }
        else if (id === "neptune") {
            const planet = new THREE.Mesh(new THREE.SphereGeometry(0.78, 28, 18), new THREE.MeshStandardMaterial({ color: 0x2456c9, emissive: 0x0c205d, emissiveIntensity: 0.9, roughness: 0.58, metalness: 0.08 }));
            planet.position.set(0, 1.8, -5.9);
            const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(0.86, 24, 16), basicGlow(0x6ea2ff, 0.1));
            atmosphere.position.copy(planet.position);
            const equator = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.018, 8, 56), basicGlow(0x9bc5ff, 0.22));
            equator.position.copy(planet.position);
            equator.rotation.x = Math.PI / 2;
            environmentGroup.add(planet, atmosphere, equator);
            for (let i = 0; i < 5; i++) {
                const stream = new THREE.Mesh(new THREE.TorusGeometry(1.25 + i * 0.18, 0.012 + i * 0.002, 8, 64), basicGlow(i % 2 ? 0x79b7ff : 0x3a77ff, 0.16 + i * 0.025));
                stream.position.set(0, 1.8, -5.9);
                stream.rotation.x = Math.PI / 2.4;
                stream.rotation.z = i * 0.32;
                environmentGroup.add(stream);
            }
        }
    }

    function triggerSuccessBurst(state) {
        disposeGroup(successGroup);
        const color = state.current.accent || "#66F1FF";
        for (let i = 0; i < 3; i++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42 + i * 0.2, 0.022, 8, 48), basicGlow(color, 0.72 - i * 0.16));
            ring.position.set(0, 0.15, -2.9);
            ring.userData.phase = i * 0.25;
            successGroup.add(ring);
        }
        successUntil = performance.now() + 3200;
    }

    function updateStageEnvironment(t, delta, state) {
        if (!state?.operation || !state?.task || !state?.current)
            return;
        const op = state.operation;
        const task = state.task;
        const id = state.current.id;
        if (id === "sun") {
            const flare = environmentGroup.userData.flare;
            const activeId = op.sequence?.[task.sequenceIndex] || op.sequence?.[op.sequence.length - 1];
            const activeTarget = op.targets.find((item) => item.id === activeId);
            if (flare && activeTarget) {
                const side = Math.sign(activeTarget.world?.[0] || 0);
                const phase = (t * 0.34 + task.sequenceIndex * 0.37) % 1;
                flare.position.set(side * (3.8 - phase * 1.7), 1.4 - phase * 0.35, -4.5 + phase * 1.1);
                flare.scale.setScalar(0.8 + Math.sin(t * 7) * 0.12);
            }
        }
        else if (id === "venus") {
            const marker = environmentGroup.userData.probeMarker;
            const ys = environmentGroup.userData.levelYs || [];
            const layers = environmentGroup.userData.venusLayers || [];
            const locks = environmentGroup.userData.levelLocks || [];
            const level = task.custom?.level || 0;
            const sampleLevels = op.levels.map((item, index) => ({ ...item, index })).filter((item) => item.sample);
            const next = sampleLevels[task.custom?.sampleIndex || 0];
            if (marker && Number.isFinite(ys[level])) {
                marker.position.y += (ys[level] - marker.position.y) * Math.min(1, delta * 5.5);
                marker.rotation.y += delta * 1.3;
            }
            layers.forEach((layer, index) => {
                const active = index === level;
                const nextUnlocked = next && index === next.index;
                layer.material.opacity = active ? 0.82 : nextUnlocked ? 0.58 : index < (next?.index ?? 99) ? 0.34 : 0.12;
            });
            locks.forEach((lock, index) => {
                if (lock)
                    lock.visible = !!next && index > next.index;
            });
        }
        else if (id === "mars") {
            const beams = environmentGroup.userData.beams || [];
            (op.stations || []).forEach((stationId, index) => {
                if (beams[index])
                    beams[index].visible = !!task.targets?.[stationId]?.complete;
            });
            const ready = (op.stations || []).every((stationId) => task.targets?.[stationId]?.complete);
            const ice = environmentGroup.userData.ice;
            if (ice) {
                ice.visible = ready || task.completed;
                ice.scale.setScalar(0.9 + Math.sin(t * 3.2) * 0.12);
            }
        }
        else if (id === "jupiter") {
            const storm = environmentGroup.userData.storm;
            const stormRing = environmentGroup.userData.stormRing;
            if (storm)
                storm.rotation.y += delta * 0.18;
            if (stormRing)
                stormRing.rotation.z += delta * 0.42;
        }
        else if (id === "saturn") {
            const ring = environmentGroup.userData.resonance;
            const position = resonancePosition(task.custom, op);
            const closeness = Math.max(0, 1 - Math.abs(position - (op.resonanceCenter ?? 0.5)) * 2.2);
            const inWindow = resonanceInWindow(task.custom, op);
            if (ring) {
                ring.material.opacity = inWindow ? 0.96 : 0.2 + closeness * 0.58;
                const scale = 0.92 + closeness * 0.14 + Math.sin(t * (3 + closeness * 7)) * 0.025;
                ring.scale.setScalar(scale);
                ring.rotation.z += delta * (0.24 + closeness * 1.2);
                ring.material.color.set(inWindow ? 0x74ffb0 : state.current.accent);
            }
        }
        else if (id === "uranus") {
            const planetGroup = environmentGroup.userData.planetGroup;
            if (planetGroup)
                planetGroup.rotation.z += (THREE.MathUtils.degToRad(task.angle || 0) - planetGroup.rotation.z) * Math.min(1, delta * 5);
        }
        else if (id === "neptune") {
            environmentGroup.children.forEach((child, index) => {
                if (child.geometry?.type === "TorusGeometry")
                    child.rotation.z += delta * (0.08 + index * 0.018);
            });
        }
        if (performance.now() < successUntil) {
            const remaining = Math.max(0, successUntil - performance.now()) / 3200;
            successGroup.children.forEach((ring, index) => {
                const age = 1 - remaining + (ring.userData.phase || 0);
                const scale = 0.8 + age * 1.7;
                ring.scale.setScalar(scale);
                ring.material.opacity = Math.max(0, 0.72 * remaining - index * 0.08);
                ring.rotation.z += delta * (0.8 + index * 0.25);
            });
        }
    }

    return {
        rebuild: createStageEnvironment,
        triggerSuccess: triggerSuccessBurst,
        update: updateStageEnvironment,
        isSuccessActive: () => performance.now() < successUntil,
        getStageId: () => environmentStageId,
    };
}
