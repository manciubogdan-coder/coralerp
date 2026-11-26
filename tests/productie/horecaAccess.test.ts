import { expect, test } from 'bun:test';
import { canReadHorecaGroups, requireHorecaReader } from '../../supabase/functions/_shared/horecaAccess';
test('approved production, operator and admin readers retain access', () => {
  for (const role of ['productie', 'operator', 'admin']) expect(canReadHorecaGroups(true, [role])).toBe(true);
});
test('unapproved and unrelated users cannot read HoReCa settings', () => {
  expect(canReadHorecaGroups(false, ['admin'])).toBe(false);
  expect(canReadHorecaGroups(true, ['achizitii'])).toBe(false);
  expect(canReadHorecaGroups(true, [])).toBe(false);
});
test('anonymous and invalid sessions are denied before reading settings', async () => {
  let calls = 0;
  const request = (async () => { calls++; return new Response('{}', { status: 401 }); }) as typeof fetch;
  expect(await requireHorecaReader(null, 'https://example.invalid', 'public', request)).toMatchObject({ status: 401 });
  expect(calls).toBe(0);
  expect(await requireHorecaReader('invalid', 'https://example.invalid', 'public', request)).toMatchObject({ status: 401 });
});
test('server approval and stored roles are required even for a valid session', async () => {
  const request = (async (input: any) => new Response(JSON.stringify(String(input).includes('/auth/') ? { id: 'user' } : String(input).includes('app_profiles') ? [{ approved: false }] : [{ role: 'admin' }]), { status: 200 })) as typeof fetch;
  expect(await requireHorecaReader('session', 'https://example.invalid', 'public', request)).toMatchObject({ status: 403 });
});