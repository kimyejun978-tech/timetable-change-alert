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
const backendLabel = document.getElementById('backendModeLabel');
const backendDescription = document.getElementById('backendModeDescription');

function setBackendModeCopy() {
  if (Backend.remoteEnabled) {
    backendLabel.textContent = '서버 인증 사용 중';
    backendDescription.textContent = '교사 계정은 이메일 인증 후 학교 관리자 승인 절차를 거칩니다.';
  } else {
    backendLabel.textContent = '로컬 데모 모드';
    backendDescription.textContent = '이 브라우저 안에서만 교사 계정과 수업 데이터를 저장합니다.';
  }
}

function arrivedFromEmailConfirmation() {
  return window.location.hash.includes('access_token=')
    || window.location.hash.includes('type=signup')
    || window.location.search.includes('code=');
}

function cleanAuthUrl() {
  if (!arrivedFromEmailConfirmation()) return;
  window.history.replaceState({}, document.title, window.location.pathname);
}

async function redirectIfSignedIn() {
  const fromEmail = arrivedFromEmailConfirmation();
  try {
    const profile = await Backend.getTeacherSession();
    if (fromEmail) cleanAuthUrl();

    if (profile?.verified) {
      if (fromEmail) showToast('이메일 인증이 완료됐어요. 교사 화면으로 이동합니다.');
      window.setTimeout(() => window.location.replace('./teacher.html'), fromEmail ? 450 : 0);
      return;
    }

    if (profile) {
      backendLabel.textContent = '이메일 인증 완료';
      backendDescription.textContent = `${profile.school?.SCHUL_NM || '선택한 학교'} 교사 계정 등록이 완료됐습니다. 학교 관리자 승인이 끝나면 교사 화면을 사용할 수 있습니다.`;
      if (fromEmail) showToast('이메일 인증이 완료됐어요. 이제 관리자 승인을 기다리면 됩니다.');
      return;
    }

    if (fromEmail) {
      backendLabel.textContent = '이메일 인증은 완료됐어요';
      backendDescription.textContent = '가입 정보를 이어서 등록하지 못했습니다. 같은 이메일과 비밀번호로 한 번 더 로그인해주세요.';
      showToast('이메일 인증 완료. 같은 계정으로 다시 로그인해주세요.');
    }
  } catch (error) {
    console.warn('기존 교사 세션 확인 실패', error);
    if (fromEmail) cleanAuthUrl();
  }
}

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query.replace(/\s+/g, '').length < 2) {
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
    searchStatus.textContent = '학교 검색에 연결하지 못했습니다.';
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
      backendLabel.textContent = '인증 메일을 보냈어요';
      backendDescription.textContent = `메일함에서 “[오늘체육] 교사 계정 이메일 인증” 메일을 열고 인증 버튼을 눌러주세요. 인증 후 자동으로 오늘체육으로 돌아옵니다.`;
      showToast('인증 메일을 보냈어요. 메일함을 확인해주세요.');
      return;
    }

    if (result.status === 'pending_initial_admin') {
      showToast('가입은 완료됐어요. 이 학교의 최초 관리자 승인을 기다리고 있습니다.');
      backendDescription.textContent = `${selectedSchool.SCHUL_NM}에는 아직 승인된 학교 관리자가 없습니다. 운영자가 교사 정보를 확인한 뒤 최초 학교 관리자로 지정하면 교사 화면을 사용할 수 있습니다.`;
      return;
    }

    if (result.status === 'pending') {
      backendLabel.textContent = '가입 완료 · 승인 대기';
      backendDescription.textContent = `${selectedSchool.SCHUL_NM}의 학교 관리자 승인 대기 상태입니다. 승인되면 같은 계정으로 교사 화면을 사용할 수 있습니다.`;
      showToast('교사 가입이 완료됐어요. 학교 관리자 승인을 기다려주세요.');
      return;
    }

    window.location.replace('./teacher.html');
  } catch (error) {
    console.error(error);
    const message = String(error?.message || '');
    if (message.includes('SCHOOL_CHANGE_REQUIRES_OPERATOR')) {
      try { await Backend.logoutTeacher(); } catch {}
      const copy = '이 교사 계정은 이미 다른 학교에 등록되어 있습니다. 학교 변경·정정은 운영자 확인이 필요합니다.';
      showToast(copy);
      backendDescription.textContent = copy;
      return;
    }
    showToast(error?.message || '교사 인증에 실패했습니다.');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = '교사 화면 들어가기';
  }
});

setBackendModeCopy();
redirectIfSignedIn();
