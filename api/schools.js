function compactSchool(row) {
  return {
    ATPT_OFCDC_SC_CODE: row.ATPT_OFCDC_SC_CODE,
    SD_SCHUL_CODE: row.SD_SCHUL_CODE,
    SCHUL_NM: row.SCHUL_NM,
    SCHUL_KND_SC_NM: row.SCHUL_KND_SC_NM || '',
    LCTN_SC_NM: row.LCTN_SC_NM || '',
    ORG_RDNMA: row.ORG_RDNMA || '',
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }

  const query = String(req.query.q || '').trim();
  if (query.length < 2) return res.status(400).json({ error: 'QUERY_TOO_SHORT' });

  const params = new URLSearchParams({
    Type: 'json',
    pIndex: '1',
    pSize: process.env.NEIS_API_KEY ? '30' : '5',
    SCHUL_NM: query,
  });
  if (process.env.NEIS_API_KEY) params.set('KEY', process.env.NEIS_API_KEY);

  try {
    const response = await fetch(`https://open.neis.go.kr/hub/schoolInfo?${params.toString()}`);
    if (!response.ok) throw new Error(`NEIS_HTTP_${response.status}`);
    const data = await response.json();
    const rows = data?.schoolInfo?.[1]?.row || [];

    res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=3600');
    return res.status(200).json({
      rows: rows.map(compactSchool),
      sampleLimited: !process.env.NEIS_API_KEY,
    });
  } catch (error) {
    console.error('school search failed', error);
    return res.status(502).json({ error: 'SCHOOL_SEARCH_FAILED' });
  }
}
