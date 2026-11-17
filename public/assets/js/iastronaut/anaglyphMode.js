export function createAnaglyphMode({renderer, scene, camera, getPlutoHUD}) {
    const box = document.createElement('div');
    box.style.cssText = 'position:fixed;top:60px;right:12px;z-index:20;padding:10px;border:1px solid #35dff2;border-radius:8px;background:#071222ed;color:white;font:14px system-ui;max-width:240px';
    box.hidden = true;
    box.innerHTML = `<button type="button" aria-pressed="false">Activar 3D rojo/cian</button>
        <label style="display:block;margin-top:8px">Profundidad <input aria-label="Profundidad 3D" type="range" min="0" max="100" value="40" style="width:130px"></label>
        <small>Rojo: ojo izquierdo. Cian: ojo derecho.</small><div role="status" aria-live="polite"></div>`;
    document.body.appendChild(box);
    const button=box.querySelector('button'), slider=box.querySelector('input'), status=box.querySelector('[role=status]');
    let effect=null, enabled=false, loading=false, token=0;
    let savedRatio=renderer.getPixelRatio(), savedFocus=camera.focus;
    function disable() {
        token++; enabled=false;
        if(effect) {effect.dispose();effect=null;renderer.setPixelRatio(savedRatio);renderer.setSize(innerWidth,innerHeight);camera.focus=savedFocus;}
        button.textContent='Activar 3D rojo/cian';button.setAttribute('aria-pressed','false');
    }
    function resize() {if(effect) effect.setSize(innerWidth,innerHeight);}
    button.addEventListener('click',async()=>{
        if(enabled) {disable();return;}
        if(loading) return;
        const request=++token;loading=true;button.disabled=true;status.textContent='Cargando 3D...';
        try {
            const {AnaglyphEffect}=await import('./AnaglyphEffect.js');
            if(request!==token || renderer.xr.isPresenting || !getPlutoHUD()) return;
            savedRatio=renderer.getPixelRatio();savedFocus=camera.focus;
            effect=new AnaglyphEffect(renderer);renderer.setPixelRatio(Math.min(savedRatio,1));resize();
            camera.focus=20;enabled=true;
            button.textContent='Desactivar 3D rojo/cian';button.setAttribute('aria-pressed','true');
        } catch(error) {disable();status.textContent='No se pudo activar el 3D. Intenta de nuevo.';console.error(error);}
        finally {loading=false;button.disabled=false;if(enabled || request!==token) status.textContent='';}
    });
    renderer.xr.addEventListener('sessionstart',()=>{disable();box.hidden=true;});
    window.addEventListener('resize',resize);
    return {render() {
        const hud=getPlutoHUD();
        const available=!!hud && !renderer.xr.isPresenting;
        box.hidden=!available;
        if(!available && (enabled || loading)) disable();
        if(!enabled || !effect) {renderer.render(scene,camera);return;}
        effect.setEyeSeparation(Number(slider.value)*0.001);
        const visible=hud.visible;
        // Render the world stereoscopically; keep UI and mouse targeting aligned.
        hud.visible=false;
        try {effect.render(scene,camera);} finally {hud.visible=visible;}
        if(!visible) return;
        const uiObjects=new Set();hud.traverse(object=>uiObjects.add(object));
        const hidden=[];
        scene.traverse(object=>{
            if(object.visible && (object.isMesh || object.isSprite || object.isPoints || object.isLine) && !uiObjects.has(object)) {
                hidden.push(object);object.visible=false;
            }
        });
        const background=scene.background, autoClear=renderer.autoClear;
        try {scene.background=null;renderer.autoClear=false;renderer.clearDepth();renderer.render(scene,camera);}
        finally {scene.background=background;renderer.autoClear=autoClear;for(const object of hidden)object.visible=true;}
    }};
}
