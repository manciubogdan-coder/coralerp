import { supabase } from "@/integrations/supabase/client";

const CLOUD_URL = "https://yeniohmlmxhjzywqlidx.supabase.co";
const CLOUD_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InllbmlvaG1sbXhoanp5d3FsaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1NjM0ODgsImV4cCI6MjA5MzEzOTQ4OH0.8rNaYX5D5hk22o_bUqERO9ChJfQdJYkaKiD9UsRi1mE";

export const ARGUS_URL = `${CLOUD_URL}/functions/v1/argus`;

export async function argusHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  return {
    apikey: CLOUD_ANON,
    Authorization: `Bearer ${CLOUD_ANON}`,
    "x-app-token": data.session?.access_token ?? "",
  };
}

export async function argusFetch<T = any>(
  action: string,
  params: Record<string, string> = {},
  body?: unknown,
): Promise<T> {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetch(`${ARGUS_URL}?${qs}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(await argusHeaders()), "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Eroare ${res.status}`);
  return data as T;
}
