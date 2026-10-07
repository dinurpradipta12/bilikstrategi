import * as THREE from 'three';
import type { AvatarStyle } from './model';

export type AvatarVisualResources = { materials: THREE.Material[]; geometries: THREE.BufferGeometry[] };

function meshWithMaterial(root: THREE.Object3D, materialName: string) {
  let result: THREE.SkinnedMesh | undefined;
  root.traverse(child => {
    if (result || !(child instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (materials.some(material => material.name === materialName)) result = child;
  });
  return result;
}

export function applyAvatarAppearance(model: THREE.Group, hairTemplate: THREE.Group, style: AvatarStyle): AvatarVisualResources {
  const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [];
  const sourceHair = meshWithMaterial(hairTemplate, 'hair'), currentHair = meshWithMaterial(model, 'hair');
  if (sourceHair && currentHair) currentHair.geometry = sourceHair.geometry;
  // The boy/girl choices describe the full visual style. Reuse their compatible
  // lower-body geometry so a masculine hairstyle does not leave a skirt behind.
  if (style.hair === 'boy' || style.hair === 'girl') {
    const sourceOutfit = meshWithMaterial(hairTemplate, 'pants'), currentOutfit = meshWithMaterial(model, 'pants');
    if (sourceOutfit && currentOutfit) currentOutfit.geometry = sourceOutfit.geometry;
  }
  model.traverse(child => {
    if (!(child instanceof THREE.Mesh)) return;
    child.userData.sharedGeometry = true; child.castShadow = true; child.receiveShadow = true;
    const originals = Array.isArray(child.material) ? child.material : [child.material];
    const copies = originals.map(original => {
      const material = original.clone();
      if (material instanceof THREE.MeshStandardMaterial) {
        if (material.name === 'hair' && style.hairColor !== 'original') material.color.set(style.hairColor);
        if (material.name === 'shirt' && style.shirtColor !== 'original') material.color.set(style.shirtColor);
        material.roughness = Math.max(material.roughness, .72);
      }
      materials.push(material); return material;
    });
    child.material = Array.isArray(child.material) ? copies : copies[0];
    if (originals.some(material => material.name === 'mouth')) child.visible = false;
  });
  const head = model.getObjectByName('Head') as THREE.Bone | undefined;
  if (head) {
    const material = new THREE.MeshStandardMaterial({ color: '#b76570', roughness: .62 });
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-.052, .076, .224),
      new THREE.Vector3(0, .025, .23),
      new THREE.Vector3(.052, .076, .224),
    );
    const geometry = new THREE.TubeGeometry(curve, 16, .006, 6, false);
    const smile = new THREE.Mesh(geometry, material);
    smile.name = 'AvatarSmile'; smile.castShadow = true; head.add(smile);
    materials.push(material); geometries.push(geometry);
  }
  if (style.glasses && head) {
    const material = new THREE.MeshStandardMaterial({ color: '#263c3a', roughness: .45 }); materials.push(material);
    for (const x of [-.078, .078]) {
      const geometry = new THREE.TorusGeometry(.068, .009, 8, 20); geometries.push(geometry);
      const lens = new THREE.Mesh(geometry, material); lens.position.set(x, .155, .242); lens.userData.sharedMaterial = true; head.add(lens);
    }
    const geometry = new THREE.BoxGeometry(.038, .014, .014); geometries.push(geometry);
    const bridge = new THREE.Mesh(geometry, material); bridge.position.set(0, .155, .242); head.add(bridge);
  }
  return { materials, geometries };
}
