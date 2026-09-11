export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const checks = {
    supabasePublic: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    supabaseServer: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
    vapid: Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
    neis: Boolean(process.env.NEIS_API_KEY),
  };

  const readyForCore = checks.supabasePublic && checks.supabaseServer;
  const readyForPush = readyForCore && checks.vapid;

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
