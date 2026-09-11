import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('PUSH_BACKEND_NOT_CONFIGURED');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';
  if (!publicKey || !privateKey) throw new Error('VAPID_NOT_CONFIGURED');
  webpush.setVapidDetails(subject, publicKey, privateKey);
}

function normalizeBody(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  try {
    configureVapid();
    const supabase = serverClient();
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'AUTH_REQUIRED' });

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) return res.status(401).json({ error: 'INVALID_TOKEN' });

    const { data: teacher, error: teacherError } = await supabase
      .from('teacher_profiles')
      .select('school_id,name,verified')
      .eq('auth_user_id', authData.user.id)
      .single();
    if (teacherError || !teacher?.verified) return res.status(403).json({ error: 'TEACHER_NOT_VERIFIED' });

    const body = normalizeBody(req);
    const grade = Number(body.grade);
    const classNo = Number(body.classNo);
    if (!Number.isInteger(grade) || grade < 1 || grade > 6 || !Number.isInteger(classNo) || classNo < 1 || classNo > 50) {
      return res.status(400).json({ error: 'INVALID_CLASS' });
    }

    const title = String(body.title || '오늘체육').slice(0, 80);
    const message = String(body.body || '체육수업 안내가 변경되었습니다.').slice(0, 240);
    const url = String(body.url || './student.html');
    const tag = String(body.tag || `oneul-pe-${grade}-${classNo}`).slice(0, 100);

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('school_id', teacher.school_id)
      .eq('grade', grade)
      .eq('class_number', classNo);
    if (subscriptionError) throw subscriptionError;

    const payload = JSON.stringify({ title, body: message, url, tag });
    let sent = 0;
    let stale = 0;

    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        }, payload, { TTL: 60 * 60 * 6 });
        sent += 1;
      } catch (error) {
        if ([404, 410].includes(Number(error?.statusCode))) {
          stale += 1;
          await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
          return;
        }
        console.warn('push delivery failed', error?.statusCode || error?.message || error);
      }
    }));

    return res.status(200).json({ ok: true, sent, stale, total: subscriptions?.length || 0 });
  } catch (error) {
    console.error('push send error', error);
    const message = String(error?.message || 'PUSH_SEND_FAILED');
    const status = message.includes('NOT_CONFIGURED') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
