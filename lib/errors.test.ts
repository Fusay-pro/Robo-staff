import { test } from 'node:test';
import assert from 'node:assert/strict';
import { errorMessage, errorStatus } from './errors.ts';

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
