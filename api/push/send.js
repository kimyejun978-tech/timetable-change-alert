import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const CHANGE_WINDOW_MS = 5 * 60 * 1000;
const CLAIM_STALE_MS = 2 * 60 * 1000;

function serverClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('PUSH_BACKEND_NOT_CONFIGURED');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function validVapidSubject(value) {
  const subject = String(value || '').trim();
  return /^mailto:[^\s@]+@[^\s@]+$/i.test(subject) || /^https:\/\/[^\s]+$/i.test(subject);
}

function configureVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = String(process.env.VAPID_SUBJECT || '').trim();
  if (!publicKey || !privateKey || !validVapidSubject(subject)) {
    throw new Error('VAPID_NOT_CONFIGURED');
  }
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

function buildDeliveryTargets(change) {
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

function messageForTarget(changeType, target) {
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

async function resolveRecentAuthorizedChange(supabase, { schoolId, userId, lessonId, requestedAction }) {
  const cutoff = new Date(Date.now() - CHANGE_WINDOW_MS).toISOString();
  let query = supabase
    .from('lesson_changes')
    .select('id,lesson_id,school_id,grade,class_number,period,change_type,changed_by,before_data,after_data,created_at,push_claimed_at,push_sent_at')
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

  return change;
}

async function claimChange(supabase, changeId) {
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS).toISOString();
  const { data, error } = await supabase
    .from('lesson_changes')
    .update({ push_claimed_at: now })
    .eq('id', changeId)
    .is('push_sent_at', null)
    .or(`push_claimed_at.is.null,push_claimed_at.lt.${staleBefore}`)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.id);
}

async function releaseClaim(supabase, changeId) {
  const { error } = await supabase
    .from('lesson_changes')
    .update({ push_claimed_at: null })
    .eq('id', changeId)
    .is('push_sent_at', null);
  if (error) console.warn('push claim release failed', error.message || error);
}

async function markSent(supabase, changeId) {
  const { error } = await supabase
    .from('lesson_changes')
    .update({ push_claimed_at: null, push_sent_at: new Date().toISOString() })
    .eq('id', changeId);
  if (error) throw error;
}

async function subscriptionsForTarget(supabase, schoolId, target) {
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .eq('school_id', schoolId)
    .eq('grade', target.grade)
    .eq('class_number', target.classNo);
  if (error) throw error;
  return data || [];
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  let claimedChangeId = null;
  let supabase = null;

  try {
    configureVapid();
    supabase = serverClient();
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

    const claimed = await claimChange(supabase, change.id);
    if (!claimed) {
      return res.status(409).json({ error: 'PUSH_ALREADY_CLAIMED_OR_SENT' });
    }
    claimedChangeId = change.id;

    const targets = buildDeliveryTargets(change);
    if (!targets.length) throw new Error('PUSH_CHANGE_TARGET_INVALID');

    let sent = 0;
    let stale = 0;
    let failed = 0;
    let total = 0;

    for (const target of targets) {
      const subscriptions = await subscriptionsForTarget(supabase, teacher.school_id, target);
      total += subscriptions.length;
      const message = messageForTarget(change.change_type, target);
      const payload = JSON.stringify({
        title: message.title,
        body: message.body,
        url: './student.html',
        tag: `oneul-pe-${target.grade}-${target.classNo}`,
      });

      await Promise.all(subscriptions.map(async (subscription) => {
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
          failed += 1;
          console.warn('push delivery failed', error?.statusCode || error?.message || error);
        }
      }));
    }

    await markSent(supabase, change.id);
    claimedChangeId = null;

    return res.status(200).json({
      ok: true,
      changeId: change.id,
      action: change.change_type,
      targetCount: targets.length,
      sent,
      stale,
      failed,
      total,
    });
  } catch (error) {
    if (claimedChangeId && supabase) await releaseClaim(supabase, claimedChangeId);
    console.error('push send error', error);
    const message = String(error?.message || 'PUSH_SEND_FAILED');
    const status = message.includes('NOT_CONFIGURED') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
}
