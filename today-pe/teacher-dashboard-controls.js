(() => {
  const schedule = document.getElementById('peSchedule');
  const identity = document.getElementById('teacherIdentity');
  const Backend = window.OneulPEBackend;
  if (!schedule || !identity || !Backend) return;

  const ALIAS_STORAGE_KEY = 'oneulPe.timetableAliases.v1';
  let mode = 'all';
  let controls = null;
  let summary = null;
  let aliasPanel = null;
  let accessPanel = null;
  let aliases = [];
  let profile = null;

  function normalizeName(value) {
    return String(value || '')
      .replace(/선생님/g, '')
      .replace(/[\s.()]/g, '')
      .trim()
      .toLowerCase();
  }

  function teacherName() {
    return identity.textContent.replace(/\s*선생님\s*$/, '').trim();
  }

  function matchKeys() {
    return new Set([teacherName(), ...aliases].map(normalizeName).filter(Boolean));
  }

  function sourceTeacherNames(item) {
    const raw = item.querySelector('.schedule-main > small')?.textContent || '';
    if (!raw.trim()) return [];
    const beforeRoom = raw.split('·')[0].replace(/선생님/g, '').trim();
    return beforeRoom
      .split(/[,/&+]/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  function isMyScheduleItem(item) {
    const keys = matchKeys();
    if (!keys.size) return false;
    return sourceTeacherNames(item).some((name) => keys.has(normalizeName(name)));
  }

  function getStoredSessionAccessToken() {
    const config = window.ONEUL_PE_CONFIG || {};
    const match = String(config.SUPABASE_URL || '').match(/https:\/\/([^.]+)\.supabase\.co/i);
    const projectRef = match?.[1];
    if (!projectRef) return null;
    const raw = localStorage.getItem(`sb-${projectRef}-auth-token`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.access_token || parsed?.currentSession?.access_token || null;
    } catch {
      return null;
    }
  }

  async function rpc(name, body = {}) {
    const config = window.ONEUL_PE_CONFIG || {};
    const token = getStoredSessionAccessToken();
    if (!config.SUPABASE_URL || !config.SUPABASE_ANON_KEY || !token) {
      throw new Error('교사 로그인 세션을 찾지 못했습니다. 다시 로그인해주세요.');
    }
    const response = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: config.SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload.message || `RPC ${name} 실패`);
    }
    return response.status === 204 ? null : response.json();
  }

  function localAliasMap() {
    try {
      return JSON.parse(localStorage.getItem(ALIAS_STORAGE_KEY) || '{}');
    } catch {
      return {};
    }
  }

  async function loadAliases() {
    profile ||= await Backend.getTeacherSession();
    if (!profile) return [];
    if (!Backend.remoteEnabled) {
      const map = localAliasMap();
      aliases = Array.isArray(map[profile.teacherId]) ? map[profile.teacherId] : [];
      return aliases;
    }
    const data = await rpc('get_my_timetable_aliases');
    aliases = Array.isArray(data) ? data : [];
    return aliases;
  }

  async function saveAliases(nextAliases) {
    profile ||= await Backend.getTeacherSession();
    if (!profile) throw new Error('교사 세션을 찾지 못했습니다.');
    const cleaned = [...new Set(nextAliases.map((item) => item.trim()).filter(Boolean))].slice(0, 10);

    if (!Backend.remoteEnabled) {
      const map = localAliasMap();
      map[profile.teacherId] = cleaned;
      localStorage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(map));
      aliases = cleaned;
      return aliases;
    }

    try {
      const data = await rpc('set_my_timetable_aliases', { p_aliases: cleaned });
      aliases = Array.isArray(data) ? data : cleaned;
      return aliases;
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('ALIAS_ALREADY_USED')) throw new Error('같은 학교의 다른 선생님이 이미 사용하는 시간표 이름입니다.');
      if (message.includes('ALIAS_CONFLICTS_WITH_TEACHER_NAME')) throw new Error('다른 선생님의 실제 이름과 겹치는 별칭은 사용할 수 없습니다.');
      if (message.includes('TOO_MANY_ALIASES')) throw new Error('별칭은 최대 10개까지 등록할 수 있습니다.');
      throw error;
    }
  }

  function renderAliasStatus() {
    if (!aliasPanel) return;
    const input = aliasPanel.querySelector('[data-alias-input]');
    const status = aliasPanel.querySelector('[data-alias-status]');
    if (input) input.value = aliases.join(', ');
    if (status) {
      const names = [teacherName(), ...aliases].filter(Boolean);
      status.textContent = `내 시간표 매칭 이름: ${names.length ? names.join(', ') : '없음'}`;
    }
  }

  function localRevokeTeacher(teacherId) {
    const { STORAGE, readJSON, writeJSON } = window.OneulPE;
    const profiles = readJSON(localStorage, STORAGE.teacherProfiles, []);
    const target = profiles.find((item) => item.id === teacherId);
    if (!target) throw new Error('교사 정보를 찾지 못했습니다.');
    if (target.id === profile.teacherId) throw new Error('자기 자신의 권한은 회수할 수 없습니다.');

    target.verified = false;
    target.role = 'teacher';
    writeJSON(localStorage, STORAGE.teacherProfiles, profiles);

    const nameById = new Map(profiles.map((item) => [item.id, item.name]));
    const lessons = readJSON(localStorage, STORAGE.lessons, []);
    lessons.forEach((lesson) => {
      if (lesson.schoolCode !== profile.schoolCode || !Array.isArray(lesson.teacherIds) || !lesson.teacherIds.includes(teacherId)) return;
      let nextIds = lesson.teacherIds.filter((id) => id !== teacherId);
      if (!nextIds.length) nextIds = [profile.teacherId];
      lesson.teacherIds = nextIds;
      lesson.teacherNames = nextIds.map((id) => nameById.get(id) || profile.name);
      lesson.teacherId = nextIds[0];
      lesson.teacherName = lesson.teacherNames[0];
      lesson.updatedAt = new Date().toISOString();
    });
    writeJSON(localStorage, STORAGE.lessons, lessons);

    const map = localAliasMap();
    delete map[teacherId];
    localStorage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(map));
  }

  async function revokeTeacherAccess(teacherId) {
    if (!profile || profile.role !== 'school_admin') throw new Error('학교 관리자 권한이 필요합니다.');
    if (!Backend.remoteEnabled) {
      localRevokeTeacher(teacherId);
      return;
    }
    try {
      await rpc('revoke_teacher_access', { p_teacher_user_id: teacherId });
    } catch (error) {
      const message = String(error?.message || '');
      if (message.includes('CANNOT_REVOKE_SELF')) throw new Error('자기 자신의 권한은 회수할 수 없습니다.');
      if (message.includes('ADMIN_REQUIRED')) throw new Error('학교 관리자 권한이 필요합니다.');
      if (message.includes('TEACHER_NOT_FOUND')) throw new Error('같은 학교의 교사를 찾지 못했습니다.');
      throw error;
    }
  }

  function ensureAccessPanel() {
    if (!profile || profile.role !== 'school_admin' || accessPanel?.isConnected) return;
    const approvalCard = document.getElementById('teacherApprovalCard');
    if (!approvalCard) return;

    accessPanel = document.createElement('section');
    accessPanel.className = 'admin-access-panel';
    accessPanel.innerHTML = `
      <div class="history-heading">
        <div>
          <strong>승인된 교사 관리</strong>
          <small>접근 권한을 회수하면 해당 교사는 즉시 교사용 기능을 사용할 수 없습니다.</small>
        </div>
        <button type="button" class="ghost-button small" data-access-refresh>새로고침</button>
      </div>
      <div class="teacher-lesson-list" data-approved-teacher-list></div>
    `;
    approvalCard.appendChild(accessPanel);
    accessPanel.querySelector('[data-access-refresh]').addEventListener('click', loadApprovedTeachers);
  }

  async function loadApprovedTeachers() {
    if (!profile || profile.role !== 'school_admin') return;
    ensureAccessPanel();
    const list = accessPanel?.querySelector('[data-approved-teacher-list]');
    if (!list) return;
    list.innerHTML = '<p class="muted">승인된 교사를 불러오는 중입니다…</p>';
    try {
      const teachers = await Backend.listSchoolTeachers(profile);
      if (!teachers.length) {
        list.innerHTML = '<p class="muted">승인된 교사가 없습니다.</p>';
        return;
      }
      list.innerHTML = '';
      teachers.forEach((teacher) => {
        const item = document.createElement('article');
        item.className = 'teacher-lesson-item';
        const isMe = teacher.isMe || teacher.teacherId === profile.teacherId;
        item.innerHTML = `
          <div>
            <strong>${window.OneulPE.escapeHTML(teacher.name || '체육교사')}</strong>
            <small>${teacher.role === 'school_admin' ? '학교 관리자' : '체육교사'}${isMe ? ' · 내 계정' : ''}</small>
          </div>
          <div class="actions">
            ${isMe ? '<span class="read-only-label">현재 로그인</span>' : `<button type="button" class="danger-button" data-revoke-teacher="${window.OneulPE.escapeHTML(teacher.teacherId)}">권한 회수</button>`}
          </div>
        `;
        list.appendChild(item);
      });

      list.querySelectorAll('[data-revoke-teacher]').forEach((button) => {
        button.addEventListener('click', async () => {
          const target = teachers.find((teacher) => teacher.teacherId === button.dataset.revokeTeacher);
          if (!window.confirm(`${target?.name || '이 교사'}의 교사용 접근 권한을 회수할까요?`)) return;
          button.disabled = true;
          try {
            await revokeTeacherAccess(button.dataset.revokeTeacher);
            window.OneulPE?.showToast?.('교사 접근 권한을 회수했습니다. 단독 담당 수업은 관리자에게 인계됩니다.');
            await loadApprovedTeachers();
            setTimeout(() => window.location.reload(), 500);
          } catch (error) {
            console.error(error);
            window.OneulPE?.showToast?.(error?.message || '교사 권한 회수에 실패했습니다.');
            button.disabled = false;
          }
        });
      });
    } catch (error) {
      console.error(error);
      list.innerHTML = '<p class="muted">승인된 교사 목록을 불러오지 못했습니다.</p>';
    }
  }

  function ensureControls() {
    if (controls?.isConnected) return;
    controls = document.createElement('div');
    controls.className = 'schedule-filter-bar';
    controls.innerHTML = `
      <div class="segment-control" role="group" aria-label="시간표 보기">
        <button class="segment-button selected" type="button" data-schedule-filter="all">전체 체육</button>
        <button class="segment-button" type="button" data-schedule-filter="mine">내 시간표</button>
        <button class="segment-button" type="button" data-schedule-filter="risk">우천 주의</button>
      </div>
      <small class="schedule-filter-summary"></small>
    `;
    summary = controls.querySelector('.schedule-filter-summary');
    schedule.parentElement.insertBefore(controls, schedule);

    aliasPanel = document.createElement('details');
    aliasPanel.className = 'subtle-card timetable-alias-panel';
    aliasPanel.innerHTML = `
      <summary><strong>컴시간 이름 매칭 설정</strong></summary>
      <p class="muted">컴시간알리미에 표시되는 담당교사명이 로그인 이름과 다를 때만 추가하세요. 쉼표로 여러 개 입력할 수 있습니다.</p>
      <div class="inline-form-row">
        <input type="text" data-alias-input maxlength="240" placeholder="예: 김체육, 김○○" />
        <button type="button" class="ghost-button" data-alias-save>저장</button>
      </div>
      <small class="data-source" data-alias-status></small>
    `;
    controls.insertAdjacentElement('afterend', aliasPanel);

    controls.querySelectorAll('[data-schedule-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.scheduleFilter;
        controls.querySelectorAll('[data-schedule-filter]').forEach((item) => {
          item.classList.toggle('selected', item === button);
        });
        applyFilter();
      });
    });

    aliasPanel.querySelector('[data-alias-save]').addEventListener('click', async (event) => {
      const button = event.currentTarget;
      const input = aliasPanel.querySelector('[data-alias-input]');
      button.disabled = true;
      try {
        await saveAliases(String(input.value || '').split(','));
        renderAliasStatus();
        applyFilter();
        window.OneulPE?.showToast?.('시간표 이름 매칭을 저장했습니다.');
      } catch (error) {
        console.error(error);
        window.OneulPE?.showToast?.(error?.message || '시간표 이름 매칭 저장에 실패했습니다.');
      } finally {
        button.disabled = false;
      }
    });
  }

  function applyFilter() {
    ensureControls();
    const items = [...schedule.querySelectorAll('.schedule-item')];
    let visible = 0;
    let mineCount = 0;
    let riskCount = 0;

    items.forEach((item) => {
      const isMine = isMyScheduleItem(item);
      const isRisk = item.classList.contains('weather-risk');
      if (isMine) mineCount += 1;
      if (isRisk) riskCount += 1;

      const show = mode === 'all' || (mode === 'mine' && isMine) || (mode === 'risk' && isRisk);
      item.classList.toggle('schedule-filter-hidden', !show);
      if (show) visible += 1;
    });

    if (!items.length) {
      summary.textContent = '표시할 체육 시간표가 없습니다.';
      return;
    }

    const labels = {
      all: `전체 ${items.length}개 · 내 수업 ${mineCount}개 · 우천 주의 ${riskCount}개`,
      mine: `내 시간표 ${visible}개`,
      risk: `우천 확인이 필요한 수업 ${visible}개`,
    };
    summary.textContent = labels[mode];

    let empty = schedule.querySelector('.schedule-filter-empty');
    if (visible === 0 && mode !== 'all') {
      if (!empty) {
        empty = document.createElement('p');
        empty.className = 'muted schedule-filter-empty';
        schedule.appendChild(empty);
      }
      empty.textContent = mode === 'mine'
        ? '로그인 이름/별칭과 컴시간 담당교사명이 일치하는 오늘 체육수업이 없습니다. 이름 매칭 설정을 확인해주세요.'
        : '현재 우천 주의로 표시된 수업이 없습니다.';
    } else {
      empty?.remove();
    }
  }

  const observer = new MutationObserver(() => applyFilter());
  observer.observe(schedule, { childList: true });

  const identityObserver = new MutationObserver(() => {
    renderAliasStatus();
    applyFilter();
  });
  identityObserver.observe(identity, { childList: true, characterData: true, subtree: true });

  ensureControls();
  loadAliases()
    .then(async () => {
      renderAliasStatus();
      applyFilter();
      ensureAccessPanel();
      await loadApprovedTeachers();
    })
    .catch((error) => {
      console.error('교사 대시보드 보조 기능을 불러오지 못했습니다.', error);
      renderAliasStatus();
      applyFilter();
    });
})();
