import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage, errorStatus, errorKind, describeError, shouldToast } from './errors.ts';

const FALLBACK = 'Something went wrong';

test('prefers the reason the API gave', () => {
  const e = { response: { status: 400, data: { error: 'Too big: expected array to have <=50 items' } } };
  assert.equal(errorMessage(e, FALLBACK), 'Too big: expected array to have <=50 items');
});

test('falls back when the API sent no reason', () => {
  assert.equal(errorMessage({ response: { status: 500, data: {} } }, FALLBACK), FALLBACK);
  assert.equal(errorMessage({ response: { status: 502, data: null } }, FALLBACK), FALLBACK);
  assert.equal(errorMessage({ response: { status: 503, data: '<html>bad gateway</html>' } }, FALLBACK), FALLBACK);
});

test('a non-string error field is not rendered', () => {
  // An express/zod body could carry an object or array here; React would throw
  // on an object child, so the fallback has to win.
  assert.equal(errorMessage({ response: { data: { error: { message: 'nope' } } } }, FALLBACK), FALLBACK);
  assert.equal(errorMessage({ response: { data: { error: ['nope'] } } }, FALLBACK), FALLBACK);
  assert.equal(errorMessage({ response: { data: { error: '   ' } } }, FALLBACK), FALLBACK);
});

test('a request that never reached the API still says something', () => {
  // axios network error: no `response` at all. This is the tunnel being down,
  // which is the case that used to read as "no students".
  assert.equal(errorMessage({ message: 'Network Error' }, FALLBACK), FALLBACK);
  assert.equal(errorMessage(new Error('timeout of 0ms exceeded'), FALLBACK), FALLBACK);
  assert.equal(errorMessage(null, FALLBACK), FALLBACK);
  assert.equal(errorMessage(undefined, FALLBACK), FALLBACK);
});

test('a plain string error is used as-is', () => {
  assert.equal(errorMessage('Incorrect password', FALLBACK), 'Incorrect password');
});

test('the status is exposed for the caller that wants it', () => {
  assert.equal(errorStatus({ response: { status: 404 } }), 404);
  assert.equal(errorStatus({ message: 'Network Error' }), undefined);
});

// --- what kind of failure it was, for the toast host -------------------------
// The toast host has `t`; this module must not, so the classification is pure
// and the wrapper sentence is translated by the caller.

const T: Record<string, string> = {
  'errors.offline':   "Can't reach the server. Check your connection.",
  'errors.server':    'Something went wrong on the server',
  'errors.forbidden': "You don't have permission to do that",
};
const t = (k: string) => T[k] ?? k;

test('the server’s own sentence wins, whatever the status', () => {
  assert.deepEqual(errorKind({ response: { status: 400, data: { error: 'Incorrect password' } } }),
    { kind: 'reason', text: 'Incorrect password' });
  // A 403 that explains itself is better than our generic line for 403.
  assert.deepEqual(errorKind({ response: { status: 403, data: { error: 'Forbidden: not your branch' } } }),
    { kind: 'reason', text: 'Forbidden: not your branch' });
});

test('no response at all is an offline failure, not a server failure', () => {
  assert.deepEqual(errorKind({ message: 'Network Error' }), { kind: 'offline' });
  assert.deepEqual(errorKind(new Error('timeout of 0ms exceeded')), { kind: 'offline' });
});

test('a 5xx or an unreadable body is a server failure', () => {
  assert.deepEqual(errorKind({ response: { status: 500, data: {} } }), { kind: 'server' });
  assert.deepEqual(errorKind({ response: { status: 502, data: '<html>bad gateway</html>' } }), { kind: 'server' });
  assert.deepEqual(errorKind({ response: { status: 400, data: {} } }), { kind: 'server' });
});

test('a silent 403 gets the permission sentence', () => {
  assert.deepEqual(errorKind({ response: { status: 403, data: {} } }), { kind: 'forbidden' });
});

test('describeError turns any of them into one sentence', () => {
  assert.equal(describeError({ response: { status: 400, data: { error: 'Too big' } } }, t), 'Too big');
  assert.equal(describeError({ message: 'Network Error' }, t), "Can't reach the server. Check your connection.");
  assert.equal(describeError({ response: { status: 500, data: {} } }, t), 'Something went wrong on the server');
  assert.equal(describeError({ response: { status: 403, data: {} } }, t), "You don't have permission to do that");
});

test('401s never raise a toast: the client handles expiry by refreshing', () => {
  assert.equal(shouldToast({ response: { status: 401, data: { error: 'Invalid or expired token' } } }), false);
  assert.equal(shouldToast({ response: { status: 400, data: { error: 'Too big' } } }), true);
});

test('the refresh call itself never raises a toast', () => {
  assert.equal(shouldToast({ response: { status: 429 }, config: { url: '/auth/refresh' } }), false);
  assert.equal(shouldToast({ response: { status: 429 }, config: { url: 'https://api.example.com/auth/refresh' } }), false);
  assert.equal(shouldToast({ response: { status: 429 }, config: { url: '/students' } }), true);
});

test('a request the app cancelled is not a failure to report', () => {
  assert.equal(shouldToast({ code: 'ERR_CANCELED', message: 'canceled' }), false);
});
