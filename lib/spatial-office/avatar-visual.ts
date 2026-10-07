import * as THREE from 'three';
import type { AvatarStyle } from './model';

export type AvatarVisualResources = { materials: THREE.Material[]; geometries: THREE.BufferGeometry[] };

function hairMesh(root: THREE.Object3D) {
  let result: THREE.SkinnedMesh | undefined;
  root.traverse(child => {
    if (result || !(child instanceof THREE.SkinnedMesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    if (materials.some(material => material.name === 'hair')) result = child;
  });
  return result;
}

export function applyAvatarAppearance(model: THREE.Group, hairTemplate: THREE.Group, style: AvatarStyle): AvatarVisualResources {
  const materials: THREE.Material[] = [], geometries: THREE.BufferGeometry[] = [];
  const sourceHair = hairMesh(hairTemplate), currentHair = hairMesh(model);
  if (sourceHair && currentHair) currentHair.geometry = sourceHair.geometry;
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
  });
  const head = model.getObjectByName('Head') as THREE.Bone | undefined;
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
