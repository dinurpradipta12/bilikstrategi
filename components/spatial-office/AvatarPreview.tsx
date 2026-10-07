'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { applyAvatarAppearance } from '@/lib/spatial-office/avatar-visual';
import { AVATAR_ASSETS, AVATAR_LABELS, type AvatarStyle } from '@/lib/spatial-office/model';

type LoadedAvatar = { scene: THREE.Group; animations: THREE.AnimationClip[] };
const cache = new Map<AvatarStyle['model'], Promise<LoadedAvatar>>();
function loadAvatar(model: AvatarStyle['model']) {
  let request = cache.get(model);
  if (!request) {
    request = new GLTFLoader().loadAsync(`/spatial-assets/${AVATAR_ASSETS[model]}.glb`).then(({ scene, animations }) => ({ scene, animations }));
    cache.set(model, request);
  }
  return request;
}

export default function AvatarPreview({ value }: { value: AvatarStyle }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let disposed = false, frame = 0, mixer: THREE.AnimationMixer | undefined;
    let resources = { materials: [] as THREE.Material[], geometries: [] as THREE.BufferGeometry[] };
    setState('loading');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, .1, 10);
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' }); }
    catch { queueMicrotask(() => setState('error')); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; renderer.shadowMap.enabled = true;
    renderer.domElement.setAttribute('aria-label', `Pratinjau avatar ${AVATAR_LABELS[value.model]}`); container.appendChild(renderer.domElement);
    scene.add(new THREE.HemisphereLight('#fff8e8', '#b6c4b7', 2));
    const key = new THREE.DirectionalLight('#fff1d5', 3); key.position.set(2, 3, 4); key.castShadow = true; scene.add(key);
    const floorMaterial = new THREE.MeshStandardMaterial({ color: '#dce6d3', roughness: .95 });
    const floorGeometry = new THREE.CircleGeometry(.72, 48), floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -.015; floor.receiveShadow = true; scene.add(floor);
    const resize = () => { const width = container.clientWidth || 180, height = container.clientHeight || 220; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    void Promise.all([loadAvatar(value.model), loadAvatar(value.hair)]).then(([base, hair]) => {
      if (disposed) return;
      const model = cloneSkeleton(base.scene) as THREE.Group; model.scale.setScalar(1.38); model.rotation.y = -.08; scene.add(model);
      resources = applyAvatarAppearance(model, hair.scene, value);
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
      const verticalDistance = size.y / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
      const horizontalDistance = size.x / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect);
      camera.position.set(center.x, center.y, center.z + Math.max(verticalDistance, horizontalDistance) * 1.12);
      camera.lookAt(center); camera.updateProjectionMatrix();
      mixer = new THREE.AnimationMixer(model); const idle = base.animations.find(clip => clip.name === 'Idle'); if (idle) mixer.clipAction(idle).play();
      const clock = new THREE.Clock();
      const animate = () => { if (disposed) return; frame = requestAnimationFrame(animate); mixer?.update(Math.min(clock.getDelta(), .05)); renderer.render(scene, camera); };
      animate(); setState('ready');
    }).catch(() => { if (!disposed) setState('error'); });
    return () => {
      disposed = true; cancelAnimationFrame(frame); observer.disconnect(); mixer?.stopAllAction();
      resources.geometries.forEach(geometry => geometry.dispose()); resources.materials.forEach(material => material.dispose());
      floorGeometry.dispose(); floorMaterial.dispose(); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, [value]);
  return <div className="office-avatar-preview" aria-live="polite">
    <div className="office-avatar-preview-canvas" ref={host} />
    <span className="office-avatar-preview-label">PREVIEW 3D</span>
    {state !== 'ready' && <span className="office-avatar-preview-status">{state === 'error' ? 'Preview belum tersedia' : 'Memuat avatar…'}</span>}
  </div>;
}
