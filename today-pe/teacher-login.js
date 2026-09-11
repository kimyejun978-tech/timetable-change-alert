const {
  escapeHTML,
  searchSchools,
  renderSchoolButton,
  showToast,
} = window.OneulPE;
const Backend = window.OneulPEBackend;

let selectedSchool = null;

const searchForm = document.getElementById('teacherSchoolSearchForm');
const searchInput = document.getElementById('teacherSchoolSearchInput');
const searchStatus = document.getElementById('teacherSchoolSearchStatus');
const searchResults = document.getElementById('teacherSchoolResults');
const loginForm = document.getElementById('teacherLoginForm');
const schoolSummary = document.getElementById('teacherSchoolSummary');
const loginButton = document.getElementById('teacherLoginButton');

function setBackendModeCopy() {
  const label = document.getElementById('backendModeLabel');
  const description = document.getElementById('backendModeDescription');
  if (Backend.remoteEnabled) {
    label.textContent = 'Supabase 서버 인증 사용 중';
    description.textContent = '교사 계정은 서버에서 인증하며, 첫 교사는 학교 관리자로 승인됩니다. 이후 가입한 교사는 학교 관리자의 승인을 받은 뒤 교사용 화면에 접근할 수 있습니다.';
  } else {
    label.textContent = '로컬 데모 모드';
    description.textContent = 'Supabase 설정이 비어 있어 이 브라우저 안에서만 교사 계정과 수업 데이터를 저장합니다. 기능 시연은 가능하지만 다른 기기와 데이터가 공유되지는 않습니다.';
  }
}

async function redirectIfSignedIn() {
  try {
    const profile = await Backend.getTeacherSession();
    if (profile?.verified) window.location.replace('./teacher.html');
  } catch (error) {
    console.warn('기존 교사 세션 확인 실패', error);
  }
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
  const password = document.getElementById('teacherPassword').value;
  if (password.length < 8) {
    showToast('비밀번호는 8자 이상 입력해주세요.');
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = '인증 중…';
  try {
    const result = await Backend.loginTeacher({
      school: selectedSchool,
      name,
      email,
      password,
    });

    if (result.status === 'confirmation_required') {
      showToast('이메일 확인 링크를 확인한 뒤 다시 로그인해주세요.');
      return;
    }

    if (result.status === 'pending') {
      showToast('교사 가입이 접수됐어요. 학교 관리자 승인을 기다려주세요.');
      document.getElementById('backendModeDescription').textContent = `${selectedSchool.SCHUL_NM} 교사 승인 대기 상태입니다. 이 학교의 관리자 계정에서 승인하면 로그인할 수 있습니다.`;
      return;
    }

    window.location.replace('./teacher.html');
  } catch (error) {
    console.error(error);
    showToast(error?.message || '교사 인증에 실패했습니다.');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = '교사 화면 들어가기';
  }
});

setBackendModeCopy();
redirectIfSignedIn();
