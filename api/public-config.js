function js(value) {
  return JSON.stringify(value || '');
}

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('/* METHOD_NOT_ALLOWED */');
  }

  const payload = `window.ONEUL_PE_CONFIG = Object.assign({}, window.ONEUL_PE_CONFIG || {}, {\n  SUPABASE_URL: ${js(process.env.SUPABASE_URL)},\n  SUPABASE_ANON_KEY: ${js(process.env.SUPABASE_ANON_KEY)},\n  VAPID_PUBLIC_KEY: ${js(process.env.VAPID_PUBLIC_KEY)},\n  NEIS_API_KEY: ''\n});\n`;

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(200).send(payload);
}
