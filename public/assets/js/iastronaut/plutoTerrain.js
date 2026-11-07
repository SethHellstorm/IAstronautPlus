export function createPlutoTerrain({THREE,world,base,samples,objects,onChange}) {
    let loaded=0;
    const loader=new THREE.TextureLoader();
    function body(file,radius,x,y,z){
        const material=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
        const mesh=new THREE.Mesh(new THREE.SphereGeometry(radius,48,32),material);
        mesh.position.set(x,y,z);world.add(mesh);
        loader.load(`${base}/assets/sidequests/pluto/${file}`,texture=>{
            texture.colorSpace=THREE.SRGBColorSpace;material.map=texture;material.needsUpdate=true;
            if(++loaded===2)onChange();
        },undefined,()=>onChange('No se pudo cargar una textura de Pluton. Recarga para reintentar.'));
    }
    body('pluto_color.png',7,-4,2,-23);
    body('charon_color.png',3.5,8,4,-27);
    world.add(new THREE.AmbientLight(0xffffff,0.5));
    const light=new THREE.DirectionalLight(0xfff3e4,2.2);light.position.set(-15,15,12);world.add(light);
    // Static, deterministic star field: a single draw call for the entire sky.
    const count = 700;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    let seed = 2917;
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
        const y = random() * 2 - 1;
        const angle = random() * Math.PI * 2;
        const radial = Math.sqrt(1 - y * y);
        positions.set([radial * Math.cos(angle) * 85, y * 85,
            radial * Math.sin(angle) * 85], i * 3);
        const brightness = 0.24 + Math.pow(random(), 3) * 0.5;
        colors.set([brightness * 0.92, brightness * 0.96, brightness], i * 3);
    }
    const starsGeometry = new THREE.BufferGeometry();
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    starsGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({
        size: 0.12, sizeAttenuation: true, vertexColors: true, toneMapped: false
    }));
    stars.name = 'Estrellas de fondo - Pluton';
    world.add(stars);
    [[-7,5,-17.3],[-1,4,-16.8],[-4,-1,-16.5]].forEach(([x,y,z],id)=>{
        const support=new THREE.Group();support.position.set(x,y,z);world.add(support);
        const target=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),new THREE.MeshBasicMaterial({color:0xffb340,wireframe:true}));support.add(target);
        const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.72,32),new THREE.MeshBasicMaterial({color:0xffcf72,side:THREE.DoubleSide}));
        ring.position.set(x,y,z);world.add(ring);
        target.name = ['Hielo de nitrogeno','Hielo de agua','Terreno rojizo'][id];
        // Static labels share the target's visibility and require no per-frame redraw.
        const canvas = document.createElement('canvas');
        canvas.width = 768; canvas.height = 144;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(5,17,30,0.94)';
        ctx.fillRect(3,3,762,138);
        ctx.strokeStyle = '#FFCF72'; ctx.lineWidth = 5;
        ctx.strokeRect(3,3,762,138);
        ctx.fillStyle = '#FFF1D0';
        ctx.font = '700 42px system-ui, sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(target.name.toUpperCase(),384,72);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.generateMipmaps = false;
        // Fixed world-space panels can be raycast by XR controllers and hands
        // without the camera dependency of Sprite.raycast.
        const label = new THREE.Mesh(new THREE.PlaneGeometry(4,0.75), new THREE.MeshBasicMaterial({
            map:texture, transparent:true, depthTest:false, depthWrite:false, toneMapped:false,
            side:THREE.DoubleSide
        }));
        label.name = `Letrero: ${target.name}`;
        // Above the eclipse and halo, below the mission HUD and XR pointer.
        label.renderOrder = 50;
        label.position.set(0,1.35,0.1);
        support.add(label);
        const sample={id,soporte:support,aro:ring};target.userData.muestra=sample;
        label.userData.muestra=sample;
        objects.push(label);
        samples.push(sample);objects.push(target,ring);ring.userData.muestra=sample;
    });
    if(loaded===2) onChange();
}
