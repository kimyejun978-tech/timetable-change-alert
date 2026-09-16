const sceneCanvases = Array.from(document.querySelectorAll('.school-3d-canvas'));
if (sceneCanvases.length) bootSchool3D();

async function bootSchool3D() {
  try {
    const [THREE, roundedModule] = await Promise.all([
      import('https://cdn.jsdelivr.net/npm/three@0.180.0/+esm'),
      import('https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/geometries/RoundedBoxGeometry.js/+esm'),
    ]);
    sceneCanvases.forEach((canvas) => createScene(THREE, roundedModule.RoundedBoxGeometry, canvas));
  } catch (error) {
    console.error('3D scene load failed', error);
    document.documentElement.classList.add('school-3d-failed');
  }
}

function makeCanvasTexture(THREE, width, height, painter) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const ctx = c.getContext('2d');
  painter(ctx, width, height);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
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

function material(THREE, color, roughness = .48, metalness = .05) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function roundedMesh(THREE, RoundedBoxGeometry, size, radius, mat) {
  const geo = new RoundedBoxGeometry(size[0], size[1], size[2], 6, radius);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addClassroomBackdrop(THREE, RoundedBoxGeometry, group) {
  const wallMat = material(THREE, 0xeaf1f6, .92, 0);
  const floorMat = material(THREE, 0xcaa982, .68, .02);
  const metalMat = material(THREE, 0x7f93a8, .34, .38);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xd7ecff, roughness: .08, metalness: 0, transmission: .5, transparent: true, opacity: .38, thickness: .08 });

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(18, 9), wallMat);
  wall.position.set(0, 1.1, -3.7);
  wall.receiveShadow = true;
  group.add(wall);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -2.05, 0);
  floor.receiveShadow = true;
  group.add(floor);

  const windowGroup = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const glass = roundedMesh(THREE, RoundedBoxGeometry, [1.65, 3.15, .08], .03, glassMat.clone());
    glass.position.set(-4.8 + i * 1.85, .35, -3.52);
    glass.castShadow = false;
    windowGroup.add(glass);
    const mullion = roundedMesh(THREE, RoundedBoxGeometry, [.075, 3.35, .12], .02, metalMat);
    mullion.position.set(-3.92 + i * 1.85, .35, -3.42);
    windowGroup.add(mullion);
  }
  group.add(windowGroup);

  const sunPanel = new THREE.Mesh(new THREE.PlaneGeometry(5.3, 3.4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .26 }));
  sunPanel.position.set(-3.0, .45, -3.34);
  group.add(sunPanel);

  for (let i = 0; i < 2; i++) {
    const deskTop = roundedMesh(THREE, RoundedBoxGeometry, [2.25, .16, 1.0], .06, material(THREE, 0xb88d62, .56, .02));
    deskTop.position.set(-3.3 + i * 2.7, -1.45, -1.7 - i * .35);
    deskTop.rotation.y = .05;
    group.add(deskTop);
  }
}

function createBook(THREE, RoundedBoxGeometry, title, color, x, y, z, rot = 0) {
  const g = new THREE.Group();
  const page = roundedMesh(THREE, RoundedBoxGeometry, [2.55, .36, 1.48], .06, material(THREE, 0xf3eee5, .78, 0));
  page.position.y = 0;
  g.add(page);
  const coverMat = material(THREE, color, .38, .06);
  const top = roundedMesh(THREE, RoundedBoxGeometry, [2.67, .065, 1.55], .035, coverMat);
  top.position.y = .215;
  const bottom = top.clone();
  bottom.position.y = -.215;
  g.add(top, bottom);
  const spine = roundedMesh(THREE, RoundedBoxGeometry, [.095, .44, 1.54], .025, coverMat);
  spine.position.x = -1.31;
  g.add(spine);

  const labelTexture = makeCanvasTexture(THREE, 640, 150, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = .92;
    ctx.font = '700 58px Pretendard, sans-serif';
    ctx.fillText(title, 28, 92);
    ctx.globalAlpha = .38;
    ctx.font = '600 22px Pretendard, sans-serif';
    ctx.fillText('TODAY SCHOOL', 410, 92);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(2.18, .44), new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }));
  label.position.set(.14, .002, .781);
  label.rotation.x = Math.PI / 2;
  g.add(label);

  g.position.set(x, y, z);
  g.rotation.y = rot;
  return g;
}

function createPlant(THREE, RoundedBoxGeometry, x, y, z, scale = 1) {
  const g = new THREE.Group();
  const pot = roundedMesh(THREE, RoundedBoxGeometry, [.72, .64, .72], .12, material(THREE, 0xe8e2d7, .82, 0));
  pot.position.y = .03;
  g.add(pot);
  const leafMat = material(THREE, 0x4c8b64, .72, 0);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(.32, 20, 12), leafMat);
    leaf.scale.set(.42, 1.25, .22);
    leaf.position.set(Math.sin(i * .9) * .28, .62 + Math.cos(i * .62) * .12, Math.cos(i * .7) * .12);
    leaf.rotation.z = (i - 3) * .29;
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  return g;
}

function buildHomeScene(THREE, RoundedBoxGeometry, root, onboarding) {
  addClassroomBackdrop(THREE, RoundedBoxGeometry, root);
  const schoolName = localStorage.getItem('schoolName') || '오늘 학교';
  const grade = localStorage.getItem('schoolGrade');
  const klass = localStorage.getItem('schoolClass');
  const classLabel = grade && klass ? `${grade}학년 ${klass}반` : '학교 설정 전';

  const boardFrame = roundedMesh(THREE, RoundedBoxGeometry, [4.9, 2.88, .23], .12, material(THREE, 0x1a2738, .28, .58));
  boardFrame.position.set(1.7, .2, -.1);
  boardFrame.rotation.y = -.12;
  root.add(boardFrame);

  const boardTex = makeCanvasTexture(THREE, 1400, 820, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#173d65');
    g.addColorStop(.55, '#123657');
    g.addColorStop(1, '#0e2c45');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.09)'; ctx.fillRect(0, 150, w, 2);
    ctx.fillStyle = '#e6f1fa'; ctx.font = '800 58px Pretendard, sans-serif'; ctx.fillText(schoolName.slice(0, 14), 70, 100);
    ctx.fillStyle = '#8cb5d8'; ctx.font = '700 26px Pretendard, sans-serif'; ctx.fillText(classLabel, 1080, 98);
    ctx.fillStyle = '#ffffff'; ctx.font = '800 60px Pretendard, sans-serif'; ctx.fillText(onboarding ? '내 학교를 먼저 설정해 주세요.' : '함께 만드는 더 좋은 학교', 78, 280);
    ctx.fillStyle = '#c6d9e8'; ctx.font = '500 34px Pretendard, sans-serif'; ctx.fillText('시간표 · 급식 · 변경사항 · 학교 일정', 78, 340);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; roundedRect(ctx, 72, 420, 1256, 220, 18); ctx.fill();
    ctx.fillStyle = '#d9e7f1'; ctx.font = '700 32px Pretendard, sans-serif'; ctx.fillText('오늘의 안내', 108, 480);
    ctx.font = '500 28px Pretendard, sans-serif'; ctx.fillText('작은 확인이 더 편한 학교생활을 만듭니다.', 108, 535);
    ctx.fillStyle = '#7fb7dd'; ctx.font = '700 24px Pretendard, sans-serif'; ctx.fillText('TODAY · SCHOOL DAY', 108, 600);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4.55, 2.55), new THREE.MeshBasicMaterial({ map: boardTex }));
  screen.position.set(1.7, .2, .025);
  screen.rotation.y = -.12;
  root.add(screen);

  const shelf = roundedMesh(THREE, RoundedBoxGeometry, [3.1, .17, 1.25], .06, material(THREE, 0xa37854, .62, .03));
  shelf.position.set(-1.65, -1.64, -.2);
  shelf.rotation.y = .11;
  root.add(shelf);
  root.add(createBook(THREE, RoundedBoxGeometry, '수학 I', 0x315888, -1.5, -1.24, -.1, .09));
  root.add(createBook(THREE, RoundedBoxGeometry, '영어 I', 0x173a61, -1.4, -.82, -.12, .07));
  root.add(createBook(THREE, RoundedBoxGeometry, '통합과학', 0x446554, -1.28, -.4, -.14, .04));
  root.add(createPlant(THREE, RoundedBoxGeometry, 4.15, -1.42, -.2, .78));
}

function buildScheduleScene(THREE, RoundedBoxGeometry, root) {
  addClassroomBackdrop(THREE, RoundedBoxGeometry, root);
  root.add(createBook(THREE, RoundedBoxGeometry, '수학 I', 0x375f91, -2.25, -1.28, .1, .12));
  root.add(createBook(THREE, RoundedBoxGeometry, '영어 I', 0x173a60, -2.12, -.85, .08, .08));
  root.add(createBook(THREE, RoundedBoxGeometry, '통합과학', 0x5f6655, -1.98, -.42, .04, .05));
  root.add(createBook(THREE, RoundedBoxGeometry, '한국사', 0x345e51, -1.85, .01, 0, .02));

  const stand = new THREE.Group();
  const back = roundedMesh(THREE, RoundedBoxGeometry, [3.55, 2.85, .15], .08, material(THREE, 0x344864, .45, .16));
  back.rotation.x = -.13;
  stand.add(back);
  const paper = roundedMesh(THREE, RoundedBoxGeometry, [3.35, 2.56, .055], .055, material(THREE, 0xf9f6ed, .88, 0));
  paper.position.z = .112;
  paper.rotation.x = -.13;
  stand.add(paper);

  const timetableTex = makeCanvasTexture(THREE, 1180, 900, (ctx, w, h) => {
    ctx.fillStyle = '#faf7ee'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#174f89'; ctx.font = '800 58px Pretendard, sans-serif'; ctx.fillText('오늘의 시간표', 70, 96);
    const cols = ['MON','TUE','WED','THU','FRI'];
    ctx.font = '700 24px Pretendard, sans-serif'; ctx.fillStyle = '#55708e';
    cols.forEach((d, i) => ctx.fillText(d, 250 + i * 170, 160));
    ctx.strokeStyle = '#d9d9d2'; ctx.lineWidth = 2;
    for (let x = 210; x <= 1080; x += 170) { ctx.beginPath(); ctx.moveTo(x, 175); ctx.lineTo(x, 760); ctx.stroke(); }
    for (let y = 175; y <= 760; y += 82) { ctx.beginPath(); ctx.moveTo(80, y); ctx.lineTo(1080, y); ctx.stroke(); }
    ctx.fillStyle = '#61738a'; ctx.font = '700 22px Pretendard, sans-serif';
    for (let i = 0; i < 7; i++) ctx.fillText(`${i+1}교시`, 98, 225 + i * 82);
    const items = [['수학 I',2,0],['영어 I',2,1],['통합과학',2,2],['한국사',2,3],['체육',2,4]];
    items.forEach((item, idx) => {
      const x = 225 + item[1] * 170, y = 190 + item[2] * 82;
      const colors = ['#dcecff','#e5f3e7','#f8eadc','#e9e2f5','#f9e2e8'];
      ctx.fillStyle = colors[idx]; roundedRect(ctx, x, y, 142, 58, 11); ctx.fill();
      ctx.fillStyle = '#284b70'; ctx.font = '700 22px Pretendard, sans-serif'; ctx.fillText(item[0], x + 18, y + 37);
    });
    ctx.fillStyle = '#2f72d8'; ctx.font = '700 28px Pretendard, sans-serif'; ctx.fillText('좋은 배움이 더 좋은 내일을 만듭니다.', 72, 840);
  });
  const print = new THREE.Mesh(new THREE.PlaneGeometry(3.22, 2.42), new THREE.MeshBasicMaterial({ map: timetableTex }));
  print.position.set(0, .03, .15);
  print.rotation.x = -.13;
  stand.add(print);

  for (let i = 0; i < 13; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.115, .025, 12, 28), material(THREE, 0xa1774c, .25, .65));
    ring.position.set(-1.48 + i * .245, 1.48, .08);
    ring.rotation.x = Math.PI / 2;
    stand.add(ring);
  }
  stand.position.set(1.65, .2, .05);
  stand.rotation.y = -.13;
  root.add(stand);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(.34, .37, 1.05, 32), material(THREE, 0xf0ede6, .72, 0));
  cup.position.set(4.05, -1.13, .15); cup.castShadow = true; root.add(cup);
  const penColors=[0x244f82,0xdd6f6f,0x4d8a70,0xe2a54f];
  penColors.forEach((c,i)=>{const pen=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1.45,14),material(THREE,c,.32,.12));pen.position.set(3.87+i*.12,-.25+Math.sin(i)*.06,.15);pen.rotation.z=(i-1.5)*.08;pen.castShadow=true;root.add(pen)});
}

function buildChangesScene(THREE, RoundedBoxGeometry, root) {
  addClassroomBackdrop(THREE, RoundedBoxGeometry, root);
  const frame = roundedMesh(THREE, RoundedBoxGeometry, [5.0, 3.15, .22], .08, material(THREE, 0x7b593c, .55, .06));
  frame.position.set(1.35, .18, -.1);
  frame.rotation.y = -.09;
  root.add(frame);
  const cork = roundedMesh(THREE, RoundedBoxGeometry, [4.72, 2.88, .12], .06, material(THREE, 0xa77b53, .94, 0));
  cork.position.set(1.35, .18, .05); cork.rotation.y = -.09; root.add(cork);

  const notes = [
    {x:-.2,y:.76,w:1.65,h:1.08,bg:'#fae6e8',title:'수업 변경 안내',body:'3교시 수학 I\n→ 확률과 통계'},
    {x:1.65,y:.72,w:1.65,h:1.08,bg:'#e6f1fb',title:'교실 이동 안내',body:'2교시 영어\n1-1 → 2-3'},
    {x:-.12,y:-.62,w:1.65,h:1.0,bg:'#f6ead0',title:'강사 변경',body:'5교시 한국사\n담당 교사 변경'},
    {x:1.72,y:-.66,w:1.65,h:1.0,bg:'#e4f1e6',title:'시간표 조정',body:'6교시 창체\n동아리 활동'},
  ];
  notes.forEach((n, idx) => {
    const tex = makeCanvasTexture(THREE, 700, 460, (ctx,w,h)=>{
      ctx.fillStyle=n.bg;ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#284260';ctx.font='800 42px Pretendard, sans-serif';ctx.fillText(n.title,42,85);
      ctx.fillStyle='#4e6177';ctx.font='600 34px Pretendard, sans-serif';
      n.body.split('\n').forEach((line,i)=>ctx.fillText(line,42,170+i*58));
      ctx.fillStyle='rgba(30,65,100,.35)';ctx.font='600 22px Pretendard, sans-serif';ctx.fillText('TODAY SCHOOL NOTICE',42,h-42);
    });
    const note = roundedMesh(THREE, RoundedBoxGeometry,[n.w,n.h,.055],.035,material(THREE,0xffffff,.85,0));
    note.position.set(n.x,n.y,.16);note.rotation.set(0,-.09,(idx%2?-.02:.025));root.add(note);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(n.w*.95,n.h*.9),new THREE.MeshBasicMaterial({map:tex}));
    print.position.set(n.x,n.y,.196);print.rotation.set(0,-.09,(idx%2?-.02:.025));root.add(print);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.065,20,16),material(THREE,[0xd54e50,0x2e77b5,0xd49a30,0x4a8a68][idx],.25,.25));
    pin.position.set(n.x,n.y+n.h*.41,.25);pin.castShadow=true;root.add(pin);
  });
  root.add(createBook(THREE,RoundedBoxGeometry,'오늘, 더 특별한 나',0x2e557f,-2.15,-1.42,.25,.08));
  root.add(createBook(THREE,RoundedBoxGeometry,'더 넓은 세상',0xd9d3c8,-2.02,-1.0,.22,.05));
}

function buildSettingsScene(THREE, RoundedBoxGeometry, root) {
  addClassroomBackdrop(THREE, RoundedBoxGeometry, root);
  root.add(createBook(THREE, RoundedBoxGeometry, '수학 I', 0x315b8c, -1.9, -.78, -.15, .08));
  root.add(createBook(THREE, RoundedBoxGeometry, '영어 I', 0x1f4166, -1.78, -.35, -.17, .05));
  root.add(createBook(THREE, RoundedBoxGeometry, '통합과학', 0x52645b, -1.65, .08, -.2, .02));

  const idGroup = new THREE.Group();
  const holder = roundedMesh(THREE, RoundedBoxGeometry, [3.1, 2.05, .14], .13, new THREE.MeshPhysicalMaterial({color:0xeef6ff,roughness:.12,metalness:0,transmission:.18,transparent:true,opacity:.93,clearcoat:1,clearcoatRoughness:.08}));
  holder.castShadow=true; idGroup.add(holder);
  const schoolName = localStorage.getItem('schoolName') || '오늘 학교';
  const grade = localStorage.getItem('schoolGrade') || '-';
  const klass = localStorage.getItem('schoolClass') || '-';
  const idTex = makeCanvasTexture(THREE, 1100, 720, (ctx,w,h)=>{
    ctx.fillStyle='#fbfdff';ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#164f8f';ctx.fillRect(0,0,w,118);
    ctx.fillStyle='#fff';ctx.font='800 44px Pretendard, sans-serif';ctx.fillText(schoolName.slice(0,14),58,76);
    ctx.fillStyle='#d9e9fa';ctx.font='700 22px Pretendard, sans-serif';ctx.fillText('SCHOOL ID',850,74);
    ctx.fillStyle='#dce8f5';roundedRect(ctx,58,172,260,280,24);ctx.fill();
    ctx.fillStyle='#7f9dbf';ctx.beginPath();ctx.arc(188,265,66,0,Math.PI*2);ctx.fill();roundedRect(ctx,107,332,162,94,45);ctx.fill();
    ctx.fillStyle='#183d69';ctx.font='800 52px Pretendard, sans-serif';ctx.fillText('학생',370,240);
    ctx.font='700 36px Pretendard, sans-serif';ctx.fillText(`${grade}학년 ${klass}반`,370,300);
    ctx.fillStyle='#7189a4';ctx.font='500 25px Pretendard, sans-serif';ctx.fillText('오늘과 내일을 연결하는 학교생활',370,355);
    ctx.fillStyle='#cbd6e2';for(let i=0;i<18;i++)ctx.fillRect(370+i*25,480,12+(i%3)*5,92);
    ctx.fillStyle='#2c6db9';ctx.font='700 24px Pretendard, sans-serif';ctx.fillText('LEARN · GROW · TOGETHER',58,650);
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(2.94,1.89),new THREE.MeshBasicMaterial({map:idTex}));card.position.z=.081;idGroup.add(card);
  const clip = roundedMesh(THREE,RoundedBoxGeometry,[.72,.22,.22],.07,material(THREE,0x264d7d,.28,.48));clip.position.set(0,1.08,.09);idGroup.add(clip);
  idGroup.position.set(1.2,.32,.18);idGroup.rotation.set(-.04,-.12,.045);root.add(idGroup);

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(.9,1.45,.18),new THREE.Vector3(2.5,2.1,-.05),new THREE.Vector3(3.5,1.25,-.2),new THREE.Vector3(3.1,-.5,-.1),new THREE.Vector3(2.2,-1.35,.12)
  ]);
  const strap = new THREE.Mesh(new THREE.TubeGeometry(curve,80,.075,14,false),material(THREE,0x123969,.52,.12));strap.castShadow=true;root.add(strap);
}

function createScene(THREE, RoundedBoxGeometry, canvas) {
  const type = canvas.dataset.scene || 'home';
  const renderer = new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, mobile ? 1.55 : 2.15));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x000000,0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34,1,.1,100);
  camera.position.set(0,.15,8.4);
  const root = new THREE.Group(); scene.add(root);

  scene.add(new THREE.HemisphereLight(0xf8fbff,0x8a7968,2.05));
  const sun = new THREE.DirectionalLight(0xfff5df,4.6);sun.position.set(-4,6,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.bias=-.0002;scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa8cfff,2.0);fill.position.set(5,2,5);scene.add(fill);
  const warm = new THREE.PointLight(0xffc994,7,15,2);warm.position.set(2,-1,4);scene.add(warm);

  if(type==='home'||type==='onboarding') buildHomeScene(THREE,RoundedBoxGeometry,root,type==='onboarding');
  if(type==='schedule') buildScheduleScene(THREE,RoundedBoxGeometry,root);
  if(type==='changes') buildChangesScene(THREE,RoundedBoxGeometry,root);
  if(type==='settings') buildSettingsScene(THREE,RoundedBoxGeometry,root);

  const host = canvas.parentElement;
  const pointer={x:0,y:0};
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(host){
    host.addEventListener('pointermove',(e)=>{const r=host.getBoundingClientRect();if(!r.width||!r.height)return;pointer.x=((e.clientX-r.left)/r.width-.5)*2;pointer.y=((e.clientY-r.top)/r.height-.5)*2},{passive:true});
    host.addEventListener('pointerleave',()=>{pointer.x=0;pointer.y=0},{passive:true});
  }

  function resize(){const r=canvas.getBoundingClientRect();const w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();camera.position.z=w<520?9.3:8.4;root.scale.setScalar(w<520?.88:1)}
  const ro=new ResizeObserver(resize);ro.observe(canvas);resize();
  let raf=0,sx=0,sy=0;
  function frame(t){sx+=(pointer.x-sx)*.045;sy+=(pointer.y-sy)*.045;if(!reduced){root.rotation.y=sx*.025;root.rotation.x=-sy*.012;camera.position.x=sx*.08;camera.position.y=.15-sy*.045}else{root.rotation.set(0,0,0)}renderer.render(scene,camera);raf=requestAnimationFrame(frame)}
  raf=requestAnimationFrame(frame);
  window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);ro.disconnect();renderer.dispose()},{once:true});
}
