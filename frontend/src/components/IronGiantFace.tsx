import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/**
 * Full-screen 3D Iron Giant head — simple, visible, draggable.
 * Rendered as the chat screen background: drag anywhere on empty screen
 * space to rotate him, scroll to zoom. Neutral metal with a generated
 * panel-line texture so the face reads clearly.
 *
 * 3D model: "Iron Giant" by bolshooylenny, CC-BY-4.0 (Sketchfab).
 */
export function IronGiantFace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let model: THREE.Group | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let baseDist = 10;
    const yaw = { v: 0, t: 0 };
    const pitch = { v: 0, t: 0 };
    const dist = { v: 10, t: 10 };

    // ---------- renderer / scene ----------
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 300);
    camera = cam;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.55;
    pmrem.dispose();

    scene.add(new THREE.AmbientLight(0x8899aa, 0.9));
    const key = new THREE.DirectionalLight(0xfff2dd, 2.0);
    key.position.set(3, 4, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x66e6b0, 1.4);
    rim.position.set(-4, 2, -4);
    scene.add(rim);
    const fill = new THREE.PointLight(0x88bbdd, 20, 60);
    fill.position.set(-3, -2, 4);
    scene.add(fill);

    // generated panel-line texture so the surface reads as armored metal
    const texCanvas = document.createElement('canvas');
    texCanvas.width = texCanvas.height = 256;
    const tctx = texCanvas.getContext('2d')!;
    tctx.fillStyle = '#8b9292';
    tctx.fillRect(0, 0, 256, 256);
    // subtle noise
    for (let i = 0; i < 2600; i++) {
      const v = 120 + Math.random() * 60;
      tctx.fillStyle = `rgba(${v},${v + 6},${v + 4},0.25)`;
      tctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // panel seams
    tctx.strokeStyle = 'rgba(30,36,36,0.55)';
    tctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const p = i * 64;
      tctx.beginPath(); tctx.moveTo(p, 0); tctx.lineTo(p, 256); tctx.stroke();
      tctx.beginPath(); tctx.moveTo(0, p); tctx.lineTo(256, p); tctx.stroke();
    }
    // rivets
    tctx.fillStyle = 'rgba(40,46,46,0.8)';
    for (let x = 16; x < 256; x += 64) {
      for (let y = 16; y < 256; y += 64) {
        tctx.beginPath(); tctx.arc(x, y, 3, 0, Math.PI * 2); tctx.fill();
      }
    }
    const panelTex = new THREE.CanvasTexture(texCanvas);
    panelTex.wrapS = panelTex.wrapT = THREE.RepeatWrapping;
    panelTex.repeat.set(3, 3);

    const headMat = new THREE.MeshStandardMaterial({
      map: panelTex, color: 0xb9c0c0, metalness: 0.75, roughness: 0.5,
      envMapIntensity: 0.7,
    });

    // ---------- load model ----------
    new GLTFLoader().load(
      '/models/iron-giant/iron_giant.glb',
      (gltf) => {
        if (disposed) return;
        const inner = gltf.scene;
        // pick orientation with greatest Y extent = upright
        const candidates: [number, number][] = [[0, 0], [-Math.PI / 2, 0], [Math.PI / 2, 0], [0, Math.PI / 2], [0, -Math.PI / 2]];
        let best: [number, number] = [0, 0];
        let bestH = -1;
        for (const [rx, rz] of candidates) {
          inner.rotation.set(rx, 0, rz);
          inner.updateMatrixWorld(true);
          const size = new THREE.Box3().setFromObject(inner).getSize(new THREE.Vector3());
          if (size.y > bestH) { bestH = size.y; best = [rx, rz]; }
        }
        inner.rotation.set(best[0], 0, best[1]);
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        inner.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = headMat;
        });
        model = inner;
        scene.add(inner);

        // --- isolate just the head -------------------------------------
        // Render a small silhouette, find where the neck/shoulders begin,
        // then clip everything below that height and frame only the head.
        let headCenterY = center.y + size.y * 0.2;
        let headHalfH = size.y * 0.22;
        let headHalfW = size.x * 0.35;
        let cutWorldY = center.y - size.y * 0.15;
        try {
          const MW = 160;
          const MH = 160;
          const rt = new THREE.WebGLRenderTarget(MW, MH);
          const mCam = new THREE.PerspectiveCamera(cam.fov, 1, 0.1, 500);
          const fitDist = (size.y / 2) / Math.tan((cam.fov * Math.PI) / 360) * 1.12;
          mCam.position.set(center.x, center.y, center.z + fitDist);
          mCam.lookAt(center);
          mCam.updateMatrixWorld(true);

          const prevRT = renderer.getRenderTarget();
          const prevClear = renderer.getClearColor(new THREE.Color());
          const prevAlpha = renderer.getClearAlpha();
          renderer.setClearColor(0x000000, 0);
          renderer.setRenderTarget(rt);
          renderer.render(scene, mCam);
          const px = new Uint8Array(MW * MH * 4);
          renderer.readRenderTargetPixels(rt, 0, 0, MW, MH, px);
          renderer.setRenderTarget(prevRT);
          renderer.setClearColor(prevClear, prevAlpha);
          rt.dispose();

          // alpha row widths, top row first
          const rowW = new Float32Array(MH);
          let topRow = -1;
          for (let row = 0; row < MH; row++) {
            const src = (MH - 1 - row) * MW; // GL pixels are bottom-up
            let w = 0;
            for (let x = 0; x < MW; x++) {
              if (px[(src + x) * 4 + 3] > 24) w++;
            }
            rowW[row] = w;
            if (w > 0 && topRow < 0) topRow = row;
          }
          if (topRow < 0) throw new Error('empty silhouette');

          // head width = widest row in the top 12% of the silhouette
          const crownRows = Math.max(2, Math.floor(MH * 0.12));
          let crownW = 0;
          for (let r = topRow; r < Math.min(MH, topRow + crownRows); r++) {
            crownW = Math.max(crownW, rowW[r]);
          }
          // cut where the silhouette flares past ~1.7x crown width (neck/shoulders)
          let cutRow = -1;
          for (let r = topRow + 4; r < MH - 4; r++) {
            if (
              rowW[r] > crownW * 1.7 &&
              rowW[r + 1] > crownW * 1.5 &&
              rowW[r + 2] > crownW * 1.4 &&
              rowW[r + 3] > crownW * 1.3
            ) {
              cutRow = r;
              break;
            }
          }
          if (cutRow < 0) cutRow = Math.floor(MH * 0.55);

          // row -> world Y at model depth (measurement cam fits whole model)
          const halfH = fitDist * Math.tan((cam.fov * Math.PI) / 360);
          const yAt = (row: number) => center.y + (1 - (2 * row) / MH) * halfH;
          const headTopY = yAt(topRow);
          const cutY = yAt(cutRow);
          headCenterY = (headTopY + cutY) / 2;
          headHalfH = Math.max(0.05, (headTopY - cutY) / 2);
          let headPixW = 0;
          for (let r = topRow; r < cutRow; r++) headPixW = Math.max(headPixW, rowW[r]);
          headHalfW = (headPixW / MW) * halfH; // mCam aspect = 1
          cutWorldY = cutY;
        } catch {
          /* fall back to upper-body framing */
        }

        // recentre so the head sits at the origin, clip below the neck
        inner.position.sub(center);
        inner.position.y += center.y - headCenterY;
        headMat.clippingPlanes = [
          new THREE.Plane(new THREE.Vector3(0, 1, 0), headCenterY - cutWorldY),
        ];

        // frame just the head to fill the view
        const tanV = Math.tan((cam.fov * Math.PI) / 360);
        const aspect = Math.max(0.5, window.innerWidth / Math.max(1, window.innerHeight));
        const tanH = tanV * aspect;
        baseDist = Math.max(headHalfH / tanV, headHalfW / tanH) * 1.12;
        dist.v = dist.t = baseDist;
      },
      undefined,
      () => { /* scene stays empty but alive */ },
    );

    // ---------- drag-to-rotate / scroll-to-zoom (window-level, ignores UI) ----------
    let dragging = false;
    let lastX = 0, lastY = 0;
    const interactive = (t: EventTarget | null) =>
      t instanceof Element && !!t.closest('input,textarea,button,a,select,[contenteditable],[role="button"],.msg-bubble');

    const onDown = (e: PointerEvent) => {
      if (interactive(e.target) || e.button !== 0) return;
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw.t += (e.clientX - lastX) * 0.008;
      pitch.t += (e.clientY - lastY) * 0.008;
      pitch.t = Math.max(-1.1, Math.min(1.1, pitch.t));
      lastX = e.clientX; lastY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    const onWheel = (e: WheelEvent) => {
      if (interactive(e.target)) return;
      dist.t = Math.max(baseDist * 0.45, Math.min(baseDist * 2.2, dist.t + e.deltaY * 0.01));
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('wheel', onWheel, { passive: true });

    // ---------- resize + loop ----------
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.setSize(w, h, false);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    };
    resize();
    window.addEventListener('resize', resize);

    let raf = 0;
    const draw = () => {
      if (disposed) return;
      // gentle idle sway + damped drag follow
      yaw.v += (yaw.t + Math.sin(performance.now() * 0.0003) * 0.15 - yaw.v) * 0.08;
      pitch.v += (pitch.t - pitch.v) * 0.08;
      dist.v += (dist.t - dist.v) * 0.1;
      if (model) {
        model.rotation.y = yaw.v;
        model.rotation.x = pitch.v;
      }
      if (camera) {
        camera.position.set(0, 0, dist.v);
        camera.lookAt(0, 0, 0);
      }
      renderer.render(scene, cam);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', resize);
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
    />
  );
}
