import { EdgeFetchError } from "./edgeFetch";

type Session = { access_token: string; expires_at?: number };
type SessionResult = { data: { session: Session | null }; error: unknown };
type OperationalAuth = {
  getSession(): Promise<SessionResult>;
  refreshSession(): Promise<SessionResult>;
};

const SIGN_IN_REQUIRED = "Sesiunea a expirat. Autentifică-te din nou și reia cererea.";
const refreshes = new WeakMap<OperationalAuth, Promise<string>>();

function refreshToken(auth: OperationalAuth): Promise<string> {
  const pending = refreshes.get(auth);
  if (pending) return pending;
  const refresh = (async () => {
    const { data, error } = await auth.refreshSession();
    if (error || !data.session?.access_token) throw new Error(SIGN_IN_REQUIRED);
    return data.session.access_token;
  })();
  refreshes.set(auth, refresh);
  void refresh.finally(() => refreshes.delete(auth)).catch(() => {});
  return refresh;
}

/** Use the operational session, never the Cloud public key as the user's identity. */
export async function operationalToken(auth: OperationalAuth): Promise<string> {
  const { data, error } = await auth.getSession();
  if (error || !data.session?.access_token) throw new Error(SIGN_IN_REQUIRED);
  const session = data.session;
  if (session.expires_at !== undefined && session.expires_at * 1000 <= Date.now() + 60_000) {
    return refreshToken(auth);
  }
  return session.access_token;
}

/** A 401 is rejected before Argus executes the action; retry once with fresh authentication. */
export async function withOperationalSession<T>(auth: OperationalAuth, request: (token: string) => Promise<T>): Promise<T> {
  const token = await operationalToken(auth);
  try {
    return await request(token);
  } catch (error) {
    if (!(error instanceof EdgeFetchError) || error.status !== 401) throw error;
    const current = await operationalToken(auth);
    const fresh = current !== token ? current : await refreshToken(auth);
    return request(fresh);
  }
}

/** Keep successful stream/multipart responses untouched; only an authentication rejection is retried. */
export async function withOperationalResponse(auth: OperationalAuth, request: (token: string) => Promise<Response>): Promise<Response> {
  return withOperationalSession(auth, async token => {
    const response = await request(token);
    if (response.status === 401) {
      const body = await response.json().catch(() => null);
      throw new EdgeFetchError(body?.error || SIGN_IN_REQUIRED, 401);
    }
    return response;
  });
}