const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

function getActivePeriodIndex() {
  const rows = Array.from(document.querySelectorAll("#schedule_malloc tr"));
  const current = rows.findIndex((row) => row.classList.contains("current-row"));
  if (current >= 0) return current;

  const next = rows.findIndex((row) => row.classList.contains("next-row"));
  if (next >= 0) return next;

  return 0;
}

async function initScene(canvas) {
  if (!canvas || canvas.dataset.sceneReady === "true") return;
  canvas.dataset.sceneReady = "true";

  let THREE;
  try {
    THREE = await import(THREE_URL);
  } catch (error) {
    canvas.closest(".hero-scene, .first-run-visual")?.classList.add("scene-load-failed");
    return;
  }

  const container = canvas.parentElement;
  if (!container) return;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  camera.position.set(0, 0.15, 10.2);

  const root = new THREE.Group();
  scene.add(root);

  const ambient = new THREE.AmbientLight(0xaac7ff, 1.3);
  scene.add(ambient);

  const keyLight = new THREE.PointLight(0x7ca7ff, 27, 28, 2);
  keyLight.position.set(4.7, 5.2, 6.2);
  scene.add(keyLight);

  const cyanLight = new THREE.PointLight(0x64d9d0, 14, 22, 2);
  cyanLight.position.set(-4.5, -2.6, 5);
  scene.add(cyanLight);

  const warmLight = new THREE.PointLight(0xffffff, 8, 16, 2);
  warmLight.position.set(0, -4, 6);
  scene.add(warmLight);

  const activePeriod = getActivePeriodIndex();
  const onboarding = canvas.dataset.scene === "onboarding";

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x31507d,
    metalness: 0.12,
    roughness: 0.27,
    transmission: 0.18,
    transparent: true,
    opacity: 0.64,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
  });

  const quietMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x233a5f,
    metalness: 0.08,
    roughness: 0.32,
    transmission: 0.08,
    transparent: true,
    opacity: 0.54,
    clearcoat: 0.9,
  });

  const activeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x78a9ff,
    emissive: 0x1c4f9d,
    emissiveIntensity: 0.75,
    metalness: 0.08,
    roughness: 0.2,
    transmission: 0.16,
    transparent: true,
    opacity: 0.92,
    clearcoat: 1,
  });

  const edgeMaterial = new THREE.LineBasicMaterial({
    color: 0x9fc3ff,
    transparent: true,
    opacity: 0.18,
  });

  const slabGeometry = new THREE.BoxGeometry(4.8, 0.48, 0.18);
  const slabEdges = new THREE.EdgesGeometry(slabGeometry);
  const slabs = [];

  for (let i = 0; i < 7; i++) {
    const material = i === activePeriod ? activeMaterial : i % 2 === 0 ? glassMaterial : quietMaterial;
    const slab = new THREE.Mesh(slabGeometry, material);
    const edge = new THREE.LineSegments(slabEdges, edgeMaterial);
    slab.add(edge);

    const t = i - 3;
    slab.position.set(
      Math.sin(i * 0.72) * 0.55 + (onboarding ? 0.15 : 0.45),
      -t * 0.72,
      -Math.abs(t) * 0.32 + Math.cos(i * 0.63) * 0.16
    );
    slab.rotation.z = -0.06 + Math.sin(i * 0.54) * 0.035;
    slab.rotation.y = -0.22 + i * 0.038;
    slab.userData.baseY = slab.position.y;
    slab.userData.floatOffset = i * 0.68;
    slab.userData.isActive = i === activePeriod;
    root.add(slab);
    slabs.push(slab);
  }

  const coreGeometry = new THREE.TorusGeometry(1.55, 0.055, 18, 120);
  const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x7fa9f7,
    transparent: true,
    opacity: 0.22,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  core.rotation.x = 1.35;
  core.rotation.y = -0.25;
  core.position.set(1.35, 0.05, -0.95);
  root.add(core);

  const innerRingGeometry = new THREE.TorusGeometry(0.78, 0.026, 14, 96);
  const innerRingMaterial = new THREE.MeshBasicMaterial({
    color: 0x79d6d3,
    transparent: true,
    opacity: 0.18,
  });
  const innerRing = new THREE.Mesh(innerRingGeometry, innerRingMaterial);
  innerRing.rotation.set(1.1, 0.4, 0.2);
  innerRing.position.set(1.35, 0.05, -0.72);
  root.add(innerRing);

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.22, 2),
    new THREE.MeshPhysicalMaterial({
      color: 0xb8d4ff,
      emissive: 0x3d74c9,
      emissiveIntensity: 0.9,
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.9,
    })
  );
  orb.position.set(1.35, 0.05, -0.55);
  root.add(orb);

  const dotGeometry = new THREE.SphereGeometry(0.035, 8, 8);
  const dotMaterial = new THREE.MeshBasicMaterial({
    color: 0xa6c7ff,
    transparent: true,
    opacity: 0.28,
  });

  const stars = new THREE.Group();
  const dotCount = onboarding ? 34 : 22;
  for (let i = 0; i < dotCount; i++) {
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    dot.position.set(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 6,
      -2.5 + Math.random() * 2.1
    );
    stars.add(dot);
  }
  root.add(stars);

  root.position.x = onboarding ? 0.55 : 0.65;
  root.rotation.x = onboarding ? -0.08 : -0.04;
  root.rotation.y = onboarding ? -0.35 : -0.28;

  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let frameId = null;
  let running = true;
  let visible = true;

  function resize() {
    const rect = container.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (width < 580) {
      camera.position.z = 11.6;
      root.scale.setScalar(0.88);
    } else {
      camera.position.z = 10.2;
      root.scale.setScalar(1);
    }
  }

  function onPointerMove(event) {
    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  }

  function onPointerLeave() {
    pointerX = 0;
    pointerY = 0;
  }

  function renderFrame(time) {
    if (!running) return;

    if (visible) {
      const seconds = time * 0.001;
      smoothX += (pointerX - smoothX) * 0.035;
      smoothY += (pointerY - smoothY) * 0.035;

      if (!reduceMotion.matches) {
        root.rotation.y = (onboarding ? -0.35 : -0.28) + smoothX * 0.12 + Math.sin(seconds * 0.18) * 0.025;
        root.rotation.x = (onboarding ? -0.08 : -0.04) - smoothY * 0.055;
        core.rotation.z = seconds * 0.09;
        innerRing.rotation.z = -seconds * 0.13;
        orb.rotation.x = seconds * 0.24;
        orb.rotation.y = seconds * 0.31;

        slabs.forEach(function (slab, index) {
          slab.position.y = slab.userData.baseY + Math.sin(seconds * 0.72 + slab.userData.floatOffset) * (slab.userData.isActive ? 0.055 : 0.026);
          if (slab.userData.isActive) {
            const pulse = 0.72 + Math.sin(seconds * 1.7) * 0.16;
            slab.material.emissiveIntensity = pulse;
          }
        });

        stars.rotation.z = seconds * 0.012;
      }

      renderer.render(scene, camera);
    }

    frameId = requestAnimationFrame(renderFrame);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver(
    (entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    },
    { threshold: 0.05 }
  );
  intersectionObserver.observe(container);

  container.addEventListener("pointermove", onPointerMove, { passive: true });
  container.addEventListener("pointerleave", onPointerLeave, { passive: true });

  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
  });

  resize();
  renderer.render(scene, camera);
  frameId = requestAnimationFrame(renderFrame);

  window.addEventListener(
    "pagehide",
    () => {
      running = false;
      if (frameId !== null) cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      renderer.dispose();
      slabGeometry.dispose();
      slabEdges.dispose();
      glassMaterial.dispose();
      quietMaterial.dispose();
      activeMaterial.dispose();
      edgeMaterial.dispose();
      coreGeometry.dispose();
      coreMaterial.dispose();
      innerRingGeometry.dispose();
      innerRingMaterial.dispose();
      dotGeometry.dispose();
      dotMaterial.dispose();
    },
    { once: true }
  );
}

async function boot3D() {
  const canvases = Array.from(document.querySelectorAll("canvas.home3d-canvas"));
  for (const canvas of canvases) {
    await initScene(canvas);
  }
}

requestAnimationFrame(() => {
  boot3D();
});
