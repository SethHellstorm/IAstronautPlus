import { HIT_ZONES, PANEL_DISTANCE_MIN, PANEL_DISTANCE_MAX } from "./config.js";
function isMobileUA() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");
}
function uvToCanvas(hit, panelCanvas) {
    if (!hit?.uv)
        return null;
    return { x: hit.uv.x * panelCanvas.width, y: (1 - hit.uv.y) * panelCanvas.height };
}
function inRect(p, r) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}
export function setupDesktopMobileInput({ THREE, renderer, camera, panelMesh, panelCanvas, uiGroup, state, drawPanel, recenterPanel, setPanelDistance, getPanelDistance, handleActionFromHit, getInteractiveMeshes, handleInteractiveClick, handleInteractivePressStart, handleInteractivePressEnd, handleInteractiveHover, handleMainPanelHover, }) {
    const raycaster = new THREE.Raycaster();
    const mouseNDC = new THREE.Vector2();
    const dragPanel = {
        active: false,
        moved: false,
        downTime: 0,
        startX: 0,
        startY: 0,
        plane: new THREE.Plane(),
        intersection: new THREE.Vector3(),
        offset: new THREE.Vector3(),
    };
    const scrollDrag = { active: false, moved: false, lastCanvasY: 0 };
    const interactivePress = { active: false, moved: false, hit: null, handled: false, startX: 0, startY: 0 };
    let downHit = null;
    let downWasOnPanel = false;
    function setMouse(clientX, clientY) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouseNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        mouseNDC.y = -(((clientY - rect.top) / rect.height) * 2 - 1);
    }
    function raycast(clientX, clientY, objects) {
        const list = Array.isArray(objects) ? objects.filter(Boolean) : [];
        if (!list.length)
            return null;
        setMouse(clientX, clientY);
        raycaster.setFromCamera(mouseNDC, camera);
        const hits = raycaster.intersectObjects(list, true);
        return hits.length ? hits[0] : null;
    }
    function panelRaycast(ev) {
        if (!panelMesh.visible)
            return null;
        return raycast(ev.clientX, ev.clientY, [panelMesh]);
    }
    function interactiveRaycast(ev) {
        return raycast(ev.clientX, ev.clientY, (getInteractiveMeshes?.() || []).filter((object) => object && object.visible !== false));
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
    function pointerHits(ev) {
        return nearestHit(panelRaycast(ev), interactiveRaycast(ev));
    }
    function updateHover(ev) {
        const hits = pointerHits(ev);
        handleMainPanelHover?.(hits.type === "panel" ? hits.panelHit : null);
        handleInteractiveHover?.(hits.type === "interactive" ? hits.interactiveHit : null);
        renderer.domElement.style.cursor = hits.primary ? "pointer" : "default";
        return hits;
    }
    function updatePanelPlane() {
        const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(uiGroup.quaternion).normalize();
        dragPanel.plane.setFromNormalAndCoplanarPoint(normal, uiGroup.position);
    }
    function onPointerDown(ev) {
        downHit = null;
        downWasOnPanel = false;
        interactivePress.active = false;
        interactivePress.moved = false;
        interactivePress.hit = null;
        interactivePress.handled = false;
        const hits = pointerHits(ev);
        if (hits.type === "interactive" && hits.interactiveHit) {
            interactivePress.active = true;
            interactivePress.hit = hits.interactiveHit;
            interactivePress.startX = ev.clientX;
            interactivePress.startY = ev.clientY;
            interactivePress.handled = !!handleInteractivePressStart?.(hits.interactiveHit, null);
            handleInteractiveHover?.(hits.interactiveHit);
            handleMainPanelHover?.(null);
            ev.preventDefault();
            return;
        }
        const hit = hits.type === "panel" ? hits.panelHit : null;
        if (!hit)
            return;
        downHit = hit;
        downWasOnPanel = true;
        scrollDrag.active = false;
        scrollDrag.moved = false;
        const p = uvToCanvas(hit, panelCanvas);
        if (!p)
            return;
        if (inRect(p, HIT_ZONES.chat)) {
            scrollDrag.active = true;
            scrollDrag.lastCanvasY = p.y;
            dragPanel.active = false;
            dragPanel.moved = false;
            dragPanel.downTime = performance.now();
            dragPanel.startX = ev.clientX;
            dragPanel.startY = ev.clientY;
            return;
        }
        if (!inRect(p, HIT_ZONES.grab)) {
            dragPanel.active = false;
            dragPanel.moved = false;
            dragPanel.downTime = performance.now();
            dragPanel.startX = ev.clientX;
            dragPanel.startY = ev.clientY;
            return;
        }
        dragPanel.active = true;
        dragPanel.moved = false;
        dragPanel.downTime = performance.now();
        dragPanel.startX = ev.clientX;
        dragPanel.startY = ev.clientY;
        setMouse(ev.clientX, ev.clientY);
        raycaster.setFromCamera(mouseNDC, camera);
        updatePanelPlane();
        if (raycaster.ray.intersectPlane(dragPanel.plane, dragPanel.intersection))
            dragPanel.offset.copy(uiGroup.position).sub(dragPanel.intersection);
        else
            dragPanel.offset.set(0, 0, 0);
    }
    function onPointerMove(ev) {
        if (interactivePress.active) {
            const dx = ev.clientX - interactivePress.startX;
            const dy = ev.clientY - interactivePress.startY;
            if (Math.abs(dx) + Math.abs(dy) > 8)
                interactivePress.moved = true;
            const hit = interactiveRaycast(ev);
            handleInteractiveHover?.(hit);
            return;
        }
        if (scrollDrag.active) {
            const hit = panelRaycast(ev);
            if (!hit)
                return;
            const p = uvToCanvas(hit, panelCanvas);
            if (!p || !inRect(p, HIT_ZONES.chat))
                return;
            const dy = p.y - scrollDrag.lastCanvasY;
            scrollDrag.lastCanvasY = p.y;
            if (Math.abs(dy) > 1)
                scrollDrag.moved = true;
            state.scrollY = THREE.MathUtils.clamp(state.scrollY - dy * 1.15, 0, state.scrollMax);
            state.scrollVel = 0;
            drawPanel();
            return;
        }
        if (dragPanel.active) {
            const dx = ev.clientX - dragPanel.startX;
            const dy = ev.clientY - dragPanel.startY;
            if (Math.abs(dx) + Math.abs(dy) > 2)
                dragPanel.moved = true;
            setMouse(ev.clientX, ev.clientY);
            raycaster.setFromCamera(mouseNDC, camera);
            updatePanelPlane();
            if (raycaster.ray.intersectPlane(dragPanel.plane, dragPanel.intersection)) {
                uiGroup.position.copy(dragPanel.intersection).add(dragPanel.offset);
                uiGroup.lookAt(camera.position);
            }
            return;
        }
        updateHover(ev);
    }
    async function onPointerUp(ev) {
        if (interactivePress.active) {
            const hit = interactivePress.hit;
            const moved = interactivePress.moved;
            const handled = interactivePress.handled;
            interactivePress.active = false;
            interactivePress.hit = null;
            interactivePress.moved = false;
            interactivePress.handled = false;
            handleInteractivePressEnd?.(hit, null);
            if (!moved && !handled && hit)
                await handleInteractiveClick?.(hit);
            updateHover(ev);
            return;
        }
        if (!downWasOnPanel) {
            updateHover(ev);
            return;
        }
        const heldMs = performance.now() - (dragPanel.downTime || performance.now());
        const wasPanelDrag = dragPanel.active && (dragPanel.moved || heldMs > 180);
        const wasScrollDrag = scrollDrag.active && scrollDrag.moved;
        dragPanel.active = false;
        scrollDrag.active = false;
        if (!wasPanelDrag && !wasScrollDrag && downHit)
            await handleActionFromHit(downHit);
        downHit = null;
        downWasOnPanel = false;
        updateHover(ev);
    }
    function cancelDrag() {
        dragPanel.active = false;
        scrollDrag.active = false;
        downHit = null;
        downWasOnPanel = false;
        if (interactivePress.active)
            handleInteractivePressEnd?.(interactivePress.hit, null);
        interactivePress.active = false;
        interactivePress.hit = null;
        interactivePress.moved = false;
        interactivePress.handled = false;
        handleInteractiveHover?.(null);
        handleMainPanelHover?.(null);
    }
    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointercancel", cancelDrag);
    renderer.domElement.addEventListener("pointerleave", cancelDrag);
    function onWheel(ev) {
        const hit = panelRaycast(ev);
        if (!hit)
            return;
        const p = uvToCanvas(hit, panelCanvas);
        if (!p || !inRect(p, HIT_ZONES.chat))
            return;
        if (ev.shiftKey) {
            ev.preventDefault();
            const delta = Math.sign(ev.deltaY);
            setPanelDistance(THREE.MathUtils.clamp(getPanelDistance() + delta * 0.12, PANEL_DISTANCE_MIN, PANEL_DISTANCE_MAX));
            recenterPanel();
            return;
        }
        ev.preventDefault();
        state.scrollY = THREE.MathUtils.clamp(state.scrollY + Math.sign(ev.deltaY) * 70, 0, state.scrollMax);
        state.scrollVel = 0;
        drawPanel();
    }
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });
    const look = { active: false, yaw: 0, pitch: 0, lastX: 0, lastY: 0 };
    function onLookDown(ev) {
        if (isMobileUA())
            return;
        if (!(ev.button === 2 || ev.shiftKey))
            return;
        look.active = true;
        look.lastX = ev.clientX;
        look.lastY = ev.clientY;
        ev.preventDefault();
    }
    function onLookMove(ev) {
        if (!look.active)
            return;
        const dx = ev.clientX - look.lastX;
        const dy = ev.clientY - look.lastY;
        look.lastX = ev.clientX;
        look.lastY = ev.clientY;
        look.yaw -= dx * 0.003;
        look.pitch = THREE.MathUtils.clamp(look.pitch - dy * 0.003, -1.2, 1.2);
        camera.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, "YXZ")));
        uiGroup.lookAt(camera.position);
    }
    function onLookUp() {
        look.active = false;
    }
    renderer.domElement.addEventListener("contextmenu", (event) => event.preventDefault());
    renderer.domElement.addEventListener("mousedown", onLookDown);
    window.addEventListener("mousemove", onLookMove);
    window.addEventListener("mouseup", onLookUp);
    const touchLook = { active: false, lastX: 0, lastY: 0 };
    const pinch = { active: false, startDist: 0, startPanelDistance: 0 };
    const touchScroll = { active: false, lastY: 0 };
    function dist2Touches(t0, t1) {
        return Math.hypot(t0.clientX - t1.clientX, t0.clientY - t1.clientY);
    }
    function onTouchStart(ev) {
        if (!isMobileUA() || renderer.xr.isPresenting)
            return;
        if (ev.touches.length === 2) {
            pinch.active = true;
            pinch.startDist = dist2Touches(ev.touches[0], ev.touches[1]);
            pinch.startPanelDistance = getPanelDistance();
            touchLook.active = false;
            touchScroll.active = false;
            ev.preventDefault();
            return;
        }
        if (ev.touches.length !== 1)
            return;
        const touch = ev.touches[0];
        const panelHit = panelMesh.visible ? raycast(touch.clientX, touch.clientY, [panelMesh]) : null;
        const interactiveHit = raycast(touch.clientX, touch.clientY, (getInteractiveMeshes?.() || []).filter((object) => object && object.visible !== false));
        const hits = nearestHit(panelHit, interactiveHit);
        if (hits.type === "panel") {
            const p = uvToCanvas(hits.panelHit, panelCanvas);
            if (p && inRect(p, HIT_ZONES.chat)) {
                touchScroll.active = true;
                touchScroll.lastY = touch.clientY;
                touchLook.active = false;
                ev.preventDefault();
            }
            return;
        }
        if (hits.type === "interactive") {
            touchLook.active = false;
            ev.preventDefault();
            return;
        }
        touchLook.active = true;
        touchLook.lastX = touch.clientX;
        touchLook.lastY = touch.clientY;
        ev.preventDefault();
    }
    function onTouchMove(ev) {
        if (!isMobileUA() || renderer.xr.isPresenting)
            return;
        if (pinch.active && ev.touches.length === 2) {
            const ratio = dist2Touches(ev.touches[0], ev.touches[1]) / Math.max(1, pinch.startDist);
            setPanelDistance(THREE.MathUtils.clamp(pinch.startPanelDistance / ratio, PANEL_DISTANCE_MIN, PANEL_DISTANCE_MAX));
            recenterPanel();
            ev.preventDefault();
            return;
        }
        if (touchScroll.active && ev.touches.length === 1) {
            const touch = ev.touches[0];
            const dy = touch.clientY - touchScroll.lastY;
            touchScroll.lastY = touch.clientY;
            state.scrollY = THREE.MathUtils.clamp(state.scrollY - dy * 1.2, 0, state.scrollMax);
            state.scrollVel = 0;
            drawPanel();
            ev.preventDefault();
            return;
        }
        if (touchLook.active && ev.touches.length === 1) {
            const touch = ev.touches[0];
            const dx = touch.clientX - touchLook.lastX;
            const dy = touch.clientY - touchLook.lastY;
            touchLook.lastX = touch.clientX;
            touchLook.lastY = touch.clientY;
            look.yaw -= dx * 0.0035;
            look.pitch = THREE.MathUtils.clamp(look.pitch - dy * 0.0035, -1.2, 1.2);
            camera.quaternion.copy(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch, look.yaw, 0, "YXZ")));
            uiGroup.lookAt(camera.position);
            ev.preventDefault();
        }
    }
    function onTouchEnd(ev) {
        if (!isMobileUA())
            return;
        if (ev.touches.length < 2)
            pinch.active = false;
        if (ev.touches.length === 0) {
            touchLook.active = false;
            touchScroll.active = false;
        }
    }
    renderer.domElement.addEventListener("touchstart", onTouchStart, { passive: false });
    renderer.domElement.addEventListener("touchmove", onTouchMove, { passive: false });
    renderer.domElement.addEventListener("touchend", onTouchEnd, { passive: false });
    renderer.domElement.addEventListener("touchcancel", onTouchEnd, { passive: false });
    return function dispose() {
        renderer.domElement.removeEventListener("pointerdown", onPointerDown);
        window.removeEventListener("pointermove", onPointerMove);
        renderer.domElement.removeEventListener("pointerup", onPointerUp);
        renderer.domElement.removeEventListener("pointercancel", cancelDrag);
        renderer.domElement.removeEventListener("pointerleave", cancelDrag);
        renderer.domElement.removeEventListener("wheel", onWheel);
        renderer.domElement.removeEventListener("mousedown", onLookDown);
        window.removeEventListener("mousemove", onLookMove);
        window.removeEventListener("mouseup", onLookUp);
        renderer.domElement.removeEventListener("touchstart", onTouchStart);
        renderer.domElement.removeEventListener("touchmove", onTouchMove);
        renderer.domElement.removeEventListener("touchend", onTouchEnd);
        renderer.domElement.removeEventListener("touchcancel", onTouchEnd);
    };
}
