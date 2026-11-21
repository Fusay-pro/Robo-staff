import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import axios, { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import client, { refreshAccessToken } from './api.ts';
import { onToast } from './toastBus.ts';

const originalAdapter = axios.defaults.adapter;
const originalClientAdapter = client.defaults.adapter;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
let location: { href: string };

function response(config: InternalAxiosRequestConfig, data: unknown = {}, status = 200) {
  return { config, data, status, statusText: String(status), headers: {} };
}

function rejectResponse(config: InternalAxiosRequestConfig, status: number): never {
  throw new AxiosError('Request failed', AxiosError.ERR_BAD_RESPONSE, config, undefined,
    response(config, { error: 'Request failed' }, status));
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  const values = new Map<string, string>([
    ['access_token', 'expired-access'], ['refresh_token', 'original-refresh'],
  ]);
  location = { href: '/students' };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location } });
});

afterEach(() => {
  axios.defaults.adapter = originalAdapter;
  client.defaults.adapter = originalClientAdapter;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else Reflect.deleteProperty(globalThis, 'localStorage');
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
  else Reflect.deleteProperty(globalThis, 'window');
});

test('simultaneous expired student and alert requests share one token refresh', async () => {
  let refreshCalls = 0;
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) {
      const requestNumber = ++refreshCalls;
      await new Promise(resolve => setTimeout(resolve, 10));
      if (requestNumber > 1) return rejectResponse(config, 401);
      return response(config, { access_token: 'renewed-access', refresh_token: 'rotated-refresh' });
    }
    if (config.headers.Authorization !== 'Bearer renewed-access') return rejectResponse(config, 401);
    return response(config, { ok: true });
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  const results = await Promise.allSettled([
    client.get('/students'), client.get('/students/stats'), client.get('/schedules/alerts'),
  ]);

  assert.deepEqual(results.map(result => result.status), ['fulfilled', 'fulfilled', 'fulfilled']);
  assert.equal(refreshCalls, 1);
  assert.equal(localStorage.getItem('refresh_token'), 'rotated-refresh');
  assert.equal(location.href, '/students');
});

test('a late 401 uses the renewed access token instead of rotating again', async () => {
  let refreshCalls = 0;
  const releaseLateResponse = deferred();
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) {
      refreshCalls++;
      return response(config, { access_token: 'renewed-access', refresh_token: 'rotated-refresh' });
    }
    if (config.headers.Authorization === 'Bearer renewed-access') return response(config);
    if (config.url === '/schedules/alerts') await releaseLateResponse.promise;
    return rejectResponse(config, 401);
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  const students = client.get('/students');
  const alerts = client.get('/schedules/alerts');
  await students;
  releaseLateResponse.resolve();
  await alerts;

  assert.equal(refreshCalls, 1);
  assert.equal(location.href, '/students');
});

test('session restoration and an expired query share the same renewal', async () => {
  let refreshCalls = 0;
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) {
      refreshCalls++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return response(config, { access_token: 'renewed-access', refresh_token: 'rotated-refresh' });
    }
    if (config.headers.Authorization !== 'Bearer renewed-access') return rejectResponse(config, 401);
    return response(config);
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  await Promise.all([refreshAccessToken(), client.get('/students')]);

  assert.equal(refreshCalls, 1);
  assert.equal(location.href, '/students');
});

for (const failure of ['network', 503] as const) {
  test(`a temporary ${failure} refresh failure keeps the session and does not reload`, async () => {
    const adapter: AxiosAdapter = async config => {
      if (config.url?.endsWith('/auth/refresh')) {
        if (failure === 'network') throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
        return rejectResponse(config, failure);
      }
      return rejectResponse(config, 401);
    };
    axios.defaults.adapter = client.defaults.adapter = adapter;

    await assert.rejects(client.get('/students'));

    assert.equal(localStorage.getItem('access_token'), 'expired-access');
    assert.equal(localStorage.getItem('refresh_token'), 'original-refresh');
    assert.equal(location.href, '/students');
  });
}

test('an invalid refresh token clears the session and requires login', async () => {
  axios.defaults.adapter = client.defaults.adapter = async config => rejectResponse(config, 401);

  await assert.rejects(client.get('/students'));

  assert.equal(localStorage.getItem('access_token'), null);
  assert.equal(localStorage.getItem('refresh_token'), null);
  assert.equal(location.href, '/login');
});

test('a failed renewal can be retried when the connection recovers', async () => {
  let offline = true;
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) {
      if (offline) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
      return response(config, { access_token: 'renewed-access', refresh_token: 'rotated-refresh' });
    }
    if (config.headers.Authorization !== 'Bearer renewed-access') return rejectResponse(config, 401);
    return response(config);
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  await assert.rejects(client.get('/students'));
  offline = false;
  await client.get('/students');

  assert.equal(localStorage.getItem('access_token'), 'renewed-access');
  assert.equal(location.href, '/students');
});

test('a renewed token rejected again requires login without looping', async () => {
  let refreshCalls = 0;
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) {
      refreshCalls++;
      return response(config, { access_token: 'renewed-access', refresh_token: 'rotated-refresh' });
    }
    return rejectResponse(config, 401);
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  await assert.rejects(client.get('/students'));

  assert.equal(refreshCalls, 1);
  assert.equal(localStorage.getItem('access_token'), null);
  assert.equal(location.href, '/login');
});

test('an incorrect delete password stays in the confirmation flow', async () => {
  let refreshCalls = 0;
  axios.defaults.adapter = async config => { refreshCalls++; return response(config); };
  client.defaults.adapter = async config => rejectResponse(config, 403);

  await assert.rejects(client.post('/students/bulk-delete', { password: 'incorrect', student_ids: [1, 2, 3] }));

  assert.equal(refreshCalls, 0);
  assert.equal(localStorage.getItem('access_token'), 'expired-access');
  assert.equal(location.href, '/students');
});

test('a renewal that fails on a dead connection still says so', async () => {
  // The throw from a failed renewal leaves the interceptor before its toast
  // line, so without this the one failure the user most needs to hear about —
  // the tunnel being down — was the one that said nothing.
  const heard: string[] = [];
  const stop = onToast(request => {
    heard.push('error' in request ? request.error.kind : 'text');
  });
  const adapter: AxiosAdapter = async config => {
    if (config.url?.endsWith('/auth/refresh')) throw new AxiosError('Network Error', AxiosError.ERR_NETWORK, config);
    return rejectResponse(config, 401);
  };
  axios.defaults.adapter = client.defaults.adapter = adapter;

  await assert.rejects(client.get('/students'));
  stop();

  assert.deepEqual(heard, ['offline']);
  // The session survives a connection failure, as before.
  assert.equal(localStorage.getItem('refresh_token'), 'original-refresh');
  assert.equal(location.href, '/students');
});

test('a renewal refused with 401 stays silent: the login redirect is the message', async () => {
  const heard: string[] = [];
  const stop = onToast(() => { heard.push('toast'); });
  axios.defaults.adapter = client.defaults.adapter = async config => rejectResponse(config, 401);

  await assert.rejects(client.get('/students'));
  stop();

  assert.deepEqual(heard, []);
  assert.equal(location.href, '/login');
});
