import { supabaseCloud } from "@/integrations/supabase/cloudClient";

export type GgnKind = "supplier" | "manufacturer";

export const ggnKey = (name?: string | null) =>
  (name || "").trim().toLowerCase().replace(/\s+/g, " ");

/** Returnează o hartă name_key -> cod GGN pentru un tip de partener + depozit. */
export const fetchGgnMap = async (
  kind: GgnKind,
  inventoryType: string
): Promise<Record<string, string>> => {
  const { data, error } = await (supabaseCloud as any)
    .from("ggn_codes")
    .select("name_key, ggn_code")
    .eq("kind", kind)
    .eq("inventory_type", inventoryType);

  if (error || !data) return {};
  const map: Record<string, string> = {};
  for (const row of data) {
    if (row.ggn_code) map[row.name_key] = row.ggn_code;
  }
  return map;
};

/** Caută codul GGN pentru un singur nume (folosit pe etichete). */
export const fetchGgnCode = async (
  kind: GgnKind,
  inventoryType: string,
  name?: string | null
): Promise<string | null> => {
  const key = ggnKey(name);
  if (!key) return null;
  const { data, error } = await (supabaseCloud as any)
    .from("ggn_codes")
    .select("ggn_code")
    .eq("kind", kind)
    .eq("inventory_type", inventoryType)
    .eq("name_key", key)
    .maybeSingle();
  if (error) return null;
  return data?.ggn_code || null;
};

/** Salvează (upsert) codul GGN pentru un partener. */
export const saveGgnCode = async (
  kind: GgnKind,
  inventoryType: string,
  name: string,
  code: string | null
) => {
  const key = ggnKey(name);
  if (!key) return;
  const { error } = await (supabaseCloud as any).from("ggn_codes").upsert(
    {
      kind,
      inventory_type: inventoryType,
      name_key: key,
      display_name: name,
      ggn_code: code && code.trim() ? code.trim() : null,
    },
    { onConflict: "kind,inventory_type,name_key" }
  );
  if (error) throw error;
};
