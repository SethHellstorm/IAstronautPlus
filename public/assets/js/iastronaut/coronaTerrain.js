// Lightweight stylized observation scene: no dynamic lights or shadows.
export function createCoronaTerrain({THREE,world, samples, objects, onChange}) {
    // A single fixed observation plane, shared by both eyes in VR.
    // The occulted disk and corona use one draw call, without bloom or particles.
    const eclipseMaterial = new THREE.ShaderMaterial({
        depthWrite: true,
        transparent: true,
        toneMapped: false,
        vertexShader: `
            varying vec2 coronaUV;
            void main() {
                coronaUV = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            precision mediump float;
            varying vec2 coronaUV;
            float plume(float angle, float center, float width) {
                float d = atan(sin(angle-center), cos(angle-center));
                return exp(-d*d/(width*width));
            }
            void main() {
                vec2 p = (coronaUV - 0.5) * 4.8;
                float r = length(p);
                float a = atan(p.y, p.x);
                float h = max(r-1.0, 0.0);
                float streams = 0.55 + 0.20*sin(a*5.0+0.7)
                    + 0.13*sin(a*9.0-1.2) + 0.08*sin(a*17.0);
                float filaments = 0.88 + 0.07*sin(a*79.0+h*4.0)
                    + 0.05*sin(a*137.0-h*8.0);
                float extent = 0.24 + 0.30*streams;
                float halo = (0.62*exp(-h*12.0)
                    + 0.46*exp(-h/extent))*filaments;
                halo *= 1.0-smoothstep(1.85,2.35,r);
                float rim = exp(-pow(h/0.009,2.0));
                float peaks = plume(a,0.65,0.045)*0.11
                    + plume(a,1.36,0.065)*0.085
                    + plume(a,2.12,0.038)*0.055
                    + plume(a,3.02,0.055)*0.095
                    + plume(a,-1.18,0.06)*0.075;
                float prominence = smoothstep(0.002,0.013,peaks)
                    * (1.0-smoothstep(peaks*0.55,peaks+0.008,h));
                vec3 color = vec3(0.87,0.92,1.0)*halo;
                color += vec3(1.0,0.15,0.29)*(rim*0.65+prominence*0.9);
                // Opaque center masks the photosphere, as in the reference.
                color *= smoothstep(0.996,1.003,r);
                float opacity = 1.0-smoothstep(1.15,2.35,r);
                gl_FragColor = vec4(color,opacity);
            }
        `
    });
    const eclipse = new THREE.Mesh(new THREE.PlaneGeometry(52.8,52.8), eclipseMaterial);
    eclipse.name = 'Corona solar - observacion con disco ocultado';
    eclipse.position.set(0,4,-28);
    world.add(eclipse);
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
    stars.name = 'Estrellas de fondo - corona solar';
    world.add(stars);
    [[-12.3,4,-27.8],[0,20,-27.8],[8.8,10.7,-27.8]].forEach(([x,y,z],id)=>{
        const support=new THREE.Group();support.position.set(x,y,z);world.add(support);
        const target=new THREE.Mesh(new THREE.IcosahedronGeometry(.32,1),new THREE.MeshBasicMaterial({color:0xffb340,wireframe:true}));support.add(target);
        const ring=new THREE.Mesh(new THREE.RingGeometry(.65,.72,32),new THREE.MeshBasicMaterial({color:0xffcf72,side:THREE.DoubleSide}));
        ring.position.set(x,y,z);world.add(ring);
        target.name = ['Corona interior','Filamento coronal','Prominencia solar'][id];
        const sample={id,soporte:support,aro:ring};target.userData.muestra=sample;
        samples.push(sample);objects.push(target,ring);ring.userData.muestra=sample;
    });
    onChange();
}
