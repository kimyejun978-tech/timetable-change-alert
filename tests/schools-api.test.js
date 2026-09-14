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

const tooLong = await invoke({ query: { q: '가'.repeat(101) } });
assert.equal(tooLong.status, 400);
assert.equal(tooLong.payload.error, 'QUERY_TOO_LONG');

console.log('OK: school search API input bounds');
