import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, Download } from "lucide-react";
import { husaBalance, HusaMiscare, HusaTip, HusaZona, TIP_LABEL, ZONA_LABEL } from "@/lib/huse";

const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });
const fmt = (s: string) => new Date(s).toLocaleString("ro-RO", { timeZone: "Europe/Bucharest", dateStyle: "short", timeStyle: "short" });

async function fetchAll(): Promise<HusaMiscare[]> {
  const all: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supabaseCloud as any).from("huse_paleti_miscari").select("*").order("occurred_at", { ascending: false }).range(from, from + 999);
    if (error) throw error;
    all.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return all;
}

export function HusePaleti({ zona }: { zona: HusaZona }) {
  const [rows, setRows] = useState<HusaMiscare[]>([]);
  const [tip, setTip] = useState<HusaTip>("predare");
  const [cant, setCant] = useState("");
  const [persoana, setPersoana] = useState("");
  const [destinatie, setDestinatie] = useState("");
  const [document, setDocument] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);
  const [from, setFrom] = useState(() => today().slice(0, 8) + "01");
  const [to, setTo] = useState(today);

  const load = () => fetchAll().then(setRows).catch((e) => toast.error(e.message));
  useEffect(() => { load(); }, []);

  const all = useMemo(() => husaBalance(rows), [rows]);
  const period = useMemo(() => rows.filter((r) => { const d = new Date(r.occurred_at).toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" }); return d >= from && d <= to; }), [rows, from, to]);
  const pb = useMemo(() => husaBalance(period), [period]);
  const persoaneCunoscute = useMemo(() => [...new Set(rows.map((r) => r.persoana).filter(Boolean))] as string[], [rows]);

  const save = async () => {
    const q = parseInt(cant, 10);
    if (!q || q <= 0) return toast.error("Introdu o cantitate validă");
    if (tip !== "intrare" && !persoana.trim()) return toast.error("Scrie cui ai dat / de la cine vin husele");
    if ((tip === "retur" || tip === "pierdere")) {
      const p = all.persoane.find((x) => x.persoana.toLowerCase() === persoana.trim().toLowerCase());
      if (!p || q > p.afara) return toast.error(`${persoana} are doar ${p?.afara ?? 0} huse nereturnate`);
    }
    if (tip === "predare" && q > all.inDepozit) return toast.error(`În depozit sunt doar ${all.inDepozit} huse`);
    setBusy(true);
    let email: string | null = null;
    try { const { supabase } = await import("@/integrations/supabase/client"); email = (await supabase.auth.getUser()).data.user?.email ?? null; } catch { /* ignore */ }
    const { error } = await (supabaseCloud as any).from("huse_paleti_miscari").insert({
      tip, cantitate: q, zona, persoana: persoana.trim() || null, destinatie: destinatie.trim() || null,
      document: document.trim() || null, observatii: obs.trim() || null, created_by_email: email,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Salvat");
    setCant(""); setDestinatie(""); setDocument(""); setObs("");
    load();
  };

  const remove = async (id?: string) => {
    if (!id || !confirm("Ștergi această înregistrare?")) return;
    const { error } = await (supabaseCloud as any).from("huse_paleti_miscari").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const sumar = [
      ["Raport huse paleți", `${from} – ${to}`], [],
      ["Indicator", "În perioadă", "Situație la zi"],
      ["Intrate în gestiune", pb.intrate, all.intrate],
      ["Plecate (predate)", pb.predate, all.predate],
      ["Întoarse", pb.returnate, all.returnate],
      ["Pierdute / casate", pb.pierdute, all.pierdute],
      ["În depozit", "", all.inDepozit],
      ["Încă afară (nereturnate)", "", all.afara],
      ["Stoc total", "", all.total],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sumar), "Sumar");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Persoană", "Predate", "Returnate", "Pierdute", "Încă afară", "Ultima predare"],
      ...all.persoane.map((p) => [p.persoana, p.predate, p.returnate, p.pierdute, p.afara, p.ultima ? fmt(p.ultima) : ""]),
    ]), "La cine sunt");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Data", "Tip", "Cantitate", "Zonă", "Persoană", "Destinație", "Document", "Observații", "Introdus de"],
      ...period.map((r) => [fmt(r.occurred_at), TIP_LABEL[r.tip], r.cantitate, ZONA_LABEL[r.zona], r.persoana || "", r.destinatie || "", r.document || "", r.observatii || "", r.created_by_email || ""]),
    ]), "Mișcări");
    XLSX.writeFile(wb, `Huse_paleti_${from}_${to}.xlsx`);
  };

  const Stat = ({ l, v, c = "" }: { l: string; v: number; c?: string }) => (
    <Card className="p-3"><div className="text-xs text-muted-foreground">{l}</div><div className={`text-2xl font-bold ${c}`}>{v}</div></Card>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Stat l="Stoc total" v={all.total} />
        <Stat l="În depozit" v={all.inDepozit} c="text-primary" />
        <Stat l="Afară (de cerut înapoi)" v={all.afara} c="text-destructive" />
        <Stat l="Pierdute" v={all.pierdute} />
      </div>

      <Card className="p-3 space-y-2">
        <div className="font-medium">Înregistrează mișcare huse</div>
        <div className="flex flex-wrap gap-1">
          {(["predare", "retur", "intrare", "pierdere"] as HusaTip[]).map((t) => (
            <Button key={t} size="sm" variant={tip === t ? "default" : "outline"} onClick={() => setTip(t)}>{TIP_LABEL[t]}</Button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Input inputMode="numeric" placeholder="Număr huse" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} />
          {tip !== "intrare" && (
            <>
              <Input list="huse-persoane" placeholder={tip === "predare" ? "Cui le dai (șofer / coleg)" : "De la cine vin"} value={persoana} onChange={(e) => setPersoana(e.target.value)} />
              <datalist id="huse-persoane">{persoaneCunoscute.map((p) => <option key={p} value={p} />)}</datalist>
            </>
          )}
          {tip === "predare" && <Input placeholder="Unde pleacă (client / cursă)" value={destinatie} onChange={(e) => setDestinatie(e.target.value)} />}
          <Input placeholder="Document (opțional)" value={document} onChange={(e) => setDocument(e.target.value)} />
          <Input placeholder="Observații" value={obs} onChange={(e) => setObs(e.target.value)} />
        </div>
        <Button onClick={save} disabled={busy}>Salvează</Button>
      </Card>

      {all.persoane.some((p) => p.afara > 0) && (
        <Card className="p-3">
          <div className="font-medium mb-2">De cerut înapoi</div>
          <div className="space-y-1 text-sm">
            {all.persoane.filter((p) => p.afara > 0).map((p) => (
              <div key={p.persoana} className="flex justify-between border-b py-1">
                <span>{p.persoana} <span className="text-muted-foreground text-xs">{p.ultima ? `· din ${fmt(p.ultima)}` : ""}</span></span>
                <b className="text-destructive">{p.afara}</b>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div><div className="text-xs">De la</div><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><div className="text-xs">Până la</div><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
        </div>
        <div className="text-sm text-muted-foreground">În perioadă: plecate {pb.predate} · întoarse {pb.returnate} · intrate {pb.intrate} · pierdute {pb.pierdute}</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th className="py-1">Data</th><th>Tip</th><th>Cant.</th><th>Zonă</th><th>Persoană</th><th>Destinație</th><th>Doc.</th><th></th></tr></thead>
            <tbody>
              {period.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 whitespace-nowrap">{fmt(r.occurred_at)}</td><td>{TIP_LABEL[r.tip]}</td><td>{r.cantitate}</td>
                  <td>{ZONA_LABEL[r.zona]}</td><td>{r.persoana}</td><td>{r.destinatie}</td><td>{r.document}</td>
                  <td><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              {!period.length && <tr><td colSpan={8} className="py-3 text-center text-muted-foreground">Nicio mișcare în perioadă</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default HusePaleti;
