export function validVapidSubject(value) {
  const subject = String(value || '').trim();
  return /^mailto:[^\s@]+@[^\s@]+$/i.test(subject) || /^https:\/\/[^\s]+$/i.test(subject);
}

export function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function targetFromSnapshot(snapshot, fallback = {}) {
  if (!snapshot && !fallback) return null;
  const grade = Number(snapshot?.grade ?? fallback.grade);
  const classNo = Number(snapshot?.class_number ?? fallback.class_number);
  if (!Number.isInteger(grade) || grade < 1 || grade > 6) return null;
  if (!Number.isInteger(classNo) || classNo < 1 || classNo > 50) return null;
  return {
    grade,
    classNo,
    period: Number(snapshot?.period ?? fallback.period ?? 0),
    activity: String(snapshot?.activity || '체육'),
    location: String(snapshot?.location || ''),
  };
}

function sameAudience(a, b) {
  return a?.grade === b?.grade && a?.classNo === b?.classNo;
}

export function buildDeliveryTargets(change) {
  const before = targetFromSnapshot(change.before_data, change);
  const after = targetFromSnapshot(change.after_data, change);

  if (change.change_type === 'create') {
    return after ? [{ ...after, kind: 'current' }] : [];
  }
  if (change.change_type === 'delete') {
    return before ? [{ ...before, kind: 'deleted' }] : [];
  }

  const targets = [];
  if (after) targets.push({ ...after, kind: 'current' });
  if (before && after && !sameAudience(before, after)) {
    targets.push({ ...before, kind: 'previous' });
  }
  return targets;
}

export function messageForTarget(changeType, target) {
  if (target.kind === 'previous') {
    return {
      title: '체육 안내가 변경됐어요',
      body: [
        `${target.grade}-${target.classNo}`,
        target.period ? `${target.period}교시` : '',
        '기존 체육 안내가 다른 반 정보로 변경됐어요. 앱에서 최신 내용을 확인해주세요.',
      ].filter(Boolean).join(' · ').slice(0, 240),
    };
  }

  const titles = {
    create: '체육 안내가 등록됐어요',
    update: '체육 안내가 변경됐어요',
    delete: '체육 안내가 취소됐어요',
  };
  return {
    title: titles[changeType] || titles.update,
    body: [
      `${target.grade}-${target.classNo}`,
      target.period ? `${target.period}교시` : '',
      target.activity,
      target.location,
    ].filter(Boolean).join(' · ').slice(0, 240),
  };
}
