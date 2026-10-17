import { createMoonTerrain } from './moonTerrain.js';
import { createMoonInterface } from './moonInterface.js';
import { createMoonProgress } from './moonProgress.js';
import { drawMoonExit } from './moonHud.js';

export function createMoonExperience({ THREE, scene, camera, renderer, base, onReturn, exitVR }) {
    const root = new THREE.Group();
    root.visible=false;
    scene.add(root);
    const world=new THREE.Group();root.add(world);
    let storage;try {storage=window.localStorage;} catch (_) {}
    const progress=createMoonProgress(storage);
    const samples=[],objects=[];
    let ready=false,error='',active=false,needsAnchor=true;
    const viewPosition=new THREE.Vector3(),viewRotation=new THREE.Quaternion();
    const hud=createMoonInterface({THREE,scene:root,renderer,
        getMission:()=>({ready,error,started:progress.getState().started,collected:progress.getState().collected.length}),
        recenter:()=>anchor(false),onReturn,onStart:()=>progress.start()});
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=256;
    const ctx=canvas.getContext('2d');
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
    const exit=new THREE.Mesh(new THREE.PlaneGeometry(.64,.256),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));
    exit.renderOrder=100;root.add(exit);
    let exitBusy=false,exitHover=false,exitError=false;
    function drawExit() {drawMoonExit(ctx,{busy:exitBusy,hovered:exitHover,error:exitError,immersive:renderer.xr.isPresenting});texture.needsUpdate=true;}
    function anchor(includeWorld=true) {
        const view=renderer.xr.isPresenting?renderer.xr.getCamera(camera):camera;
        view.updateWorldMatrix(true,false);
        view.getWorldPosition(viewPosition);
        const front=view.getWorldDirection(new THREE.Vector3());
        const yaw=Math.hypot(front.x,front.z)>.001?Math.atan2(-front.x,-front.z):0;
        viewRotation.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
        if(includeWorld) {world.position.copy(viewPosition);world.position.y-=1.48;world.quaternion.copy(viewRotation);}
        hud.group.position.set(0,0,-3.2).applyQuaternion(viewRotation).add(viewPosition);
        hud.group.quaternion.copy(viewRotation);
        exit.position.set(1.45,-1.05,-3.2).applyQuaternion(viewRotation).add(viewPosition);
        exit.quaternion.copy(viewRotation);
        root.updateMatrixWorld(true);
    }
    function refreshSamples() {
        const collected=new Set(progress.getState().collected);
        for(const sample of samples) {sample.soporte.visible=!collected.has(sample.id);sample.aro.visible=!collected.has(sample.id);}
    }
    createMoonTerrain({THREE,scene:root,world,renderer,base,samples,objects,onChange:message=>{
        error=message || '';ready=samples.length===3 && !error;
        refreshSamples();hud.refresh(error);
    }});
    async function handleHit(hit) {
        if(!active || !root.visible || !hit)return false;
        if(hit.object===exit) {
            if(!renderer.xr.isPresenting || exitBusy)return true;
            exitBusy=true;exitError=false;drawExit();
            try {exitError=!(await exitVR());} catch (_) {exitError=true;}
            finally {exitBusy=false;drawExit();}
            return true;
        }
        if(hud.clickHit(hit))return true;
        const sample=hit.object.userData.muestra;
        if(ready && hud.canCollect() && sample && progress.collect(sample.id)) {
            refreshSamples();hud.refresh();
        }
        return true; // Suelo y rocas decorativas impiden seleccionar a traves de ellos.
    }
    function hoverHit(hit) {
        const next=hit?.object===exit;
        if(next!==exitHover){exitHover=next;drawExit();}
        hud.hoverHit(hit);
        for(const sample of samples) sample.aro.material.color.setHex(hit?.object.userData.muestra===sample?0xffffff:0x44dfff);
    }
    drawExit();
    return {
        root,enter(){active=true;needsAnchor=true;root.visible=false;drawExit();hud.refresh(error);},
        leave(){active=false;root.visible=false;hud.stop();},
        update(frame){
            if(!active)return;
            if(needsAnchor) {
                if(renderer.xr.isPresenting) {
                    const reference=renderer.xr.getReferenceSpace();
                    if(!frame || !reference || !frame.getViewerPose(reference))return;
                }
                anchor();needsAnchor=false;root.visible=true;
            }
        },
        onXRStart(){needsAnchor=true;root.visible=false;drawExit();void hud.onXRStart();},
        onXREnd(){needsAnchor=true;exitBusy=false;drawExit();hud.onXREnd();},
        recenter:()=>anchor(false),handleHit,hoverHit,
        getInteractiveMeshes(){
            if(!active || !root.visible)return [];
            const collected=new Set(progress.getState().collected);
            return [...hud.getInteractiveMeshes(),exit,...objects.filter(o=>!o.userData.muestra || !collected.has(o.userData.muestra.id))];
        },
        scroll:(ray,delta)=>hud.scroll(ray,delta)
    };
}
