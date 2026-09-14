import assert from 'node:assert/strict';
import handler from '../api/health.js';

const ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'NEIS_API_KEY',
];

function withEnv(values, callback) {
  const previous = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(values)) {
    if (value != null) process.env[key] = String(value);
  }
  try {
    return callback();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

function invoke(method = 'GET') {
  const result = { status: 200, headers: {}, payload: null };
  const req = { method };
  const res = {
    setHeader(name, value) { result.headers[name.toLowerCase()] = value; },
    status(code) { result.status = code; return this; },
    json(payload) { result.payload = payload; return this; },
  };
  handler(req, res);
  return result;
}

const baseEnv = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'publishable-test-key',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-test-key',
  VAPID_PUBLIC_KEY: 'public-test-key',
  VAPID_PRIVATE_KEY: 'private-test-key',
};

withEnv({ ...baseEnv, VAPID_SUBJECT: 'mailto:admin@example.com' }, () => {
  const result = invoke();
  assert.equal(result.status, 200);
  assert.equal(result.payload.readyForCore, true);
  assert.equal(result.payload.readyForPush, true);
  assert.equal(result.payload.checks.vapidSubject, true);
});

withEnv(baseEnv, () => {
  const result = invoke();
  assert.equal(result.status, 200);
  assert.equal(result.payload.readyForPush, false);
  assert.equal(result.payload.checks.vapidSubject, false);
});

withEnv({ ...baseEnv, VAPID_SUBJECT: 'admin@example.com' }, () => {
  const result = invoke();
  assert.equal(result.status, 200);
  assert.equal(result.payload.readyForPush, false);
  assert.equal(result.payload.checks.vapidSubject, false);
});

withEnv({ ...baseEnv, VAPID_SUBJECT: 'https://example.com/push-contact' }, () => {
  const result = invoke();
  assert.equal(result.payload.readyForPush, true);
});

const methodResult = invoke('POST');
assert.equal(methodResult.status, 405);
assert.equal(methodResult.payload.error, 'METHOD_NOT_ALLOWED');

console.log('OK: health API readiness contract');
