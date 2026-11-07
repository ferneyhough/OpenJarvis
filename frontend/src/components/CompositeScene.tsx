import { useEffect, useRef, useState, type CSSProperties } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CompositeAsset {
  /** URL of the GLB/GLTF model to load. */
  url: string;
  /** World-space position of the model's pivot. */
  position: [number, number, number];
  /** Optional uniform scale applied to the loaded scene. */
  scale?: number;
  /** Optional Y rotation in radians. */
  rotationY?: number;
}

export interface CompositeSceneProps {
  manifest: CompositeAsset[];
  /** Called once every asset in the manifest has finished loading. */
  onLoaded?: () => void;
  className?: string;
  style?: CSSProperties;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material) continue;
      for (const value of Object.values(material)) {
        if (value instanceof THREE.Texture) value.dispose();
      }
      material.dispose();
    }
  });
}

export default function CompositeSceneBuilder({
  manifest,
  onLoaded,
  className,
  style,
}: CompositeSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  const [loadProgress, setLoadProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0f19);

    const camera = new THREE.PerspectiveCamera(
      50,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    camera.position.set(4, 3, 6);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;

    const compositeRootGroup = new THREE.Group();
    scene.add(compositeRootGroup);

    const manager = new THREE.LoadingManager();
    manager.onProgress = (_url, loaded, total) => {
      if (total > 0) setLoadProgress(Math.round((loaded / total) * 100));
    };
    manager.onLoad = () => {
      setIsLoaded(true);
      onLoadedRef.current?.();
    };
    manager.onError = (url) => setError(`Failed to load model: ${url}`);

    const gltfLoader = new GLTFLoader(manager);
    const pending: Promise<void>[] = [];

    manifest.forEach((asset) => {
      const modelPivot = new THREE.Group();
      modelPivot.position.set(...asset.position);
      if (asset.rotationY) modelPivot.rotation.y = asset.rotationY;
      if (asset.scale) modelPivot.scale.setScalar(asset.scale);
      compositeRootGroup.add(modelPivot);

      pending.push(
        new Promise<void>((resolve) => {
          gltfLoader.load(
            asset.url,
            (gltf) => {
              modelPivot.add(gltf.scene);
              resolve();
            },
            undefined,
            () => {
              setError(`Failed to parse model: ${asset.url}`);
              resolve();
            },
          );
        }),
      );
    });

    const resizeObserver = new ResizeObserver(() => {
      const { clientWidth: w, clientHeight: h } = container;
      if (w === 0 || h === 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    resizeObserver.observe(container);

    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      controls.dispose();
      disposeObject(compositeRootGroup);
      renderer.dispose();
      renderer.domElement.remove();
      scene.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest]);

  return (
    <div
      ref={mountRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '600px', ...style }}
    >
      {!isLoaded && !error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#9ca3af',
            fontSize: '14px',
            pointerEvents: 'none',
          }}
        >
          Loading 3D scene… {loadProgress}%
        </div>
      )}
      {error && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#f87171',
            fontSize: '14px',
            pointerEvents: 'none',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
