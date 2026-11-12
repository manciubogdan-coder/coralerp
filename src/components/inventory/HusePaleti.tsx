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
  const [data, setData] = useState(today);
  const [functie, setFunctie] = useState(zona === "picking" ? "Picking" : "Magazioner");
  const [remorca, setRemorca] = useState("");
  const [client, setClient] = useState("");
  const [cursa, setCursa] = useState("");
  const [sofer, setSofer] = useState("");
  const [serie, setSerie] = useState("");
  const [poza, setPoza] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
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
    // Retururile nu se limitează: pot veni huse de la mai mulți / mai multe decât am dat.
    if (tip === "pierdere") {
      const p = all.persoane.find((x) => x.persoana.toLowerCase() === persoana.trim().toLowerCase());
      if (!p || q > p.afara) return toast.error(`${persoana} are doar ${p?.afara ?? 0} huse nereturnate`);
    }
    if (tip === "predare" && q > all.inDepozit) return toast.error(`În depozit sunt doar ${all.inDepozit} huse`);
    if (tip !== "intrare" && !remorca.trim()) return toast.error("Scrie numărul de înmatriculare al remorcii");
    if (tip === "predare" && (!client.trim() || !sofer.trim() || !destinatie.trim())) return toast.error("Completează clientul, firma de transport, șoferul și destinația");
    if (tip !== "intrare" && !poza) return toast.error(zona === "picking" ? "Atașează poza paletului încărcat" : "Atașează poza husei în remorcă");
    setBusy(true);
    let poza_path: string | null = null;
    if (poza) {
      poza_path = `${zona}/${Date.now()}-${poza.name.replace(/[^\w.-]/g, "_")}`;
      const up = await (supabaseCloud as any).storage.from("huse-poze").upload(poza_path, poza);
      if (up.error) { setBusy(false); return toast.error("Poza nu s-a încărcat: " + up.error.message); }
    }
    const now = new Date(); const occurred_at = data === today() ? now.toISOString() : new Date(data + "T12:00:00").toISOString();
    let email: string | null = null;
    try { const { supabase } = await import("@/integrations/supabase/client"); email = (await supabase.auth.getUser()).data.user?.email ?? null; } catch { /* ignore */ }
    const { error } = await (supabaseCloud as any).from("huse_paleti_miscari").insert({
      tip, cantitate: q, zona, persoana: persoana.trim() || null, destinatie: destinatie.trim() || null,
      document: document.trim() || null, observatii: obs.trim() || null, created_by_email: email, occurred_at,
      functie, nr_remorca: remorca.trim() || null, client: client.trim() || null, cursa: cursa.trim() || null, sofer: sofer.trim() || null, poza_path, serie_husa: serie.trim() || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Salvat");
    setCant(""); setDestinatie(""); setRemorca(""); setClient(""); setCursa(""); setSofer(""); setSerie(""); setPoza(null); setFileKey((k) => k + 1); setDocument(""); setObs("");
    load();
  };

  const remove = async (id?: string) => {
    if (!id || !confirm("Ștergi această înregistrare?")) return;
    const { error } = await (supabaseCloud as any).from("huse_paleti_miscari").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const openPoza = async (path: string) => {
    const { data: d, error } = await (supabaseCloud as any).storage.from("huse-poze").createSignedUrl(path, 600);
    if (error) return toast.error(error.message);
    window.open(d.signedUrl, "_blank");
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
      ["Data", "Tip", "Cantitate", "Zonă", "Recepționată/predată de", "Funcție", "Serie husă", "Nr. remorcă", "Client", "Cursă", "Șofer", "Poză", "Destinație", "Document", "Observații", "Introdus de"],
      ...period.map((r: any) => [fmt(r.occurred_at), TIP_LABEL[r.tip], r.cantitate, ZONA_LABEL[r.zona], r.persoana || "", r.functie || "", r.serie_husa || "", r.nr_remorca || "", r.client || "", r.cursa || "", r.sofer || "", r.poza_path ? "Da" : "Nu", r.destinatie || "", r.document || "", r.observatii || "", r.created_by_email || ""]),
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
          <div><div className="text-xs">Data</div><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div><div className="text-xs">Funcție</div><select className="h-10 w-full rounded-md border bg-background px-2" value={functie} onChange={(e) => setFunctie(e.target.value)}><option>Magazioner</option><option>Picking</option></select></div>
          <Input inputMode="numeric" placeholder="Număr huse" value={cant} onChange={(e) => setCant(e.target.value.replace(/\D/g, ""))} />
          {tip !== "intrare" && (
            <>
              <Input list="huse-persoane" placeholder="Recepționată / predată de (nume prenume)" value={persoana} onChange={(e) => setPersoana(e.target.value)} />
              <datalist id="huse-persoane">{persoaneCunoscute.map((p) => <option key={p} value={p} />)}</datalist>
            </>
          )}
          {tip !== "intrare" && <Input placeholder="Nr. înmatriculare remorcă" value={remorca} onChange={(e) => setRemorca(e.target.value.toUpperCase())} />}
          <Input placeholder="Serie husă" value={serie} onChange={(e) => setSerie(e.target.value.toUpperCase())} />
          {tip !== "intrare" && (
            <>
              <Input placeholder="Client" value={client} onChange={(e) => setClient(e.target.value)} />
              <Input placeholder="Destinație (unde merge)" value={destinatie} onChange={(e) => setDestinatie(e.target.value)} />
              <Input placeholder="Cursă (firma de transport)" value={cursa} onChange={(e) => setCursa(e.target.value)} />
              <Input placeholder="Nume șofer" value={sofer} onChange={(e) => setSofer(e.target.value)} />
            </>
          )}
          {tip !== "intrare" && (
            <div><div className="text-xs">{zona === "picking" ? "Poză la paletul încărcat" : "Poză la husa în remorcă"}</div>
              <Input key={fileKey} type="file" accept="image/*" capture="environment" onChange={(e) => setPoza(e.target.files?.[0] ?? null)} /></div>
          )}
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
            <thead><tr className="text-left border-b"><th className="py-1">Data</th><th>Tip</th><th>Cant.</th><th>Zonă</th><th>Persoană</th><th>Funcție</th><th>Serie</th><th>Remorcă</th><th>Client / destinație / cursă / șofer</th><th>Poză</th><th></th></tr></thead>
            <tbody>
              {period.map((r) => (
                <tr key={r.id} className="border-b">
                  <td className="py-1 whitespace-nowrap">{fmt(r.occurred_at)}</td><td>{TIP_LABEL[r.tip]}</td><td>{r.cantitate}</td>
                  <td>{ZONA_LABEL[r.zona]}</td><td>{r.persoana}</td><td>{(r as any).functie}</td><td>{(r as any).serie_husa}</td><td>{(r as any).nr_remorca}</td>
                  <td>{[(r as any).client, r.destinatie, (r as any).cursa, (r as any).sofer].filter(Boolean).join(" · ")}</td>
                  <td>{(r as any).poza_path && <Button size="sm" variant="link" onClick={() => openPoza((r as any).poza_path)}>Vezi</Button>}</td>
                  <td><Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
              {!period.length && <tr><td colSpan={11} className="py-3 text-center text-muted-foreground">Nicio mișcare în perioadă</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default HusePaleti;
