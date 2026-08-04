import { HIT_ZONES, PINCH_ON, PINCH_OFF } from "./config.js";
function uvToCanvas(hit, panelCanvas) {
    if (!hit?.uv)
        return null;
    return { x: hit.uv.x * panelCanvas.width, y: (1 - hit.uv.y) * panelCanvas.height };
}
function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
export function setupXRInput({ THREE, renderer, scene, camera, panelMesh, panelCanvas, uiGroup, state, drawPanel, handleActionFromHit, getInteractiveMeshes, handleInteractiveClick, handleInteractivePressStart, handleInteractivePressEnd, handleInteractiveHover, handleMainPanelHover, }) {
    const raycaster = new THREE.Raycaster();
    const tempMatrix = new THREE.Matrix4();
    const dragVR = { active: false, controller: null, downTime: 0, plane: new THREE.Plane(), intersection: new THREE.Vector3(), offset: new THREE.Vector3() };
    const scrollVR = { active: false, controller: null, lastCanvasY: 0, moved: false };
    const pressByController = new Map();
    const vA = new THREE.Vector3();
    const vB = new THREE.Vector3();
    const vDir = new THREE.Vector3();
    const vOrigin = new THREE.Vector3();
    function interactiveList() {
        return (getInteractiveMeshes?.() || []).filter((object) => object && object.visible !== false);
    }
    function setControllerRay(controller) {
        tempMatrix.identity().extractRotation(controller.matrixWorld);
        raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
        raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
    }
    function castFromController(controller, objects) {
        const list = objects.filter((object) => object && object.visible !== false);
        if (!list.length)
            return null;
        setControllerRay(controller);
        const hits = raycaster.intersectObjects(list, true);
        return hits.length ? hits[0] : null;
    }
    function castToPanelFromController(controller) {
        if (!panelMesh.visible)
            return null;
        return castFromController(controller, [panelMesh]);
    }
    function castToInteractiveFromController(controller) {
        return castFromController(controller, interactiveList());
    }
    function nearestHit(panelHit, interactiveHit) {
        if (!panelHit)
            return { panelHit: null, interactiveHit, primary: interactiveHit, type: interactiveHit ? "interactive" : "" };
        if (!interactiveHit)
            return { panelHit, interactiveHit: null, primary: panelHit, type: "panel" };
        if (interactiveHit.distance + 0.015 < panelHit.distance)
            return { panelHit, interactiveHit, primary: interactiveHit, type: "interactive" };
        return { panelHit, interactiveHit, primary: panelHit, type: "panel" };
    }
    function primaryHitsFromController(controller) {
        return nearestHit(castToPanelFromController(controller), castToInteractiveFromController(controller));
    }
    function updateDragPlaneVR() {
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(uiGroup.quaternion).normalize();
        dragVR.plane.setFromNormalAndCoplanarPoint(normal, uiGroup.position);
    }
    function startDragVR(controller, preferredHit = null) {
        const hit = preferredHit || castToPanelFromController(controller);
        if (!hit)
            return false;
        const p = uvToCanvas(hit, panelCanvas);
        if (!p || inRect(p, HIT_ZONES.chat) || !inRect(p, HIT_ZONES.grab))
            return false;
        dragVR.active = true;
        dragVR.controller = controller;
        dragVR.downTime = performance.now();
        updateDragPlaneVR();
        if (raycaster.ray.intersectPlane(dragVR.plane, dragVR.intersection))
            dragVR.offset.copy(uiGroup.position).sub(dragVR.intersection);
        else
            dragVR.offset.set(0, 0, 0);
        return true;
    }
    function updateDragVR() {
        if (!dragVR.active || !dragVR.controller)
            return;
        setControllerRay(dragVR.controller);
        updateDragPlaneVR();
        if (raycaster.ray.intersectPlane(dragVR.plane, dragVR.intersection)) {
            uiGroup.position.copy(dragVR.intersection).add(dragVR.offset);
            const xrCam = renderer.xr.getCamera(camera);
            const headPos = new THREE.Vector3();
            xrCam.getWorldPosition(headPos);
            uiGroup.lookAt(headPos);
        }
    }
    function updateScrollVR() {
        if (!scrollVR.active || !scrollVR.controller)
            return;
        const hit = castToPanelFromController(scrollVR.controller);
        if (!hit)
            return;
        const p = uvToCanvas(hit, panelCanvas);
        if (!p || !inRect(p, HIT_ZONES.chat))
            return;
        const dy = p.y - scrollVR.lastCanvasY;
        scrollVR.lastCanvasY = p.y;
        if (Math.abs(dy) > 1)
            scrollVR.moved = true;
        state.scrollY = THREE.MathUtils.clamp(state.scrollY - dy * 1.15, 0, state.scrollMax);
        state.scrollVel = 0;
        drawPanel();
    }
    function endDragVR() {
        if (!dragVR.active)
            return { wasDrag: false };
        const heldMs = performance.now() - dragVR.downTime;
        dragVR.active = false;
        dragVR.controller = null;
        dragVR.downTime = 0;
        return { wasDrag: heldMs > 220 };
    }
    async function activateControllerTarget(controller, preferredHit = null) {
        const hits = primaryHitsFromController(controller);
        if (hits.type === "interactive") {
            await handleInteractiveClick?.(hits.interactiveHit || preferredHit);
            return;
        }
        if (hits.type === "panel") {
            await handleActionFromHit(hits.panelHit);
            return;
        }
        if (preferredHit)
            await handleInteractiveClick?.(preferredHit);
    }
    function makeController(i) {
        const controller = renderer.xr.getController(i);
        controller.addEventListener("connected", (event) => {
            controller.userData.inputSource = event.data || null;
            controller.userData.handedness = event.data?.handedness || "none";
            controller.userData.gamepad = event.data?.gamepad || null;
        });
        controller.addEventListener("disconnected", () => {
            controller.userData.inputSource = null;
            controller.userData.gamepad = null;
            controller.userData.handedness = "none";
            pressByController.delete(controller);
        });
        const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x9cefff, transparent: true, opacity: 0.72 });
        const line = new THREE.Line(lineGeo, lineMat);
        line.scale.z = 3.2;
        const reticle = new THREE.Mesh(new THREE.RingGeometry(0.012, 0.024, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false, side: THREE.DoubleSide }));
        reticle.position.z = -3.2;
        reticle.renderOrder = 100;
        reticle.visible = false;
        controller.userData.rayLine = line;
        controller.userData.rayReticle = reticle;
        controller.add(line, reticle);
        controller.addEventListener("selectstart", () => {
            const hits = primaryHitsFromController(controller);
            if (hits.type === "panel") {
                const p = uvToCanvas(hits.panelHit, panelCanvas);
                if (p && inRect(p, HIT_ZONES.chat)) {
                    scrollVR.active = true;
                    scrollVR.controller = controller;
                    scrollVR.lastCanvasY = p.y;
                    scrollVR.moved = false;
                    return;
                }
                if (startDragVR(controller, hits.panelHit))
                    return;
            }
            if (hits.type === "interactive" && hits.interactiveHit) {
                const handled = !!handleInteractivePressStart?.(hits.interactiveHit, controller);
                pressByController.set(controller, { hit: hits.interactiveHit, handled });
            }
        });
        controller.addEventListener("selectend", async () => {
            if (scrollVR.active && scrollVR.controller === controller) {
                const wasScroll = scrollVR.moved;
                scrollVR.active = false;
                scrollVR.controller = null;
                scrollVR.moved = false;
                if (!wasScroll)
                    await activateControllerTarget(controller);
                return;
            }
            const { wasDrag } = endDragVR();
            const press = pressByController.get(controller);
            pressByController.delete(controller);
            if (press) {
                handleInteractivePressEnd?.(press.hit, controller);
                if (!press.handled)
                    await handleInteractiveClick?.(press.hit);
                return;
            }
            if (!wasDrag)
                await activateControllerTarget(controller);
        });
        scene.add(controller);
        return controller;
    }
    const controller0 = makeController(0);
    const controller1 = makeController(1);
    const hand0 = renderer.xr.getHand(0);
    const hand1 = renderer.xr.getHand(1);
    scene.add(hand0, hand1);
    const handAction = { active: false, hand: null, mode: "", hit: null, handled: false, lastY: 0, dySmoothed: 0 };
    function getJoint(hand, name) {
        return hand?.joints?.[name] || null;
    }
    function isPinching(hand, wasActive) {
        const thumbTip = getJoint(hand, "thumb-tip");
        const indexTip = getJoint(hand, "index-finger-tip");
        if (!thumbTip || !indexTip)
            return false;
        thumbTip.getWorldPosition(vA);
        indexTip.getWorldPosition(vB);
        const distance = vA.distanceTo(vB);
        return wasActive ? distance < PINCH_OFF : distance < PINCH_ON;
    }
    function setHandRay(hand) {
        const indexTip = getJoint(hand, "index-finger-tip");
        if (!indexTip)
            return false;
        indexTip.getWorldPosition(vOrigin);
        const knuckle = getJoint(hand, "index-finger-phalanx-proximal") || getJoint(hand, "index-finger-metacarpal");
        if (knuckle) {
            knuckle.getWorldPosition(vA);
            vDir.copy(vOrigin).sub(vA).normalize();
        }
        else {
            const xrCam = renderer.xr.getCamera(camera);
            vDir.set(0, 0, -1).applyQuaternion(xrCam.quaternion).normalize();
        }
        raycaster.ray.origin.copy(vOrigin);
        raycaster.ray.direction.copy(vDir);
        return true;
    }
    function castFromHand(hand, objects) {
        if (!setHandRay(hand))
            return null;
        const list = objects.filter((object) => object && object.visible !== false);
        if (!list.length)
            return null;
        const hits = raycaster.intersectObjects(list, true);
        return hits.length ? hits[0] : null;
    }
    function clearHandAction() {
        handAction.active = false;
        handAction.hand = null;
        handAction.mode = "";
        handAction.hit = null;
        handAction.handled = false;
        handAction.dySmoothed = 0;
    }
    function beginHandAction() {
        for (const hand of [hand0, hand1]) {
            if (!isPinching(hand, false))
                continue;
            const panelHit = panelMesh.visible ? castFromHand(hand, [panelMesh]) : null;
            const interactiveHit = castFromHand(hand, interactiveList());
            const hits = nearestHit(panelHit, interactiveHit);
            if (hits.type === "panel") {
                const p = uvToCanvas(hits.panelHit, panelCanvas);
                if (p && inRect(p, HIT_ZONES.chat)) {
                    handAction.active = true;
                    handAction.hand = hand;
                    handAction.mode = "scroll";
                    handAction.lastY = p.y;
                    handAction.dySmoothed = 0;
                    return;
                }
            }
            if (hits.type === "interactive") {
                handAction.active = true;
                handAction.hand = hand;
                handAction.mode = "action";
                handAction.hit = hits.interactiveHit;
                handAction.handled = !!handleInteractivePressStart?.(hits.interactiveHit, hand);
                return;
            }
        }
    }
    function updateHandAction() {
        if (!renderer.xr.isPresenting) {
            if (handAction.active && handAction.mode === "action")
                handleInteractivePressEnd?.(handAction.hit, handAction.hand);
            clearHandAction();
            return;
        }
        if (!handAction.active) {
            beginHandAction();
            return;
        }
        const hand = handAction.hand;
        if (!hand) {
            clearHandAction();
            return;
        }
        if (!isPinching(hand, true)) {
            const hit = handAction.hit;
            const mode = handAction.mode;
            const handled = handAction.handled;
            clearHandAction();
            if (mode === "action" && hit) {
                handleInteractivePressEnd?.(hit, hand);
                if (!handled)
                    Promise.resolve(handleInteractiveClick?.(hit)).catch(() => { });
            }
            return;
        }
        if (handAction.mode !== "scroll")
            return;
        const hit = castFromHand(hand, [panelMesh]);
        if (!hit)
            return;
        const p = uvToCanvas(hit, panelCanvas);
        if (!p || !inRect(p, HIT_ZONES.chat))
            return;
        const dy = (p.y - handAction.lastY) / panelCanvas.height;
        handAction.lastY = p.y;
        handAction.dySmoothed = handAction.dySmoothed * 0.75 + dy * 0.25;
        state.scrollVel = THREE.MathUtils.clamp(state.scrollVel + handAction.dySmoothed * 20, -55, 55);
        drawPanel();
    }
    function updateThumbsticks() {
        for (const controller of [controller0, controller1]) {
            const gamepad = controller.userData.gamepad;
            if (!gamepad?.axes?.length)
                continue;
            const hit = castToPanelFromController(controller);
            if (!hit)
                continue;
            const p = uvToCanvas(hit, panelCanvas);
            if (!p || !inRect(p, HIT_ZONES.chat))
                continue;
            const axis = gamepad.axes.length >= 4 ? gamepad.axes[3] : gamepad.axes[1];
            if (Math.abs(axis) < 0.18)
                continue;
            state.scrollY = THREE.MathUtils.clamp(state.scrollY + axis * 13, 0, state.scrollMax);
            state.scrollVel = 0;
            drawPanel();
        }
    }
    function updateHover() {
        let selectedPanelHit = null;
        let selectedInteractiveHit = null;
        for (const controller of [controller0, controller1]) {
            const hits = primaryHitsFromController(controller);
            const line = controller.userData.rayLine;
            const reticle = controller.userData.rayReticle;
            const distance = hits.primary?.distance || 3.2;
            if (line) {
                line.material.color.set(hits.primary ? 0xffffff : 0x9cefff);
                line.material.opacity = hits.primary ? 1 : 0.62;
                line.scale.z = distance;
            }
            if (reticle) {
                reticle.visible = !!hits.primary;
                reticle.position.z = -distance;
                reticle.material.color.set(hits.type === "interactive" ? 0xffffff : 0xb9f3ff);
                reticle.scale.setScalar(hits.type === "interactive" ? 1.35 : 1);
            }
            if (hits.type === "panel" && !selectedPanelHit)
                selectedPanelHit = hits.panelHit;
            if (hits.type === "interactive" && !selectedInteractiveHit)
                selectedInteractiveHit = hits.interactiveHit;
        }
        if (!selectedInteractiveHit && !selectedPanelHit) {
            for (const hand of [hand0, hand1]) {
                const panelHit = panelMesh.visible ? castFromHand(hand, [panelMesh]) : null;
                const interactiveHit = castFromHand(hand, interactiveList());
                const hits = nearestHit(panelHit, interactiveHit);
                if (hits.type === "panel" && !selectedPanelHit)
                    selectedPanelHit = hits.panelHit;
                if (hits.type === "interactive" && !selectedInteractiveHit)
                    selectedInteractiveHit = hits.interactiveHit;
            }
        }
        handleMainPanelHover?.(selectedPanelHit);
        handleInteractiveHover?.(selectedInteractiveHit);
    }
    function tickXR() {
        if (!renderer.xr.isPresenting)
            return;
        if (dragVR.active)
            updateDragVR();
        if (scrollVR.active)
            updateScrollVR();
        updateHandAction();
        updateThumbsticks();
        updateHover();
    }
    return { tickXR, hands: { hand0, hand1 }, controllers: { controller0, controller1 } };
}
