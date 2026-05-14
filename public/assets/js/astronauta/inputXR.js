import { HIT_ZONES, PINCH_ON, PINCH_OFF } from "./config.js";

function uvToCanvas(hit, panelCanvas) {
  if (!hit?.uv) return null;
  return { x: hit.uv.x * panelCanvas.width, y: (1 - hit.uv.y) * panelCanvas.height };
}
function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

export function setupXRInput({
  THREE,
  renderer,
  scene,
  camera,
  panelMesh,
  panelCanvas,
  uiGroup,
  state,
  drawPanel,
  handleActionFromHit, 
}) {
  const raycaster = new THREE.Raycaster();
  const tempMatrix = new THREE.Matrix4();

  // -----------------------
  // Controllers
  // -----------------------
  const dragVR = {
    active: false,
    controller: null,
    downTime: 0,
    plane: new THREE.Plane(),
    intersection: new THREE.Vector3(),
    offset: new THREE.Vector3(),
  };

  const scrollVR = {
    active: false,
    controller: null,
    lastCanvasY: 0,
    moved: false,
  };

  function castToPanelFromController(controller) {
    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();
    const hits = raycaster.intersectObject(panelMesh, false);
    return hits.length ? hits[0] : null;
  }

  function updateDragPlaneVR() {
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(uiGroup.quaternion).normalize();
    dragVR.plane.setFromNormalAndCoplanarPoint(normal, uiGroup.position);
  }

  function startDragVR(controller) {
    const hit = castToPanelFromController(controller);
    if (!hit) return false;

    const p = uvToCanvas(hit, panelCanvas);
    if (!p) return false;

    if (inRect(p, HIT_ZONES.chat)) return false;
    if (!inRect(p, HIT_ZONES.grab)) return false;

    dragVR.active = true;
    dragVR.controller = controller;
    dragVR.downTime = performance.now();

    updateDragPlaneVR();
    if (raycaster.ray.intersectPlane(dragVR.plane, dragVR.intersection)) {
      dragVR.offset.copy(uiGroup.position).sub(dragVR.intersection);
    } else {
      dragVR.offset.set(0, 0, 0);
    }
    return true;
  }

  function updateDragVR() {
    if (!dragVR.active || !dragVR.controller) return;

    const controller = dragVR.controller;

    tempMatrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix).normalize();

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
    if (!scrollVR.active || !scrollVR.controller) return;

    const hit = castToPanelFromController(scrollVR.controller);
    if (!hit) return;

    const p = uvToCanvas(hit, panelCanvas);
    if (!p) return;

    if (!inRect(p, HIT_ZONES.chat)) return;

    const dy = p.y - scrollVR.lastCanvasY;
    scrollVR.lastCanvasY = p.y;

    if (Math.abs(dy) > 1) scrollVR.moved = true;

    state.scrollY = THREE.MathUtils.clamp(state.scrollY - dy * 1.15, 0, state.scrollMax);
    state.scrollVel = 0;
    drawPanel();
  }

  function endDragVR() {
    if (!dragVR.active) return { wasDrag: false };

    const heldMs = performance.now() - dragVR.downTime;
    dragVR.active = false;
    dragVR.controller = null;
    dragVR.downTime = 0;

    return { wasDrag: heldMs > 220 };
  }

  function makeController(i) {
    const c = renderer.xr.getController(i);

    c.addEventListener("connected", (e) => {
      c.userData.inputSource = e.data || null;
      c.userData.handedness = e.data?.handedness || "none";
      c.userData.gamepad = e.data?.gamepad || null;
    });

    c.addEventListener("disconnected", () => {
      c.userData.inputSource = null;
      c.userData.gamepad = null;
      c.userData.handedness = "none";
    });

    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1),
    ]);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({ transparent: true, opacity: 0.75 })
    );
    line.scale.z = 2.5;
    c.add(line);

    c.addEventListener("selectstart", () => {
      // 1) scroll en chat
      const hit = castToPanelFromController(c);
      if (hit) {
        const p = uvToCanvas(hit, panelCanvas);
        if (p && inRect(p, HIT_ZONES.chat)) {
          scrollVR.active = true;
          scrollVR.controller = c;
          scrollVR.lastCanvasY = p.y;
          scrollVR.moved = false;
          return;
        }
      }

      // 2) drag panel si apunta al grab
      startDragVR(c);
    });

    c.addEventListener("selectend", async () => {
      // fin scroll
      if (scrollVR.active && scrollVR.controller === c) {
        const wasScroll = scrollVR.moved;
        scrollVR.active = false;
        scrollVR.controller = null;
        scrollVR.moved = false;

        if (!wasScroll) {
          const hit = castToPanelFromController(c);
          if (hit) await handleActionFromHit(hit);
        }
        return;
      }

      const { wasDrag } = endDragVR();
      if (!wasDrag) {
        const hit = castToPanelFromController(c);
        if (hit) await handleActionFromHit(hit);
      }
    });

    scene.add(c);
    return c;
  }

  const controller0 = makeController(0);
  const controller1 = makeController(1);

  // -----------------------
  // Hands (pinch scroll)
  // -----------------------
  const hand0 = renderer.xr.getHand(0);
  const hand1 = renderer.xr.getHand(1);
  scene.add(hand0, hand1);

  const handScroll = { active: false, hand: null, lastY: 0, dySmoothed: 0 };

  const _vA = new THREE.Vector3();
  const _vB = new THREE.Vector3();
  const _vDir = new THREE.Vector3();
  const _vOrigin = new THREE.Vector3();

  function getJoint(hand, name) {
    return hand?.joints?.[name] || null;
  }

  function isPinching(hand, wasActive) {
    const thumbTip = getJoint(hand, "thumb-tip");
    const indexTip = getJoint(hand, "index-finger-tip");
    if (!thumbTip || !indexTip) return false;

    thumbTip.getWorldPosition(_vA);
    indexTip.getWorldPosition(_vB);
    const d = _vA.distanceTo(_vB);

    return wasActive ? (d < PINCH_OFF) : (d < PINCH_ON);
  }

  function castToPanelFromHand(hand) {
    const indexTip = getJoint(hand, "index-finger-tip");
    if (!indexTip) return null;

    indexTip.getWorldPosition(_vOrigin);

    const indexKnuckle =
      getJoint(hand, "index-finger-phalanx-proximal") ||
      getJoint(hand, "index-finger-metacarpal");

    if (indexKnuckle) {
      indexKnuckle.getWorldPosition(_vA);
      _vDir.copy(_vOrigin).sub(_vA).normalize();
    } else {
      const xrCam = renderer.xr.getCamera(camera);
      _vDir.set(0, 0, -1).applyQuaternion(xrCam.quaternion).normalize();
    }

    raycaster.ray.origin.copy(_vOrigin);
    raycaster.ray.direction.copy(_vDir);

    const hits = raycaster.intersectObject(panelMesh, false);
    return hits.length ? hits[0] : null;
  }

  function updateHandPinchScroll() {
    if (!renderer.xr.isPresenting) return;
    if (state.scrollMax <= 0) return;

    if (!handScroll.active) {
      const hands = [hand0, hand1];
      for (const h of hands) {
        if (!isPinching(h, false)) continue;

        const hit = castToPanelFromHand(h);
        if (!hit) continue;

        const p = uvToCanvas(hit, panelCanvas);
        if (!p) continue;
        if (!inRect(p, HIT_ZONES.chat)) continue;

        handScroll.active = true;
        handScroll.hand = h;
        handScroll.lastY = p.y;
        handScroll.dySmoothed = 0;
        return;
      }
      return;
    }

    const h = handScroll.hand;
    if (!h) { handScroll.active = false; handScroll.dySmoothed = 0; return; }

    if (!isPinching(h, true)) {
      handScroll.active = false;
      handScroll.hand = null;
      handScroll.dySmoothed = 0;
      return;
    }

    const hit = castToPanelFromHand(h);
    if (!hit) return;

    const p = uvToCanvas(hit, panelCanvas);
    if (!p) return;
    if (!inRect(p, HIT_ZONES.chat)) return;

    const dy = (p.y - handScroll.lastY) / panelCanvas.height;
    handScroll.lastY = p.y;

    handScroll.dySmoothed = handScroll.dySmoothed * 0.75 + dy * 0.25;

    const speed = 20;
    state.scrollVel += handScroll.dySmoothed * speed;
    state.scrollVel = THREE.MathUtils.clamp(state.scrollVel, -55, 55);

    drawPanel();
  }

  // Tick XR inputs en el animation loop
  function tickXR() {
    if (dragVR.active) updateDragVR();
    if (scrollVR.active) updateScrollVR();
    updateHandPinchScroll();
  }

  return { tickXR, hands: { hand0, hand1 }, controllers: { controller0, controller1 } };
}
