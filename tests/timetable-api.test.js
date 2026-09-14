import assert from 'node:assert/strict';
import handler from '../api/timetable.js';

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

const missingName = await invoke({ query: { date: '20260914' } });
assert.equal(missingName.status, 400);
assert.equal(missingName.payload.error, 'INVALID_SCHOOL_NAME');

const hugeName = await invoke({
  query: { schoolName: '가'.repeat(101), date: '20260914' },
});
assert.equal(hugeName.status, 400);
assert.equal(hugeName.payload.error, 'INVALID_SCHOOL_NAME');

for (const invalidDate of ['20261301', '20260230', '2026091', 'abcdefgh']) {
  const result = await invoke({
    query: { schoolName: '테스트고등학교', date: invalidDate },
  });
  assert.equal(result.status, 400, invalidDate);
  assert.equal(result.payload.error, 'INVALID_DATE', invalidDate);
}

const hugeRegion = await invoke({
  query: {
    schoolName: '테스트고등학교',
    region: '가'.repeat(61),
    date: '20260914',
  },
});
assert.equal(hugeRegion.status, 400);
assert.equal(hugeRegion.payload.error, 'INVALID_REGION');

console.log('OK: timetable API input validation');
