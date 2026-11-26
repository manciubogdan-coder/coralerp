export const canReadHorecaGroups = (approved: boolean, roles: string[]) =>
  approved && roles.some(role => ['admin', 'productie', 'operator'].includes(role));

export async function requireHorecaReader(token: string | null, legacyUrl: string, publicKey: string, request = fetch) {
  if (!token) return { error: 'Autentificare necesară.', status: 401 } as const;
  const headers = { apikey: publicKey, Authorization: `Bearer ${token}` };
  const response = await request(`${legacyUrl}/auth/v1/user`, { headers });
  if (!response.ok) return { error: 'Sesiune invalidă. Reautentifică-te.', status: 401 } as const;
  const user = await response.json();
  if (typeof user?.id !== 'string' || !user.id) return { error: 'Sesiune invalidă.', status: 401 } as const;
  const id = encodeURIComponent(user.id);
  const [profileResponse, roleResponse] = await Promise.all([
    request(`${legacyUrl}/rest/v1/app_profiles?select=approved&user_id=eq.${id}`, { headers }),
    request(`${legacyUrl}/rest/v1/app_user_roles?select=role&user_id=eq.${id}`, { headers }),
  ]);
  const profiles = profileResponse.ok ? await profileResponse.json() : [];
  const roles = roleResponse.ok ? await roleResponse.json() : [];
  if (!canReadHorecaGroups(profiles[0]?.approved === true, roles.map((row: { role: string }) => row.role)))
    return { error: 'Acces rezervat echipei Producție și administratorilor.', status: 403 } as const;
  return { user: { id: user.id as string, email: String(user.email ?? '') } } as const;
}