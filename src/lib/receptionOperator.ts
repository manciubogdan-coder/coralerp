// Recuperează operatorul unei recepții chiar și pentru recepțiile vechi,
// care nu au numele salvat în reception_report_data:
//   1. citește operatorul din breakdown-ul existent (recepții noi);
//   2. pentru cele fără operator, caută în reception_audit_log prima
//      înregistrare (userul care a atins recepția) și scrie numele înapoi.
import { decodePalDoc, encodePalDoc } from "./receptionBreakdown";

export interface OperatorRowInput {
  entryNumber?: number | null;
  inventoryId?: string | null;
  receptionId?: string | null;
}

export const inventoryTableFor = (inventoryType: string): string =>
  inventoryType === "ambalaje"
    ? "ambalaje_inventory"
    : inventoryType === "etichete"
      ? "etichete_inventory"
      : "inventory";

export const receptionTableFor = (inventoryType: string): string =>
  inventoryType === "ambalaje"
    ? "ambalaje_reception_records"
    : inventoryType === "etichete"
      ? "etichete_reception_records"
      : "reception_records";

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const hasOperatorText = (op?: { name?: string; email?: string } | null): boolean =>
  !!(op?.name?.trim() || op?.email?.trim());

/**
 * Întoarce Map<entryNumber, numeOperator> pentru rândurile cerute.
 * Scrie înapoi operatorul găsit din jurnal în reception_report_data,
 * ca raportul de Calitate să-l vadă și el de acum înainte.
 */
export async function resolveMissingOperators(
  supabase: any,
  inventoryType: string,
  rows: OperatorRowInput[],
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  const byEntry = new Map<number, OperatorRowInput>();
  rows.forEach((r) => {
    if (r.entryNumber == null) return;
    if (!byEntry.has(r.entryNumber)) byEntry.set(r.entryNumber, { ...r });
  });
  const entries = Array.from(byEntry.entries());
  if (entries.length === 0) return result;

  const invTable = inventoryTableFor(inventoryType);
  const recTable = receptionTableFor(inventoryType);

  // 1. completează inventoryId pornind de la entry_number
  const needInv = entries.filter(([, r]) => !r.inventoryId);
  for (const batch of chunk(needInv, 100)) {
    try {
      const { data } = await (supabase as any)
        .from(invTable)
        .select("id, entry_number")
        .in("entry_number", batch.map(([e]) => e));
      ((data as any[]) || []).forEach((row) => {
        const target = byEntry.get(row.entry_number);
        if (target && row.id) target.inventoryId = row.id;
      });
    } catch (e) {
      console.warn("resolveMissingOperators: inventory lookup failed", e);
    }
  }

  // 2. operatorul din breakdown-ul salvat (recepții noi)
  const profileName = new Map<string, string>();
  const withInv = entries.filter(([, r]) => !!r.inventoryId);
  const reportRows = new Map<string, any>();
  for (const batch of chunk(withInv, 50)) {
    try {
      const { data } = await (supabase as any)
        .from("reception_report_data")
        .select("inventory_id, paleti_lazi_document")
        .in("inventory_id", batch.map(([, r]) => r.inventoryId as string));
      ((data as any[]) || []).forEach((rr) => reportRows.set(rr.inventory_id, rr));
    } catch (e) {
      console.warn("resolveMissingOperators: report data lookup failed", e);
    }
  }
  // colectează operatorii salvați; unde avem doar email, îl rezolvăm la nume
  const emailOps = new Set<string>();
  const savedOps = new Map<number, { name: string; email: string }>();
  withInv.forEach(([entry, r]) => {
    const rep = r.inventoryId ? reportRows.get(r.inventoryId) : null;
    const op = decodePalDoc(rep?.paleti_lazi_document || "").breakdown.operator;
    const name = op?.name?.trim() || "";
    const email = op?.email?.trim() || "";
    if (!name && !email) return;
    savedOps.set(entry, { name, email });
    if (email && (!name || name.includes("@"))) emailOps.add(email);
    else if (name.includes("@")) emailOps.add(name);
  });
  if (emailOps.size > 0) {
    for (const batch of chunk(Array.from(emailOps), 50)) {
      try {
        const { data } = await (supabase as any)
          .from("app_profiles")
          .select("email, display_name, name")
          .in("email", batch);
        ((data as any[]) || []).forEach((p) => {
          const full = (p.display_name || p.name || "").trim();
          if (p.email && full) profileName.set(p.email, full);
        });
      } catch (e) {
        console.warn("resolveMissingOperators: profiles lookup failed", e);
      }
    }
  }
  savedOps.forEach((op, entry) => {
    const looksEmail = op.name.includes("@");
    const resolved = looksEmail ? profileName.get(op.name) : op.email ? profileName.get(op.email) : null;
    result.set(entry, resolved || (looksEmail ? "" : op.name) || op.email || op.name);
  });

  // 3. fallback: prima înregistrare din jurnalul de modificări
  const missing = entries.filter(([entry]) => !result.has(entry));
  if (missing.length === 0) return result;

  const needRec = missing.filter(([, r]) => !r.receptionId);
  for (const batch of chunk(needRec, 100)) {
    try {
      const { data } = await (supabase as any)
        .from(recTable)
        .select("id, entry_number")
        .in("entry_number", batch.map(([e]) => e));
      ((data as any[]) || []).forEach((row) => {
        const target = byEntry.get(row.entry_number);
        if (target && row.id) target.receptionId = row.id;
      });
    } catch (e) {
      console.warn("resolveMissingOperators: reception lookup failed", e);
    }
  }

  const withRec = missing.filter(([, r]) => !!r.receptionId);
  const auditEmail = new Map<string, string>();
  for (const batch of chunk(withRec, 50)) {
    try {
      const { data } = await (supabase as any)
        .from("reception_audit_log")
        .select("reception_id, user_email, created_at")
        .in("reception_id", batch.map(([, r]) => r.receptionId as string))
        .order("created_at", { ascending: true });
      ((data as any[]) || []).forEach((a) => {
        if (a.user_email && !auditEmail.has(a.reception_id)) {
          auditEmail.set(a.reception_id, a.user_email);
        }
      });
    } catch (e) {
      console.warn("resolveMissingOperators: audit lookup failed", e);
    }
  }

  // 3b. emailul din jurnal → numele și prenumele din profil (app_profiles)
  const emails = Array.from(new Set(Array.from(auditEmail.values()))).filter((e) => !profileName.has(e));
  for (const batch of chunk(emails, 50)) {
    try {
      const { data } = await (supabase as any)
        .from("app_profiles")
        .select("email, display_name, name")
        .in("email", batch);
      ((data as any[]) || []).forEach((p) => {
        const full = (p.display_name || p.name || "").trim();
        if (p.email && full) profileName.set(p.email, full);
      });
    } catch (e) {
      console.warn("resolveMissingOperators: profiles lookup failed", e);
    }
  }

  const backfills: Record<string, any>[] = [];
  withRec.forEach(([entry, r]) => {
    const email = r.receptionId ? auditEmail.get(r.receptionId) : null;
    if (!email) return;
    const fullName = profileName.get(email) || email;
    result.set(entry, fullName);
    if (!r.inventoryId) return;
    const rep = reportRows.get(r.inventoryId);
    const bd = decodePalDoc(rep?.paleti_lazi_document || "").breakdown;
    if (hasOperatorText(bd.operator)) return;
    bd.operator = { name: fullName, email };
    backfills.push({
      inventory_id: r.inventoryId,
      inventory_type: inventoryType,
      paleti_lazi_document: encodePalDoc(bd),
    });
  });

  for (const batch of chunk(backfills, 50)) {
    try {
      await (supabase as any)
        .from("reception_report_data")
        .upsert(batch, { onConflict: "inventory_id" });
    } catch (e) {
      console.warn("resolveMissingOperators: backfill upsert failed", e);
    }
  }

  return result;
}
