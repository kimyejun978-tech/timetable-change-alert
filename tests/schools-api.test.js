import assert from 'node:assert/strict';
import handler from '../api/schools.js';

function invoke({ method = 'GET', query = {} } = {}) {
  const result = { status: 200, headers: {}, payload: null };
  const req = { method, query };
  const res = {
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    status(code) { result.status = code; return this; },
    json(payload) { result.payload = payload; return this; },
  };
  const returned = handler(req, res);
  return Promise.resolve(returned).then(() => result);
}

const wrongMethod = await invoke({ method: 'POST' });
assert.equal(wrongMethod.status, 405);
assert.equal(wrongMethod.payload.error, 'METHOD_NOT_ALLOWED');

const tooShort = await invoke({ query: { q: '대' } });
assert.equal(tooShort.status, 400);
assert.equal(tooShort.payload.error, 'QUERY_TOO_SHORT');

const spacedTooShort = await invoke({ query: { q: '대     ' } });
assert.equal(spacedTooShort.status, 400);
assert.equal(spacedTooShort.payload.error, 'QUERY_TOO_SHORT');

const tooLong = await invoke({ query: { q: '가'.repeat(101) } });
assert.equal(tooLong.status, 400);
assert.equal(tooLong.payload.error, 'QUERY_TOO_LONG');

const originalFetch = globalThis.fetch;
let requestedSchoolName = '';
globalThis.fetch = async (url) => {
  const parsed = new URL(url);
  requestedSchoolName = parsed.searchParams.get('SCHUL_NM') || '';
  return {
    ok: true,
    async json() {
      return {
        schoolInfo: [
          { head: [] },
          { row: [{
            ATPT_OFCDC_SC_CODE: 'G10',
            SD_SCHUL_CODE: '1234567',
            SCHUL_NM: '대덕소프트웨어마이스터고등학교',
          }] },
        ],
      };
    },
  };
};

try {
  const spacedSearch = await invoke({ query: { q: '대덕 소프트웨어 마이스터고' } });
  assert.equal(spacedSearch.status, 200);
  assert.equal(requestedSchoolName, '대덕소프트웨어마이스터고');
  assert.equal(spacedSearch.payload.rows[0].SCHUL_NM, '대덕소프트웨어마이스터고등학교');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('OK: school search API input bounds and whitespace normalization');
