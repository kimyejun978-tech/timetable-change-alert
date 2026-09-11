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

function validClass(grade, classNo) {
  return Number.isInteger(grade) && grade >= 1 && grade <= 6
    && Number.isInteger(classNo) && classNo >= 1 && classNo <= 50;
}

async function resolveDeletedLesson(supabase, teacherSchoolId, lessonId) {
  if (!lessonId) return null;

  const { data: existing } = await supabase
    .from('pe_lessons')
    .select('id,school_id,grade,class_number,period,activity,location')
    .eq('id', lessonId)
    .eq('school_id', teacherSchoolId)
    .maybeSingle();
  if (existing) return existing;

  const { data: history, error } = await supabase
    .from('lesson_changes')
    .select('school_id,grade,class_number,period,before_data,created_at')
    .eq('school_id', teacherSchoolId)
    .eq('change_type', 'delete')
    .eq('before_data->>id', lessonId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!history) return null;

  return {
    school_id: history.school_id,
    grade: history.grade,
    class_number: history.class_number,
    period: history.period,
    activity: history.before_data?.activity || '체육',
    location: history.before_data?.location || '',
  };
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
    const action = ['create', 'update', 'delete'].includes(body.action) ? body.action : 'update';
    let grade = Number(body.grade);
    let classNo = Number(body.classNo);
    let period = Number(body.period || 0);
    let activity = String(body.activity || '체육');
    let location = String(body.location || '');

    if (!validClass(grade, classNo) && body.lessonId) {
      const lesson = await resolveDeletedLesson(supabase, teacher.school_id, String(body.lessonId));
      if (lesson) {
        grade = Number(lesson.grade);
        classNo = Number(lesson.class_number);
        period = Number(lesson.period || 0);
        activity = String(lesson.activity || '체육');
        location = String(lesson.location || '');
      }
    }

    if (!validClass(grade, classNo)) {
      return res.status(400).json({ error: 'INVALID_CLASS' });
    }

    const defaultTitles = {
      create: '체육 안내가 등록됐어요',
      update: '체육 안내가 변경됐어요',
      delete: '체육 안내가 취소됐어요',
    };
    const generatedBody = [
      `${grade}-${classNo}`,
      period ? `${period}교시` : '',
      activity,
      location,
    ].filter(Boolean).join(' · ');
    const title = String(body.title || defaultTitles[action]).slice(0, 80);
    const message = String(body.body || generatedBody || '체육수업 안내가 변경되었습니다.').slice(0, 240);
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
