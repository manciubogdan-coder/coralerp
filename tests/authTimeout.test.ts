import { expect, test } from 'bun:test';
import { AUTH_CONNECTION_ERROR, AUTH_TIMEOUT_MS, withAuthTimeout } from '../src/lib/authTimeout';

test('account loading is limited to 20 seconds', () => {
  expect(AUTH_TIMEOUT_MS).toBe(20000);
});

test('a stalled account request rejects instead of leaving loading pending', async () => {
  await expect(withAuthTimeout(new Promise(() => {}), 5)).rejects.toThrow(AUTH_CONNECTION_ERROR);
});

test('working requests preserve their result and failed requests preserve their error', async () => {
  expect(await withAuthTimeout(Promise.resolve('ready'), 50)).toBe('ready');
  await expect(withAuthTimeout(Promise.reject(new Error('offline')), 50)).rejects.toThrow('offline');
});