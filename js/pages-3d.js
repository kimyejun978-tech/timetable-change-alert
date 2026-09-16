const canvases = Array.from(document.querySelectorAll('.mini3d-canvas'));

if (canvases.length) {
  initScenes();
}

async function initScenes() {
  let THREE;

  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/+esm');
  } catch (error) {
    canvases.forEach((canvas) => {
      canvas.style.opacity = '0';
    });
    return;
  }

  canvases.forEach((canvas) => createScene(THREE, canvas));
}

function createScene(THREE, canvas) {
  const sceneType = canvas.dataset.scene || 'settings';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0.15, 7.2);

  const group = new THREE.Group();
  scene.add(group);

  const ambient = new THREE.AmbientLight(0x9dbcf7, 1.65);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 3.2);
  key.position.set(4, 5, 6);
  scene.add(key);

  const rim = new THREE.PointLight(0x4f8cff, 12, 20);
  rim.position.set(-4, -1, 4);
  scene.add(rim);

  if (sceneType === 'schedule') buildScheduleScene(THREE, group);
  if (sceneType === 'changes') buildChangesScene(THREE, group);
  if (sceneType === 'settings') buildSettingsScene(THREE, group);

  const pointer = { x: 0, y: 0 };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const host = canvas.closest('.workspace-scene');
  if (host) {
    host.addEventListener('pointermove', (event) => {
      const rect = host.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    });

    host.addEventListener('pointerleave', () => {
      pointer.x = 0;
      pointer.y = 0;
    });
  }

  let frame = 0;
  let last = performance.now();

  function render(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (!reducedMotion) {
      group.rotation.y += dt * 0.12;
      group.rotation.x += ((pointer.y * -0.08) - group.rotation.x) * 0.035;
      group.rotation.z += ((pointer.x * -0.045) - group.rotation.z) * 0.03;
      group.position.x += ((pointer.x * 0.14) - group.position.x) * 0.035;
      group.position.y += ((pointer.y * -0.08) - group.position.y) * 0.035;

      group.children.forEach((child, index) => {
        if (child.userData.floatBase !== undefined) {
          child.position.y = child.userData.floatBase + Math.sin(now * 0.0007 + index * 0.8) * 0.055;
        }
      });
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  }

  frame = requestAnimationFrame(render);

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    renderer.dispose();
  }, { once: true });
}

function buildScheduleScene(THREE, group) {
  const plateMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0ff,
    metalness: 0.2,
    roughness: 0.32,
    transmission: 0.08,
    transparent: true,
    opacity: 0.9,
  });

  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x6ea3ff, metalness: 0.28, roughness: 0.28 });

  for (let i = 0; i < 7; i++) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.28, 1.4), plateMaterial.clone());
    plate.position.set((i - 3) * 0.18, (i - 3) * 0.38, (i - 3) * -0.18);
    plate.rotation.z = -0.08;
    plate.rotation.y = 0.18;
    plate.userData.floatBase = plate.position.y;
    if (i === 3) plate.material.color.setHex(0xffffff);
    group.add(plate);

    if (i === 3) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.31, 1.42), accentMaterial);
      bar.position.set(plate.position.x - 1.68, plate.position.y, plate.position.z);
      bar.rotation.copy(plate.rotation);
      bar.userData.floatBase = bar.position.y;
      group.add(bar);
    }
  }

  group.rotation.set(-0.35, -0.45, 0.05);
  group.position.set(0.55, 0.08, 0);
}

function buildChangesScene(THREE, group) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x7898c8, metalness: 0.42, roughness: 0.3 });
  const light = new THREE.MeshStandardMaterial({ color: 0xdce9ff, metalness: 0.12, roughness: 0.36 });
  const accent = new THREE.MeshStandardMaterial({ color: 0x60d2c4, metalness: 0.18, roughness: 0.3 });

  const rails = [
    { x: -1.25, y: 0.85, z: -0.35, w: 2.3, m: light },
    { x: 0.5, y: 0.02, z: 0.12, w: 3.1, m: dark },
    { x: -0.2, y: -0.9, z: -0.22, w: 2.7, m: light },
  ];

  rails.forEach((item, index) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(item.w, 0.34, 0.86), item.m);
    mesh.position.set(item.x, item.y, item.z);
    mesh.rotation.z = index % 2 ? -0.09 : 0.08;
    mesh.userData.floatBase = mesh.position.y;
    group.add(mesh);
  });

  const node = new THREE.Mesh(new THREE.SphereGeometry(0.31, 40, 40), accent);
  node.position.set(1.55, 0.04, 0.62);
  node.userData.floatBase = node.position.y;
  group.add(node);

  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.42, 0.045, 18, 96),
    new THREE.MeshStandardMaterial({ color: 0x89adff, transparent: true, opacity: 0.48, metalness: 0.35, roughness: 0.3 })
  );
  ring.rotation.x = Math.PI / 2.3;
  ring.rotation.y = 0.25;
  group.add(ring);

  group.rotation.set(-0.22, -0.3, 0.02);
  group.position.set(0.5, 0, 0);
}

function buildSettingsScene(THREE, group) {
  const outerMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xa9c6ff,
    metalness: 0.34,
    roughness: 0.24,
    transparent: true,
    opacity: 0.82,
  });
  const coreMaterial = new THREE.MeshStandardMaterial({ color: 0xf7fbff, metalness: 0.18, roughness: 0.24 });
  const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x61d6c5, metalness: 0.16, roughness: 0.28 });

  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 28, 120), outerMaterial);
  ringA.rotation.set(1.05, 0.18, 0.2);
  group.add(ringA);

  const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.085, 24, 100), outerMaterial.clone());
  ringB.material.opacity = 0.58;
  ringB.rotation.set(0.2, 1.15, 0.5);
  group.add(ringB);

  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.72, 2), coreMaterial);
  core.userData.floatBase = 0;
  group.add(core);

  const satellite = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 32), accentMaterial);
  satellite.position.set(1.5, 0.55, 0.25);
  satellite.userData.floatBase = satellite.position.y;
  group.add(satellite);

  group.rotation.set(-0.15, -0.35, 0);
  group.position.set(0.35, 0.02, 0);
}
