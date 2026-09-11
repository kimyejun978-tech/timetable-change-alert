import fs from 'node:fs';
import path from 'node:path';

function hasBrowserSupabaseFallback() {
  try {
    const source = fs.readFileSync(path.join(process.cwd(), 'today-pe', 'config.js'), 'utf8');
    const hasUrl = /SUPABASE_URL:\s*['"]https:\/\/[^'"]+['"]/.test(source);
    const hasKey = /SUPABASE_ANON_KEY:\s*['"][^'"]+['"]/.test(source);
    return hasUrl && hasKey;
  } catch {
    return false;
  }
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const supabasePublicEnv = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY);
  const supabasePublicFallback = hasBrowserSupabaseFallback();
  const checks = {
    supabasePublic: supabasePublicEnv || supabasePublicFallback,
    supabasePublicEnv,
    supabasePublicFallback,
    supabaseServer: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapid: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    neis: Boolean(process.env.NEIS_API_KEY),
  };

  // 수업 조회/교사 Auth/등록은 브라우저 publishable key + RLS/RPC만으로 동작한다.
  // service_role은 Push 구독 저장/발송 같은 서버 전용 기능에만 필요하다.
  const readyForCore = checks.supabasePublic;
  const readyForPush = checks.supabasePublic && checks.supabaseServer && checks.vapid;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    service: 'oneul-pe',
    ok: true,
    readyForCore,
    readyForPush,
    checks,
    now: new Date().toISOString(),
  });
}
