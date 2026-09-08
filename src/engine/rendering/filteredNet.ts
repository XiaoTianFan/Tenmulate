import * as THREE from 'three';

/** Integrate each thread across the pixel footprint instead of thresholding a
 * minified alpha texture. Unresolved weave converges to its area coverage. */
export const NET_COVERAGE_GLSL = `
  float threadIntegral(float x, float duty) {
    return floor(x) * duty + min(fract(x), duty);
  }
  float threadCoverage(float coordinate, float footprint, float duty) {
    float width = max(footprint, .0001);
    float center = coordinate + duty * .5;
    return clamp((threadIntegral(center + width * .5, duty)
      - threadIntegral(center - width * .5, duty)) / width, 0., 1.);
  }
`;

/** Preserve authored sag, tape, posts and registration. Both asset quality tiers
 * use the same filtered cord surface so adaptive resolution cannot erase the net. */
export function installFilteredNet(root: THREE.Group): THREE.Mesh | null {
  root.updateWorldMatrix(true,true);
  const sources: THREE.Mesh[] = [];
  root.traverse(object => {
    if (object instanceof THREE.Mesh && ['woven-net', 'performance-net'].includes(object.userData.role)) sources.push(object);
  });
  if (!sources.length) return null;
  const bounds = new THREE.Box3();
  for (const mesh of sources) bounds.union(new THREE.Box3().setFromObject(mesh));
  const width = bounds.max.x - bounds.min.x, centerX = (bounds.max.x + bounds.min.x) / 2;
  const geometry = new THREE.BufferGeometry(), positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const pitch = Number(sources[0]!.userData.meshPitch) || .042;
  const duty = 2 * (Number(sources[0]!.userData.cordRadius) || .0022) / pitch;
  const rows = Math.round((bounds.max.y - bounds.min.y) / pitch), inverse = root.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  for (let i = 0; i <= 48; i++) {
    const x = bounds.min.x + width * i / 48;
    const top = bounds.max.y - .156 * (1 - ((x - centerX) / (width / 2)) ** 2);
    for (const [y,v] of [[bounds.min.y,0],[top,rows]]) {
      point.set(x,y,(bounds.min.z+bounds.max.z)/2).applyMatrix4(inverse);
      positions.push(point.x,point.y,point.z); uv.push((x-bounds.min.x)/pitch,v!);
    }
    if (i < 48) {const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const material = new THREE.MeshBasicMaterial({color:0x17231e,transparent:true,depthWrite:false,side:THREE.DoubleSide});
  material.forceSinglePass=true;
  material.onBeforeCompile = shader => {
    shader.uniforms.netDuty={value:duty};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 netUv;')
      .replace('#include <uv_vertex>','#include <uv_vertex>\nnetUv = uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec2 netUv; uniform float netDuty;\n${NET_COVERAGE_GLSL}`)
      .replace('#include <alphamap_fragment>',`#include <alphamap_fragment>
        vec2 footprint = fwidth(netUv);
        float a = threadCoverage(netUv.x, footprint.x, netDuty);
        float b = threadCoverage(netUv.y, footprint.y, netDuty);
        diffuseColor.a *= 1. - (1. - a) * (1. - b);`);
  };
  material.customProgramCacheKey=()=> 'filtered-tennis-net-v1';
  const net=new THREE.Mesh(geometry,material);net.name='Filtered net weave';net.userData.role='filtered-net';
  for (const mesh of sources) mesh.visible=false;
  root.add(net);return net;
}
