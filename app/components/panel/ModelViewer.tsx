import { useEffect, useRef, useState } from 'react';
import {
  AmbientLight,
  Box3,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  type Object3D,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/** Draws a 3D model you can drag to rotate. This file is loaded only when a model is chosen. */
export default function ModelViewer({ object }: { object: Object3D }) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    const width = holder.clientWidth || 300;
    const height = 220;
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    holder.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = null;
    scene.add(new AmbientLight(0xffffff, 1.2));
    const light = new DirectionalLight(0xffffff, 2);
    light.position.set(1, 2, 3);
    scene.add(light);

    object.traverse((child) => {
      if (child instanceof Mesh)
        child.material = new MeshStandardMaterial({ color: 0x1256b8, roughness: 0.6 });
    });
    scene.add(object);
    const box = new Box3().setFromObject(object);
    const center = box.getCenter(new Vector3());
    const radius = box.getSize(new Vector3()).length() || 1;
    const camera = new PerspectiveCamera(45, width / height, radius / 100, radius * 100);
    camera.position.copy(center).add(new Vector3(radius, radius * 0.8, radius));
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.update();

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();
    return () => {
      cancelAnimationFrame(frame);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      scene.remove(object);
    };
  }, [object]);

  if (failed) {
    return (
      <p className="text-sm text-muted">
        3D drawing is not available in this browser, but the size was still measured.
      </p>
    );
  }
  return (
    <div
      ref={holderRef}
      className="h-[220px] w-full overflow-hidden rounded-md border border-line bg-raised"
      role="img"
      aria-label="3D preview of the chosen model. Drag to rotate."
    />
  );
}
