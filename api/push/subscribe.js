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
    return url.protocol === 'https:';
  } catch {
    return false;
  }
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
      if (!validEndpoint(endpoint)) return res.status(400).json({ error: 'INVALID_ENDPOINT' });
      const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
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

    if (!school.officeCode || !school.schoolCode || !school.name) {
      return res.status(400).json({ error: 'INVALID_SCHOOL' });
    }
    if (!Number.isInteger(grade) || grade < 1 || grade > 6 || !Number.isInteger(classNo) || classNo < 1 || classNo > 50) {
      return res.status(400).json({ error: 'INVALID_CLASS' });
    }
    if (!validEndpoint(endpoint) || p256dh.length < 20 || auth.length < 8) {
      return res.status(400).json({ error: 'INVALID_SUBSCRIPTION' });
    }

    const { data: schoolRow, error: schoolError } = await supabase
      .from('schools')
      .upsert({
        neis_office_code: String(school.officeCode),
        neis_school_code: String(school.schoolCode),
        name: String(school.name),
        region: String(school.region || ''),
        address: String(school.address || ''),
      }, { onConflict: 'neis_office_code,neis_school_code' })
      .select('id')
      .single();
    if (schoolError) throw schoolError;

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
    const status = String(error?.message || '').includes('NOT_CONFIGURED') ? 503 : 500;
    return res.status(status).json({ error: error?.message || 'PUSH_SUBSCRIBE_FAILED' });
  }
}
