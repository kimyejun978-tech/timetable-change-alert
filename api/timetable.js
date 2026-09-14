import Comcigan from 'parse-comcigan';

const PE_KEYWORDS = ['체육', '운동과 건강', '스포츠 생활', '스포츠', '체육탐구', '체육 탐구'];
const MAX_SCHOOL_NAME_LENGTH = 100;
const MAX_REGION_LENGTH = 60;
const MAX_GRADES = 6;
const MAX_CLASSES_PER_GRADE = 50;

function isPeSubject(subject = '') {
  const normalized = String(subject).replace(/\s+/g, ' ').trim();
  return PE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function normalizeRegion(value = '') {
  return String(value)
    .replace(/특별자치시|특별자치도|광역시|특별시|도$/g, '')
    .trim();
}

function parseYmd(value) {
  const text = String(value || '').trim();
  if (!text) return new Date();
  if (!/^\d{8}$/.test(text)) return null;

  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6));
  const day = Number(text.slice(6, 8));
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) return null;
  return date;
}

function toYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function validOfficeCode(value) {
  return /^[A-Z0-9]{2,20}$/i.test(String(value || ''));
}

function validSchoolCode(value) {
  return /^\d{5,20}$/.test(String(value || ''));
}

async function fromComcigan({ schoolName, region, date }) {
  const schools = await Comcigan.search(schoolName);
  if (!schools.length) throw new Error('COMCIGAN_SCHOOL_NOT_FOUND');

  const requestedRegion = normalizeRegion(region);
  const exact = schools.find((school) => school.name === schoolName && (
    !requestedRegion || normalizeRegion(school.region).includes(requestedRegion)
      || requestedRegion.includes(normalizeRegion(school.region))
  ));
  const sameName = schools.find((school) => school.name === schoolName);
  const school = exact || sameName;
  if (!school) throw new Error('COMCIGAN_EXACT_SCHOOL_NOT_FOUND');

  const comci = new Comcigan(school.code);
  const info = await comci.schoolInfo();
  const weekday = date.getDay();
  if (weekday < 1 || weekday > 5) {
    return {
      provider: 'comcigan',
      school: { name: school.name, region: school.region, code: school.code },
      rows: [],
      periodTimes: info.times || [],
      warning: null,
    };
  }

  const rows = [];
  const classesByGrade = Array.isArray(info.classes) ? info.classes : [];
  const gradeCount = Math.min(classesByGrade.length, MAX_GRADES);

  for (let grade = 1; grade <= gradeCount; grade += 1) {
    const rawClassCount = Number(classesByGrade[grade - 1] || 0);
    const classCount = Number.isFinite(rawClassCount)
      ? Math.max(0, Math.min(Math.trunc(rawClassCount), MAX_CLASSES_PER_GRADE))
      : 0;

    for (let classNum = 1; classNum <= classCount; classNum += 1) {
      const weekly = await comci.timetable({ grade, classNum });
      const day = weekly?.[weekday - 1];
      const items = day?.items || [];

      items.forEach((item, index) => {
        if (!isPeSubject(item.subject)) return;
        rows.push({
          grade,
          classNo: classNum,
          period: index + 1,
          subject: item.subject,
          teacher: item.teacher || '',
          classroom: item.classRoom || '',
          changed: Boolean(item.original),
          originalSubject: item.original?.subject || '',
          originalTeacher: item.original?.teacher || '',
        });
      });
    }
  }

  rows.sort((a, b) => a.period - b.period || a.grade - b.grade || a.classNo - b.classNo);

  return {
    provider: 'comcigan',
    school: { name: school.name, region: school.region, code: school.code },
    rows,
    periodTimes: info.times || [],
    warning: null,
  };
}

async function fromNeis({ officeCode, schoolCode, date }) {
  if (!validOfficeCode(officeCode) || !validSchoolCode(schoolCode)) {
    throw new Error('NEIS_SCHOOL_CODE_INVALID');
  }
  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: process.env.NEIS_API_KEY ? '1000' : '5',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
    ALL_TI_YMD: toYmd(date),
  });
  if (process.env.NEIS_API_KEY) params.set('KEY', process.env.NEIS_API_KEY);

  const response = await fetch(`https://open.neis.go.kr/hub/hisTimetable?${params.toString()}`);
  if (!response.ok) throw new Error(`NEIS_HTTP_${response.status}`);
  const data = await response.json();
  const dataset = data?.hisTimetable;
  const rawRows = dataset?.[1]?.row || [];
  const rows = rawRows
    .filter((row) => isPeSubject(row.ITRT_CNTNT))
    .map((row) => ({
      grade: Number(row.GRADE),
      classNo: Number(row.CLASS_NM),
      period: Number(row.PERIO),
      subject: row.ITRT_CNTNT || '체육',
      teacher: '',
      classroom: '',
      changed: false,
      originalSubject: '',
      originalTeacher: '',
    }))
    .filter((row) => (
      Number.isInteger(row.grade) && row.grade >= 1 && row.grade <= MAX_GRADES
      && Number.isInteger(row.classNo) && row.classNo >= 1 && row.classNo <= MAX_CLASSES_PER_GRADE
      && Number.isInteger(row.period) && row.period >= 1 && row.period <= 20
    ))
    .sort((a, b) => a.period - b.period || a.grade - b.grade || a.classNo - b.classNo);

  return {
    provider: 'neis',
    school: null,
    rows,
    periodTimes: [],
    warning: process.env.NEIS_API_KEY
      ? null
      : 'NEIS 인증키가 없어 fallback 결과가 최대 5건으로 제한될 수 있습니다.',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const schoolName = String(req.query.schoolName || '').trim();
  const region = String(req.query.region || '').trim();
  const officeCode = String(req.query.officeCode || '').trim();
  const schoolCode = String(req.query.schoolCode || '').trim();
  const date = parseYmd(req.query.date);

  if (!schoolName || schoolName.length > MAX_SCHOOL_NAME_LENGTH) {
    return res.status(400).json({ error: 'INVALID_SCHOOL_NAME' });
  }
  if (region.length > MAX_REGION_LENGTH) {
    return res.status(400).json({ error: 'INVALID_REGION' });
  }
  if (!date) {
    return res.status(400).json({ error: 'INVALID_DATE' });
  }

  const failures = [];
  try {
    const result = await fromComcigan({ schoolName, region, date });
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    return res.status(200).json({ ...result, fallbackUsed: false, failures });
  } catch (error) {
    failures.push({ provider: 'comcigan', message: error?.message || String(error) });
  }

  try {
    const result = await fromNeis({ officeCode, schoolCode, date });
    res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
    return res.status(200).json({ ...result, fallbackUsed: true, failures });
  } catch (error) {
    failures.push({ provider: 'neis', message: error?.message || String(error) });
    return res.status(502).json({ error: 'TIMETABLE_PROVIDERS_FAILED', failures });
  }
}
