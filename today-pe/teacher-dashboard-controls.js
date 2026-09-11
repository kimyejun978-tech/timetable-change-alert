(() => {
  const schedule = document.getElementById('peSchedule');
  const identity = document.getElementById('teacherIdentity');
  if (!schedule || !identity) return;

  let mode = 'all';
  let controls = null;
  let summary = null;

  function teacherName() {
    return identity.textContent.replace(/\s*선생님\s*$/, '').trim();
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
    controls.querySelectorAll('[data-schedule-filter]').forEach((button) => {
      button.addEventListener('click', () => {
        mode = button.dataset.scheduleFilter;
        controls.querySelectorAll('[data-schedule-filter]').forEach((item) => {
          item.classList.toggle('selected', item === button);
        });
        applyFilter();
      });
    });
  }

  function applyFilter() {
    ensureControls();
    const items = [...schedule.querySelectorAll('.schedule-item')];
    const name = teacherName();
    let visible = 0;
    let mineCount = 0;
    let riskCount = 0;

    items.forEach((item) => {
      const isMine = Boolean(name) && item.textContent.includes(name);
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
        ? '컴시간 담당교사명과 로그인 이름이 일치하는 오늘 체육수업이 없습니다.'
        : '현재 우천 주의로 표시된 수업이 없습니다.';
    } else {
      empty?.remove();
    }
  }

  const observer = new MutationObserver(() => applyFilter());
  observer.observe(schedule, { childList: true });

  const identityObserver = new MutationObserver(() => applyFilter());
  identityObserver.observe(identity, { childList: true, characterData: true, subtree: true });

  ensureControls();
  applyFilter();
})();
