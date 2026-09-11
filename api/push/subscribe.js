import { createClient } from '@supabase/supabase-js';

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('PUSH_BACKEND_NOT_CONFIGURED');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function normalizeBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function validEndpoint(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && String(value).length <= 2048;
  } catch {
    return false;
  }
}

function validOfficeCode(value) {
  return /^[A-Z0-9]{2,20}$/i.test(String(value || ''));
}

function validSchoolCode(value) {
  return /^\d{5,20}$/.test(String(value || ''));
}

function validPushKey(value, min, max) {
  const text = String(value || '');
  return text.length >= min && text.length <= max && /^[A-Za-z0-9_-]+$/.test(text);
}

async function fetchCanonicalSchool(officeCode, schoolCode) {
  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: '5',
    ATPT_OFCDC_SC_CODE: officeCode,
    SD_SCHUL_CODE: schoolCode,
  });
  if (process.env.NEIS_API_KEY) params.set('KEY', process.env.NEIS_API_KEY);

  const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`);
  if (!response.ok) throw new Error(`NEIS_HTTP_${response.status}`);
  const data = await response.json();
  const rows = data?.schoolInfo?.[1]?.row || [];
  const row = rows.find((item) => (
    String(item.ATPT_OFCDC_SC_CODE) === officeCode
    && String(item.SD_SCHUL_CODE) === schoolCode
  ));
  if (!row) return null;

  return {
    neis_office_code: officeCode,
    neis_school_code: schoolCode,
    name: String(row.SCHUL_NM || '').slice(0, 200),
    region: String(row.LCTN_SC_NM || '').slice(0, 100),
    address: String(row.ORG_RDNMA || '').slice(0, 500),
  };
}

async function resolveSchool(supabase, officeCode, schoolCode) {
  const { data: existing, error: existingError } = await supabase
    .from('schools')
    .select('id')
    .eq('neis_office_code', officeCode)
    .eq('neis_school_code', schoolCode)
    .maybeSingle();
  if (existingError) throw existingError;

  let canonical = null;
  try {
    canonical = await fetchCanonicalSchool(officeCode, schoolCode);
  } catch (error) {
    console.warn('NEIS push school verification failed', error?.message || error);
    if (existing) return existing;
    throw new Error('SCHOOL_VERIFICATION_FAILED');
  }

  if (!canonical) {
    if (existing) return existing;
    throw new Error('INVALID_SCHOOL');
  }

  const { data: schoolRow, error: schoolError } = await supabase
    .from('schools')
    .upsert(canonical, { onConflict: 'neis_office_code,neis_school_code' })
    .select('id')
    .single();
  if (schoolError) throw schoolError;
  return schoolRow;
}

export default async function handler(req, res) {
  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const supabase = serverClient();
    const body = normalizeBody(req);

    if (req.method === 'DELETE') {
      const endpoint = String(body.endpoint || '');
      const auth = String(body.auth || '');
      if (!validEndpoint(endpoint) || !validPushKey(auth, 8, 256)) {
        return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
      }
      const { error } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('auth', auth);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    const school = body.school || {};
    const subscription = body.subscription || {};
    const endpoint = String(subscription.endpoint || '');
    const p256dh = String(subscription.keys?.p256dh || '');
    const auth = String(subscription.keys?.auth || '');
    const grade = Number(body.grade);
    const classNo = Number(body.classNo);
    const officeCode = String(school.officeCode || '').trim();
    const schoolCode = String(school.schoolCode || '').trim();

    if (!validOfficeCode(officeCode) || !validSchoolCode(schoolCode)) {
      return res.status(400).json({ error: 'INVALID_SCHOOL' });
    }
    if (!Number.isInteger(grade) || grade < 1 || grade > 6 || !Number.isInteger(classNo) || classNo < 1 || classNo > 50) {
      return res.status(400).json({ error: 'INVALID_CLASS' });
    }
    if (!validEndpoint(endpoint) || !validPushKey(p256dh, 40, 256) || !validPushKey(auth, 8, 256)) {
      return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
    }

    const schoolRow = await resolveSchool(supabase, officeCode, schoolCode);

    const { error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .upsert({
        school_id: schoolRow.id,
        grade,
        class_number: classNo,
        endpoint,
        p256dh,
        auth,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 500),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'endpoint' });
    if (subscriptionError) throw subscriptionError;

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('push subscribe error', error);
    const message = String(error?.message || 'PUSH_SUBSCRIBE_FAILED');
    let status = 500;
    if (message.includes('NOT_CONFIGURED')) status = 503;
    else if (message === 'INVALID_SCHOOL') status = 400;
    else if (message === 'SCHOOL_VERIFICATION_FAILED') status = 502;
    return res.status(status).json({ error: message });
  }
}
