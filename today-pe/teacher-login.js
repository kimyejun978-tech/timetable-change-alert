const {
  STORAGE,
  readJSON,
  writeJSON,
  escapeHTML,
  schoolCodeOf,
  searchSchools,
  renderSchoolButton,
  showToast,
} = window.OneulPE;

let selectedSchool = null;

const searchForm = document.getElementById('teacherSchoolSearchForm');
const searchInput = document.getElementById('teacherSchoolSearchInput');
const searchStatus = document.getElementById('teacherSchoolSearchStatus');
const searchResults = document.getElementById('teacherSchoolResults');
const loginForm = document.getElementById('teacherLoginForm');
const schoolSummary = document.getElementById('teacherSchoolSummary');

async function sha256(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.length < 2) {
    searchStatus.textContent = '학교 이름을 두 글자 이상 입력해주세요.';
    return;
  }

  searchStatus.textContent = '학교를 검색하고 있어요…';
  searchResults.innerHTML = '';
  loginForm.classList.add('hidden');

  try {
    const rows = await searchSchools(query);
    if (!rows.length) {
      searchStatus.textContent = '검색 결과가 없습니다.';
      return;
    }

    searchStatus.textContent = `${rows.length}개 학교를 찾았습니다.`;
    rows.forEach((school) => searchResults.appendChild(renderSchoolButton(school, chooseSchool)));
  } catch (error) {
    console.error(error);
    searchStatus.textContent = 'NEIS 학교 검색에 연결하지 못했습니다.';
  }
});

function chooseSchool(school) {
  selectedSchool = school;
  schoolSummary.innerHTML = `
    <strong>${escapeHTML(school.SCHUL_NM)}</strong><br />
    ${escapeHTML(school.LCTN_SC_NM || '')} · ${escapeHTML(school.ORG_RDNMA || '')}
  `;
  loginForm.classList.remove('hidden');
  loginForm.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedSchool) {
    showToast('학교를 먼저 선택해주세요.');
    return;
  }

  const name = document.getElementById('teacherName').value.trim();
  const email = document.getElementById('teacherEmail').value.trim().toLowerCase();
  const pin = document.getElementById('teacherPin').value;
  const pinHash = await sha256(pin);
  const schoolCode = schoolCodeOf(selectedSchool);
  const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);

  let teacher = profiles.find((item) => item.email === email && item.schoolCode === schoolCode);

  if (teacher) {
    if (teacher.pinHash !== pinHash) {
      showToast('PIN이 일치하지 않습니다.');
      return;
    }
  } else {
    teacher = {
      id: crypto.randomUUID(),
      name,
      email,
      school: selectedSchool,
      schoolCode,
      pinHash,
      createdAt: new Date().toISOString(),
    };
    profiles.push(teacher);
    writeJSON(localStorage, STORAGE.teacherProfiles, profiles);
  }

  const session = {
    teacherId: teacher.id,
    name: teacher.name,
    email: teacher.email,
    school: teacher.school,
    schoolCode: teacher.schoolCode,
    signedInAt: new Date().toISOString(),
  };

  writeJSON(sessionStorage, STORAGE.teacherSession, session);
  window.location.replace('./teacher.html');
});
