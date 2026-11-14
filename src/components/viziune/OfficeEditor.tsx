import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import type { OfficeData } from "./useOfficeData";
import { ArrowDown, ArrowUp } from "lucide-react";
import { BUILDING_PLACES, normName, OFFICES, OFFICE_IDS, roomOrderOf, seniorLabel, type OfficeChoice, type OfficeConfig, type OfficeId } from "@/lib/viziune/officeState";
import { ROOM_PLACES } from "@/lib/viziune/officeLayout";

const CHOICE_LABEL: Record<string, string> = { ...Object.fromEntries(OFFICE_IDS.map((id) => [id, OFFICES[id].label])), none: "Fără birou (în hală / depozit)", hidden: "Ascuns — nu apare deloc" };
const sel = "h-8 w-full rounded-md border bg-background px-2 text-xs";

/** Lets an admin put every person in an office by hand and say whose each Senior account is; saved for everyone. */
export function OfficeEditor({ offices, open, onClose }: { offices: OfficeData; open: boolean; onClose: () => void }) {
  const [draft, setDraft] = useState<OfficeConfig>({ offices: {}, links: {}, order: [] });
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"oameni" | "senior" | "ordine">("oameni");
  const savedOrder = offices.config.order ?? [];
  useEffect(() => { if (open) setDraft({ offices: { ...offices.config.offices }, links: { ...offices.config.links }, order: [...savedOrder] }); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const changed = JSON.stringify({ ...draft, order: roomOrderOf(draft.order) }) !== JSON.stringify({ ...offices.config, order: roomOrderOf(savedOrder) });
  const order = roomOrderOf(draft.order) as OfficeId[];
  /** Swaps the office in place i with the one in place j (any two places, building or hall). */
  const swap = (i: number, j: number) => setDraft((d) => { const o = roomOrderOf(d.order); if (j < 0 || j >= o.length) return d; [o[i], o[j]] = [o[j], o[i]]; return { ...d, order: o }; });
  const putIn = (i: number, id: OfficeId) => swap(i, order.indexOf(id));
  const match = (s: string) => !q.trim() || normName(s).includes(normName(q));
  const appPeople = useMemo(() => offices.roster.filter((p) => p.appUserId), [offices.roster]);

  const setOffice = (key: string, v: string) => setDraft((d) => { const o = { ...d.offices }; if (v) o[key] = v as OfficeChoice; else delete o[key]; return { ...d, offices: o }; });
  const setLink = (id: number, v: string) => setDraft((d) => { const l = { ...d.links }; if (v === "__auto") delete l[String(id)]; else l[String(id)] = v; return { ...d, links: l }; });

  const save = async () => {
    try { await offices.save(draft); toast.success("Birourile au fost salvate pentru toți colegii."); onClose(); }
    catch (e) { toast.error(`Nu s-a salvat: ${(e as Error).message}`); }
  };
  const close = () => { if (changed && !window.confirm("Ai schimbări nesalvate la birouri. Renunți la ele?")) return; onClose(); };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-3 p-0">
        <DialogHeader className="border-b p-4 pb-3">
          <DialogTitle>Pune oamenii pe birouri</DialogTitle>
          <DialogDescription>Alege biroul fiecăruia. „Ghicit” lasă regula automată. Ce salvezi se vede la toți colegii din Viziune.</DialogDescription>
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button size="sm" variant={tab === "oameni" ? "default" : "outline"} onClick={() => setTab("oameni")}>Oameni ({offices.roster.length})</Button>
            <Button size="sm" variant={tab === "senior" ? "default" : "outline"} onClick={() => setTab("senior")}>Conturi Senior ({offices.seniorUsers.length})</Button>
            <Button size="sm" variant={tab === "ordine" ? "default" : "outline"} onClick={() => setTab("ordine")}>Ordinea birourilor</Button>
            {tab !== "ordine" && <Input className="h-8 w-56" placeholder="Caută nume, e-mail, cont…" value={q} onChange={(e) => setQ(e.target.value)} />}
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-4">
          {tab === "oameni" && <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-1">Persoană</th><th className="w-60 py-1">Birou</th></tr></thead><tbody>
            {offices.roster.filter((p) => match(`${p.name} ${p.email ?? ""} ${p.seniorAccounts.join(" ")}`)).map((p) => {
              const mergedAway = !p.appUserId && p.seniorIds.some((id) => draft.links[String(id)]);
              return (
                <tr key={p.key} className="border-t">
                  <td className="py-1.5 pr-2"><div className="font-semibold">{p.name}</div>
                    <div className="text-muted-foreground">{[p.email, p.seniorAccounts.length ? `Senior: ${p.seniorAccounts.join(", ")}` : p.appUserId ? "fără cont Senior" : "doar cont Senior"].filter(Boolean).join(" · ")}</div></td>
                  <td className="py-1.5">
                    {mergedAway ? <span className="text-muted-foreground">legat de un om din aplicație — urmează biroul lui</span> :
                    <select className={sel} value={draft.offices[p.key] ?? ""} onChange={(e) => setOffice(p.key, e.target.value)}>
                      <option value="">Ghicit: {p.guess ? OFFICES[p.guess].label : "fără birou"}</option>
                      {Object.entries(CHOICE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>}
                  </td>
                </tr>
              );
            })}
          </tbody></table>}
          {tab === "ordine" && <>
            <p className="mb-2 text-xs text-muted-foreground">Alege ce birou stă în fiecare cameră, sau mută-l cu săgețile. Birourile își schimbă locul între ele, inclusiv între clădirea de birouri și hală. „Stânga/dreapta” e privit din vederea „Toată fabrica”.</p>
            <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="w-8 py-1">#</th><th className="py-1">Camera</th><th className="w-52 py-1">Biroul</th><th className="w-20 py-1" /></tr></thead><tbody>
              {ROOM_PLACES.map((pl, i) => (
                <React.Fragment key={i}>
                  {(i === 0 || i === BUILDING_PLACES) && <tr><td colSpan={4} className="pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{i === 0 ? "Clădirea de birouri (lângă Picking)" : "Birourile din hală (colțul vestiarelor)"}</td></tr>}
                  <tr className="border-t">
                    <td className="py-1.5 font-semibold">{i + 1}</td>
                    <td className="py-1.5 pr-2">{pl.label}</td>
                    <td className="py-1.5"><select aria-label={`Biroul din camera ${i + 1}`} className={sel} value={order[i]} onChange={(e) => putIn(i, e.target.value as OfficeId)}>
                      {OFFICE_IDS.map((id) => <option key={id} value={id}>{OFFICES[id].label}</option>)}
                    </select></td>
                    <td className="py-1.5 text-right">
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Mută mai sus" disabled={i === 0} onClick={() => swap(i, i - 1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Mută mai jos" disabled={i === ROOM_PLACES.length - 1} onClick={() => swap(i, i + 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody></table>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => setDraft((d) => ({ ...d, order: [] }))}>Înapoi la ordinea inițială</Button>
          </>}
          {tab === "senior" && <>
            <p className="mb-2 text-xs text-muted-foreground">Spune al cui e fiecare cont din Senior, ca documentele lui să apară la omul potrivit. „Cont separat” îl lasă om de sine stătător (bun pentru conturile comune).</p>
            <table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-1">Cont Senior</th><th className="w-64 py-1">Al cui e</th></tr></thead><tbody>
              {offices.seniorUsers.filter((u) => match(`${u.username} ${u.name ?? ""} ${u.group ?? ""}`)).map((u) => {
                const auto = offices.roster.find((p) => p.appUserId && p.seniorIds.includes(u.id) && offices.config.links[String(u.id)] === undefined);
                return (
                  <tr key={u.id} className="border-t">
                    <td className="py-1.5 pr-2"><div className="font-semibold">{seniorLabel(u)}</div><div className="text-muted-foreground">grupa {u.group ?? "—"}{u.active ? "" : " · inactiv în Senior"}</div></td>
                    <td className="py-1.5"><select className={sel} value={draft.links[String(u.id)] ?? "__auto"} onChange={(e) => setLink(u.id, e.target.value)}>
                      <option value="__auto">Automat: {auto ? auto.name : "cont separat"}</option>
                      <option value="">Cont separat</option>
                      {appPeople.map((p) => <option key={p.appUserId!} value={p.appUserId!}>{p.name}{p.email ? ` (${p.email})` : ""}</option>)}
                    </select></td>
                  </tr>
                );
              })}
            </tbody></table>
          </>}
        </div>
        <DialogFooter className="border-t p-3">
          <Button variant="outline" onClick={close}>Renunță</Button>
          <Button onClick={save} disabled={!changed || offices.saving}>{offices.saving ? "Se salvează…" : "Salvează pentru toți"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
