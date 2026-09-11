import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const CHANGE_WINDOW_MS = 5 * 60 * 1000;

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

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));
}

async function resolveRecentAuthorizedChange(supabase, { schoolId, userId, lessonId, requestedAction }) {
  const cutoff = new Date(Date.now() - CHANGE_WINDOW_MS).toISOString();
  let query = supabase
    .from('lesson_changes')
    .select('id,lesson_id,school_id,grade,class_number,period,change_type,changed_by,before_data,after_data,created_at')
    .eq('school_id', schoolId)
    .eq('changed_by', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1);

  if (requestedAction === 'delete') {
    query = query
      .eq('change_type', 'delete')
      .eq('before_data->>id', lessonId);
  } else {
    query = query
      .in('change_type', ['create', 'update'])
      .eq('lesson_id', lessonId);
  }

  const { data: change, error } = await query.maybeSingle();
  if (error) throw error;
  if (!change) return null;

  if (change.change_type !== 'delete') {
    const { data: lesson, error: lessonError } = await supabase
      .from('pe_lessons')
      .select('id,school_id')
      .eq('id', lessonId)
      .eq('school_id', schoolId)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return null;

    const { data: assignment, error: assignmentError } = await supabase
      .from('lesson_teachers')
      .select('lesson_id')
      .eq('lesson_id', lessonId)
      .eq('teacher_id', userId)
      .maybeSingle();
    if (assignmentError) throw assignmentError;
    if (!assignment) return null;
  }

  const snapshot = change.change_type === 'delete' ? change.before_data : change.after_data;
  return {
    changeId: change.id,
    action: change.change_type,
    grade: Number(change.grade),
    classNo: Number(change.class_number),
    period: Number(change.period || snapshot?.period || 0),
    activity: String(snapshot?.activity || '체육'),
    location: String(snapshot?.location || ''),
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
    const requestedAction = String(body.action || '');
    const lessonId = String(body.lessonId || '');
    if (!['create', 'update', 'delete'].includes(requestedAction)) {
      return res.status(400).json({ error: 'INVALID_ACTION' });
    }
    if (!validUuid(lessonId)) {
      return res.status(400).json({ error: 'INVALID_LESSON_ID' });
    }

    const change = await resolveRecentAuthorizedChange(supabase, {
      schoolId: teacher.school_id,
      userId: authData.user.id,
      lessonId,
      requestedAction,
    });
    if (!change) {
      return res.status(403).json({ error: 'PUSH_CHANGE_NOT_AUTHORIZED' });
    }

    const defaultTitles = {
      create: '체육 안내가 등록됐어요',
      update: '체육 안내가 변경됐어요',
      delete: '체육 안내가 취소됐어요',
    };
    const title = defaultTitles[change.action] || defaultTitles.update;
    const message = [
      `${change.grade}-${change.classNo}`,
      change.period ? `${change.period}교시` : '',
      change.activity,
      change.location,
    ].filter(Boolean).join(' · ').slice(0, 240);
    const url = './student.html';
    const tag = `oneul-pe-${change.grade}-${change.classNo}`;

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from('push_subscriptions')
      .select('endpoint,p256dh,auth')
      .eq('school_id', teacher.school_id)
      .eq('grade', change.grade)
      .eq('class_number', change.classNo);
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

    return res.status(200).json({
      ok: true,
      changeId: change.changeId,
      action: change.action,
      sent,
      stale,
      total: subscriptions?.length || 0,
    });
  } catch (error) {
    console.error('push send error', error);
    const message = String(error?.message || 'PUSH_SEND_FAILED');
    const status = message.includes('NOT_CONFIGURED') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
