import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── WebGL check ──
    try {
      const testCanvas = document.createElement('canvas');
      const gl = testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!gl) return;
    } catch { return; }

    const W = mount.clientWidth;
    const H = mount.clientHeight;

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Scene & Camera ──
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 100);
    camera.position.set(0, 0.5, 8);

    const GOLD = 0xc9a84c;

    // ─── MAIN OBJECT: Football wireframe (icosahedron layers) ───
    const icoGeo = new THREE.IcosahedronGeometry(2.1, 1);
    const icoEdges = new THREE.EdgesGeometry(icoGeo);
    const icoMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.88 });
    const football = new THREE.LineSegments(icoEdges, icoMat);

    // Inner lat/lon sphere for depth
    const sphereGeo = new THREE.SphereGeometry(1.95, 16, 11);
    const sphereEdges = new THREE.EdgesGeometry(sphereGeo, 18);
    const sphereMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.18 });
    const innerSphere = new THREE.LineSegments(sphereEdges, sphereMat);

    // Very subtle inner glow fill
    const fillGeo = new THREE.SphereGeometry(2.0, 32, 32);
    const fillMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.025, side: THREE.FrontSide });
    const fill = new THREE.Mesh(fillGeo, fillMat);

    const ballGroup = new THREE.Group();
    ballGroup.add(football, innerSphere, fill);
    ballGroup.position.set(2.2, 0.5, 0); // off-center right, like a hero element
    scene.add(ballGroup);

    // ─── ORBITING RINGS ───
    const makeRing = (r: number, tube: number, opacity: number, rx: number, ry: number, rz: number) => {
      const g = new THREE.TorusGeometry(r, tube, 4, 100);
      const e = new THREE.EdgesGeometry(g);
      const m = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity });
      const ring = new THREE.LineSegments(e, m);
      ring.rotation.set(rx, ry, rz);
      return ring;
    };

    const ring1 = makeRing(2.85, 0.012, 0.5, Math.PI / 2, 0, 0);
    const ring2 = makeRing(3.3, 0.009, 0.28, 0.5, 0.8, 0);
    const ring3 = makeRing(3.8, 0.006, 0.14, 1.2, 0.3, 0.5);
    ballGroup.add(ring1, ring2, ring3);

    // ─── FLOATING GEOMETRIC SHAPES ───
    type ShapeUserData = { rx: number; ry: number; rz: number; phase: number; baseY: number };

    const shapeDefs: [THREE.BufferGeometry, number, number, number, number, number][] = [
      [new THREE.OctahedronGeometry(0.38, 0), -5.2,  2.8, -1.0, 0.32, 0.30],
      [new THREE.IcosahedronGeometry(0.30, 0), 4.8, -2.2, -2.0, 0.42, 0.22],
      [new THREE.TetrahedronGeometry(0.35, 0), -4.5, -2.8, -1.5, 0.28, 0.35],
      [new THREE.OctahedronGeometry(0.25, 0), 4.2,  3.5, -3.0, 0.38, 0.20],
      [new THREE.IcosahedronGeometry(0.20, 0), -3.2, 3.8, -2.0, 0.45, 0.18],
      [new THREE.TetrahedronGeometry(0.28, 0), 5.5,  1.5, -1.5, 0.25, 0.40],
      [new THREE.OctahedronGeometry(0.32, 0), -5.5,  0.3, -3.0, 0.35, 0.28],
      [new THREE.IcosahedronGeometry(0.18, 0), 3.2, -3.5, -2.0, 0.40, 0.15],
      [new THREE.TetrahedronGeometry(0.22, 0), -2.8, -3.8, -2.5, 0.30, 0.35],
      [new THREE.OctahedronGeometry(0.28, 0), 6.0, -0.8, -1.0, 0.22, 0.45],
    ];

    const floatShapes: THREE.LineSegments[] = [];
    shapeDefs.forEach(([geo, x, y, z, opacity, phase]) => {
      const edges = new THREE.EdgesGeometry(geo);
      const mat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity });
      const shape = new THREE.LineSegments(edges, mat);
      shape.position.set(x, y, z);
      shape.rotation.set(Math.random() * Math.PI * 2, Math.random() * Math.PI * 2, Math.random() * Math.PI * 2);
      const ud: ShapeUserData = {
        rx: (Math.random() - 0.5) * 0.014,
        ry: (Math.random() - 0.5) * 0.014,
        rz: (Math.random() - 0.5) * 0.010,
        phase,
        baseY: y,
      };
      shape.userData = ud;
      floatShapes.push(shape);
      scene.add(shape);
    });

    // ─── PARTICLES ───
    const PCOUNT = 320;
    const pPos = new Float32Array(PCOUNT * 3);
    for (let i = 0; i < PCOUNT; i++) {
      let px: number, py: number, pz: number;
      do {
        px = (Math.random() - 0.5) * 22;
        py = (Math.random() - 0.5) * 14;
        pz = (Math.random() - 0.5) * 10 - 3;
      } while (Math.sqrt((px - 2.2) ** 2 + py ** 2 + pz ** 2) < 3.5); // avoid ball area
      pPos[i * 3] = px;
      pPos[i * 3 + 1] = py;
      pPos[i * 3 + 2] = pz;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.Float32BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: GOLD, size: 0.038, transparent: true, opacity: 0.55, sizeAttenuation: true });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ─── CONNECTING LINES (like terminal-industries particle web) ───
    // Only connect nearby particles (max 30 lines to stay performant)
    const linePositions: number[] = [];
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < PCOUNT; i++) {
      pts.push(new THREE.Vector3(pPos[i * 3], pPos[i * 3 + 1], pPos[i * 3 + 2]));
    }
    let lineCount = 0;
    for (let i = 0; i < PCOUNT && lineCount < 40; i++) {
      for (let j = i + 1; j < PCOUNT && lineCount < 40; j++) {
        if (pts[i].distanceTo(pts[j]) < 2.2) {
          linePositions.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z);
          lineCount++;
        }
      }
    }
    const lGeo = new THREE.BufferGeometry();
    lGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.08 });
    const lines = new THREE.LineSegments(lGeo, lMat);
    scene.add(lines);

    // ─── GRID PLANE (perspective grid floor) ───
    const gridHelper = new THREE.GridHelper(30, 30, GOLD, GOLD);
    (gridHelper.material as THREE.LineBasicMaterial).opacity = 0.07;
    (gridHelper.material as THREE.LineBasicMaterial).transparent = true;
    gridHelper.position.set(0, -4.5, -2);
    scene.add(gridHelper);

    // ─── MOUSE & SCROLL ───
    let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
    let scrollProg = 0;

    const onMouse = (e: MouseEvent) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 2;
      targetY = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    const onScroll = () => { scrollProg = Math.min(window.scrollY / window.innerHeight, 1); };
    const onResize = () => {
      if (!mount) return;
      const nW = mount.clientWidth, nH = mount.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };

    window.addEventListener('mousemove', onMouse, { passive: true });
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });

    // ─── ANIMATION ───
    let t = 0;
    let animId: number;

    function animate() {
      animId = requestAnimationFrame(animate);
      t += 0.007;

      // Smooth mouse lerp
      mouseX += (targetX - mouseX) * 0.035;
      mouseY += (targetY - mouseY) * 0.035;

      // Ball group
      ballGroup.rotation.y += 0.0045 + scrollProg * 0.008;
      ballGroup.rotation.x = Math.sin(t * 0.25) * 0.07;

      // Rings
      ring1.rotation.z += 0.007;
      ring2.rotation.y += 0.005;
      ring3.rotation.z -= 0.004;

      // Float shapes
      for (const shape of floatShapes) {
        const ud = shape.userData as ShapeUserData;
        shape.rotation.x += ud.rx;
        shape.rotation.y += ud.ry;
        shape.rotation.z += ud.rz;
        shape.position.y = ud.baseY + Math.sin(t + ud.phase) * 0.18;
      }

      // Particles slow drift
      particles.rotation.y += 0.0007;
      particles.rotation.x += 0.0003;

      // Camera parallax from mouse
      camera.position.x += (mouseX * 0.7 - camera.position.x) * 0.05;
      camera.position.y += (mouseY * 0.45 + 0.5 - camera.position.y) * 0.05;
      camera.position.z = 8 + scrollProg * 1.2;
      camera.lookAt(0.8, 0, 0);

      // Grid subtle movement
      gridHelper.position.z = -2 + scrollProg * 2;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouse);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }} />;
}
