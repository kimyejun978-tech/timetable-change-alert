const canvases = Array.from(document.querySelectorAll('.school-3d-canvas'));
if (canvases.length) bootSchoolScenes();

async function bootSchoolScenes() {
  let THREE;
  try {
    THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/+esm');
  } catch (error) {
    document.documentElement.classList.add('school-3d-failed');
    return;
  }

  canvases.forEach((canvas) => createSchoolScene(THREE, canvas));
}

function makeTextTexture(THREE, width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  draw(ctx, width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function createSchoolScene(THREE, canvas) {
  const type = canvas.dataset.scene || 'home';
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0.2, 8.5);

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.HemisphereLight(0xf4f8ff, 0x6d7b8e, 2.2));
  const key = new THREE.DirectionalLight(0xffffff, 3.4);
  key.position.set(4, 6, 8);
  scene.add(key);
  const rim = new THREE.PointLight(0x79a8ef, 7, 18);
  rim.position.set(-4, 2, 5);
  scene.add(rim);

  if (type === 'home' || type === 'onboarding') buildHomeBoard(THREE, root, type === 'onboarding');
  if (type === 'schedule') buildScheduleDesk(THREE, root);
  if (type === 'changes') buildChangesBoard(THREE, root);
  if (type === 'settings') buildSettingsId(THREE, root);

  const host = canvas.parentElement;
  const pointer = { x: 0, y: 0 };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (host) {
    host.addEventListener('pointermove', (event) => {
      const rect = host.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointer.x = ((event.clientX - rect.left) / rect.width - .5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - .5) * 2;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { pointer.x = 0; pointer.y = 0; }, { passive: true });
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.position.z = w < 500 ? 9.6 : 8.5;
  }

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  let frame = 0;
  let last = performance.now();
  function animate(now) {
    const dt = Math.min((now - last) / 1000, .05);
    last = now;
    if (!reduced) {
      root.rotation.y += ((pointer.x * .08) - root.rotation.y) * .04;
      root.rotation.x += ((pointer.y * -.045) - root.rotation.x) * .04;
      root.position.y = Math.sin(now * .00055) * .025;
      root.children.forEach((child, index) => {
        if (child.userData.floatBase !== undefined) {
          child.position.y = child.userData.floatBase + Math.sin(now * .0008 + index * .65) * .025;
        }
      });
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(animate);
  }
  frame = requestAnimationFrame(animate);

  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame);
    ro.disconnect();
    renderer.dispose();
  }, { once: true });
}

function buildHomeBoard(THREE, group, onboarding) {
  const schoolName = localStorage.getItem('schoolName') || '오늘 학교';
  const grade = localStorage.getItem('schoolGrade');
  const klass = localStorage.getItem('schoolClass');
  const classText = grade && klass ? `${grade}학년 ${klass}반` : '학교를 설정해 주세요';

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x18314e, metalness: .55, roughness: .28 });
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xb8c5d4, metalness: .12, roughness: .5 });
  const deskMat = new THREE.MeshStandardMaterial({ color: 0x8a694b, roughness: .72 });
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x5a8d68, roughness: .72 });

  const board = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.55, .18), frameMat);
  board.position.set(.85, .32, 0);
  board.rotation.y = -.08;
  board.userData.floatBase = board.position.y;
  group.add(board);

  const texture = makeTextTexture(THREE, 1024, 580, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#17344f');
    g.addColorStop(1, '#0e2c3d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.15)';
    ctx.lineWidth = 2;
    ctx.strokeRect(34, 34, w - 68, h - 68);
    ctx.fillStyle = '#dbe7ef';
    ctx.font = '700 44px sans-serif';
    ctx.fillText(schoolName.slice(0, 15), 72, 105);
    ctx.fillStyle = 'rgba(219,231,239,.67)';
    ctx.font = '500 25px sans-serif';
    ctx.fillText(classText, 72, 148);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 48px sans-serif';
    ctx.fillText(onboarding ? '학교부터 설정해 볼까요?' : '오늘도 좋은 하루 보내세요.', 72, 270);
    ctx.fillStyle = '#b9cbd5';
    ctx.font = '500 27px sans-serif';
    ctx.fillText('시간표 · 급식 · 변경사항을 한곳에서', 72, 322);
    ctx.fillStyle = '#91b9c8';
    ctx.font = '600 24px sans-serif';
    ctx.fillText('작은 확인이 더 편한 학교생활을 만듭니다.', 72, 438);
  });

  const screenMat = new THREE.MeshBasicMaterial({ map: texture });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.12, 2.25), screenMat);
  screen.position.set(.85, .32, .105);
  screen.rotation.y = -.08;
  screen.userData.floatBase = screen.position.y;
  group.add(screen);

  for (let i = 0; i < 4; i++) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(.17, 3.7, .22), sideMat);
    column.position.set(-3.25 + i * .62, .2, -1.0 - i * .05);
    column.rotation.y = .1;
    group.add(column);
  }

  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.5, .18, 1.05), deskMat);
  bench.position.set(-2.1, -1.65, -.55);
  bench.rotation.y = .17;
  group.add(bench);

  const pot = new THREE.Mesh(new THREE.CylinderGeometry(.25, .31, .45, 24), new THREE.MeshStandardMaterial({ color: 0xc7c1b4, roughness: .7 }));
  pot.position.set(3.35, -1.25, .2);
  group.add(pot);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.22, 16, 10), plantMat);
    leaf.scale.set(.55, 1.8, .35);
    leaf.rotation.z = (i - 2.5) * .42;
    leaf.position.set(3.35 + Math.sin(i) * .22, -.78 + Math.cos(i * .7) * .16, .2);
    group.add(leaf);
  }

  group.rotation.set(-.03, -.06, 0);
  group.position.set(.15, .05, 0);
}

function buildScheduleDesk(THREE, group) {
  const bookColors = [0x173a66, 0x315988, 0xd8d0bd];
  const bookY = [-1.15, -.72, -.29];
  bookY.forEach((y, i) => {
    const book = new THREE.Mesh(new THREE.BoxGeometry(2.8, .34, 1.55), new THREE.MeshStandardMaterial({ color: bookColors[i], roughness: .48 }));
    book.position.set(-1.15 + i * .12, y, -.2 - i * .04);
    book.rotation.y = -.16 + i * .035;
    group.add(book);
  });

  const planner = new THREE.Mesh(new THREE.BoxGeometry(2.65, 2.15, .12), new THREE.MeshStandardMaterial({ color: 0xf4f1e8, roughness: .78 }));
  planner.position.set(1.15, .65, .2);
  planner.rotation.set(-.18, -.1, .06);
  planner.userData.floatBase = planner.position.y;
  group.add(planner);

  const texture = makeTextTexture(THREE, 720, 560, (ctx, w, h) => {
    ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = '#d5d3ca'; ctx.lineWidth = 2;
    for (let x = 52; x < w; x += 82) { ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, h - 42); ctx.stroke(); }
    for (let y = 120; y < h; y += 62) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(w - 40, y); ctx.stroke(); }
    ctx.fillStyle = '#315b91'; ctx.font = '700 38px sans-serif'; ctx.fillText('WEEKLY TIMETABLE', 54, 72);
    ['MON','TUE','WED','THU','FRI'].forEach((d,i) => { ctx.font='600 20px sans-serif'; ctx.fillText(d, 75 + i*112, 108); });
    ctx.fillStyle = '#173a66'; ctx.font = '600 22px sans-serif'; ctx.fillText('오늘의 수업을 차분하게 정리해요.', 54, 520);
  });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(2.45, 1.94), new THREE.MeshBasicMaterial({ map: texture }));
  paper.position.set(1.15, .65, .267);
  paper.rotation.copy(planner.rotation);
  paper.userData.floatBase = paper.position.y;
  group.add(paper);

  const clip = new THREE.Mesh(new THREE.BoxGeometry(.75, .22, .18), new THREE.MeshStandardMaterial({ color: 0x5177b3, metalness: .45, roughness: .3 }));
  clip.position.set(1.05, 1.78, .36);
  clip.rotation.copy(planner.rotation);
  group.add(clip);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.3, .34, 1.0, 30), new THREE.MeshStandardMaterial({ color: 0xf2efe7, roughness: .68 }));
  cup.position.set(3.25, -.35, -.15);
  group.add(cup);
  const penMat = new THREE.MeshStandardMaterial({ color: 0x2d5a8c, metalness: .2, roughness: .36 });
  for (let i = 0; i < 4; i++) {
    const pen = new THREE.Mesh(new THREE.CylinderGeometry(.045, .045, 1.38, 12), penMat);
    pen.position.set(3.08 + i*.13, .55 + Math.sin(i)*.08, -.12);
    pen.rotation.z = (i - 1.5) * .08;
    group.add(pen);
  }

  group.rotation.set(-.16, -.22, .02);
  group.position.set(.3, .15, 0);
}

function buildChangesBoard(THREE, group) {
  const cork = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.8, .18), new THREE.MeshStandardMaterial({ color: 0x9b7655, roughness: .92 }));
  cork.position.set(.45, .25, -.2);
  cork.rotation.y = -.06;
  cork.userData.floatBase = cork.position.y;
  group.add(cork);

  const frameMat = new THREE.MeshStandardMaterial({ color: 0x46586c, metalness: .55, roughness: .32 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.75, .12, .28), frameMat); top.position.set(.45, 1.68, -.12); group.add(top);
  const bottom = top.clone(); bottom.position.y = -1.18; group.add(bottom);
  const side1 = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.95, .28), frameMat); side1.position.set(-1.96, .25, -.12); group.add(side1);
  const side2 = side1.clone(); side2.position.x = 2.86; group.add(side2);

  const notes = [
    { x: -1.0, y: .62, color: '#f6f5ef', title: '수업 변경', line: '3교시 변경 안내' },
    { x: .72, y: .72, color: '#f5e6a8', title: '교실 이동', line: '다음 수업 장소 확인' },
    { x: .15, y: -.62, color: '#e8eef7', title: '학교 안내', line: '중요 공지는 한눈에' },
  ];
  notes.forEach((n, index) => {
    const tex = makeTextTexture(THREE, 420, 310, (ctx,w,h) => {
      ctx.fillStyle = n.color; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = '#26394f'; ctx.font = '700 34px sans-serif'; ctx.fillText(n.title, 36, 75);
      ctx.fillStyle = '#67798c'; ctx.font = '500 24px sans-serif'; ctx.fillText(n.line, 36, 128);
      ctx.fillStyle = '#8da0b5'; ctx.font = '500 18px sans-serif'; ctx.fillText('오늘 · 알림판', 36, 252);
    });
    const note = new THREE.Mesh(new THREE.PlaneGeometry(1.55, 1.15), new THREE.MeshBasicMaterial({ map: tex }));
    note.position.set(n.x + .45, n.y + .25, .02);
    note.rotation.z = (index - 1) * .035;
    note.userData.floatBase = note.position.y;
    group.add(note);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.07, 14, 14), new THREE.MeshStandardMaterial({ color: index === 1 ? 0xc85656 : 0x3d72c1, metalness: .4, roughness: .28 }));
    pin.position.set(note.position.x, note.position.y + .53, .08);
    group.add(pin);
  });
  group.rotation.set(-.03, -.08, 0);
  group.position.set(.15, .02, 0);
}

function buildSettingsId(THREE, group) {
  const schoolName = localStorage.getItem('schoolName') || '오늘 학교';
  const grade = localStorage.getItem('schoolGrade') || '-';
  const klass = localStorage.getItem('schoolClass') || '-';

  const bookMat = new THREE.MeshStandardMaterial({ color: 0x173b68, roughness: .48 });
  for (let i = 0; i < 3; i++) {
    const book = new THREE.Mesh(new THREE.BoxGeometry(2.65, .38, 1.5), bookMat.clone());
    book.material.color.offsetHSL(0, 0, i * .055);
    book.position.set(1.7, -1.15 + i * .43, -.48 - i * .03);
    book.rotation.y = -.13 + i * .035;
    group.add(book);
  }

  const cardTex = makeTextTexture(THREE, 760, 480, (ctx,w,h) => {
    ctx.fillStyle = '#f7fafc'; ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#173b68'; ctx.fillRect(0,0,w,82);
    ctx.fillStyle = '#fff'; ctx.font = '700 30px sans-serif'; ctx.fillText(schoolName.slice(0,16), 42, 54);
    ctx.fillStyle = '#dfe9f4'; ctx.font = '500 17px sans-serif'; ctx.fillText('SCHOOL ID', w - 165, 52);
    ctx.fillStyle = '#d9e4ef'; roundedRect(ctx, 45, 125, 155, 185, 16); ctx.fill();
    ctx.fillStyle = '#6f8aad'; ctx.beginPath(); ctx.arc(122,185,45,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#7894b7'; roundedRect(ctx, 78, 230, 88, 58, 26); ctx.fill();
    ctx.fillStyle = '#213b5c'; ctx.font = '700 34px sans-serif'; ctx.fillText('학생', 250, 160);
    ctx.font = '600 26px sans-serif'; ctx.fillText(`${grade}학년 ${klass}반`, 250, 210);
    ctx.fillStyle = '#71839a'; ctx.font = '500 20px sans-serif'; ctx.fillText('오늘과 내일을 연결하는 학교생활', 250, 264);
    ctx.fillStyle = '#d3dae3';
    for (let x = 250; x < 680; x += 13) ctx.fillRect(x, 345, 5 + (x % 17), 68);
  });

  const cardBase = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.15, .12), new THREE.MeshStandardMaterial({ color: 0xe9eef4, roughness: .42 }));
  cardBase.position.set(-.65, .18, .15);
  cardBase.rotation.set(-.12, -.18, .08);
  cardBase.userData.floatBase = cardBase.position.y;
  group.add(cardBase);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(3.22, 2.02), new THREE.MeshBasicMaterial({ map: cardTex }));
  card.position.set(-.65, .18, .217);
  card.rotation.copy(cardBase.rotation);
  card.userData.floatBase = card.position.y;
  group.add(card);

  const clip = new THREE.Mesh(new THREE.BoxGeometry(.72, .24, .18), new THREE.MeshStandardMaterial({ color: 0x315b91, metalness: .45, roughness: .28 }));
  clip.position.set(-.72, 1.34, .3);
  clip.rotation.copy(cardBase.rotation);
  group.add(clip);

  const strapMat = new THREE.MeshStandardMaterial({ color: 0x24466f, roughness: .48 });
  const strap1 = new THREE.Mesh(new THREE.TorusGeometry(1.95, .055, 12, 80, Math.PI * 1.25), strapMat);
  strap1.rotation.set(1.25, 0, -.5);
  strap1.position.set(-.95, .82, -.4);
  group.add(strap1);

  group.rotation.set(-.06, -.12, 0);
  group.position.set(.35, .02, 0);
}
