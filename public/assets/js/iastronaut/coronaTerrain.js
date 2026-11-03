// Lightweight stylized observation scene: no dynamic lights or shadows.
export function createCoronaTerrain({THREE,world, samples, objects, onChange,base=''}) {
    const material=new THREE.MeshBasicMaterial({color:0xff9c28});
    const sun=new THREE.Mesh(new THREE.SphereGeometry(11,48,24),material);
    sun.position.set(0,4,-28);world.add(sun);
    new THREE.TextureLoader().load(`${base}/assets/img/solar-mission/sun.jpg`,texture=>{
        texture.colorSpace=THREE.SRGBColorSpace;
        // Existing panorama is used as distant scenery, not as a spherical solar map.
        const backdrop=new THREE.Mesh(new THREE.SphereGeometry(100,32,16),new THREE.MeshBasicMaterial({map:texture,side:THREE.BackSide}));
        world.add(backdrop);
    });
    for(let i=0;i<8;i++){
        const arc=new THREE.Mesh(new THREE.TorusGeometry(12+i*.32,.045,5,64,Math.PI*1.35),new THREE.MeshBasicMaterial({color:i%2?0xffcf72:0xff692c}));
        arc.position.copy(sun.position);arc.rotation.z=i*.79;arc.rotation.y=(i%3-1)*.22;world.add(arc);
    }
    [[-3,1.7,-5],[0,3,-6],[3,1.7,-5]].forEach(([x,y,z],id)=>{
        const support=new THREE.Group();support.position.set(x,y,z);world.add(support);
        const target=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),new THREE.MeshBasicMaterial({color:0xffb340,wireframe:true}));support.add(target);
        const ring=new THREE.Mesh(new THREE.RingGeometry(.46,.50,32),new THREE.MeshBasicMaterial({color:0xffcf72,side:THREE.DoubleSide}));
        ring.position.set(x,y,z);world.add(ring);
        const sample={id,soporte:support,aro:ring};target.userData.muestra=sample;
        samples.push(sample);objects.push(target,ring);ring.userData.muestra=sample;
    });
    onChange();
}
