import { useEffect, useMemo, useState } from "react";
import { Edit2, Loader2, PackageOpen, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { argusFetch } from "@/lib/argusApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Method = {
  id: string;
  client_name: string;
  client_order: number;
  subgroup: string | null;
  product_name: string;
  weight: string;
  primary_packaging: string;
  tertiary_packaging: string;
  units_per_case: string;
  position: number;
};

type FormState = Omit<Method, "id">;
const emptyForm: FormState = { client_name: "", client_order: 0, subgroup: null, product_name: "", weight: "", primary_packaging: "", tertiary_packaging: "", units_per_case: "", position: 1 };

export default function ModAmbalareView() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Method | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Method | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabaseCloud.from("packaging_methods").select("*").order("client_order").order("position");
    if (error) toast.error("Lista modurilor de ambalare nu a putut fi încărcată.");
    else {
      const next = (data ?? []) as Method[];
      setRows(next);
      setClient((current) => current || next[0]?.client_name || "");
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const clients = useMemo(() => Array.from(new Map(rows.map((r) => [r.client_name, r.client_order])).entries()).sort((a, b) => a[1] - b[1]), [rows]);
  const visible = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("ro");
    return rows.filter((r) => r.client_name === client && (!q || [r.product_name, r.weight, r.primary_packaging, r.tertiary_packaging, r.units_per_case, r.subgroup].some((v) => String(v ?? "").toLocaleLowerCase("ro").includes(q))));
  }, [rows, client, search]);

  const openNew = () => {
    const order = clients.find(([name]) => name === client)?.[1] ?? clients.length;
    const max = rows.filter((r) => r.client_name === client).reduce((n, r) => Math.max(n, r.position), 0);
    setForm({ ...emptyForm, client_name: client, client_order: order, position: max + 1 });
    setEditing(null);
  };
  const openEdit = (row: Method) => {
    const { id: _id, ...values } = row;
    setForm(values);
    setEditing(row);
  };
  const update = (key: keyof FormState, value: string | number | null) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.client_name.trim() || !form.product_name.trim() || !form.weight.trim() || !form.primary_packaging.trim() || !form.tertiary_packaging.trim() || !form.units_per_case.trim()) {
      toast.error("Completează toate câmpurile obligatorii."); return;
    }
    setSaving(true);
    try {
      await argusFetch("packaging_save", editing?.id ? { id: editing.id } : {}, form);
      setEditing(undefined);
      setClient(form.client_name);
      await load();
      toast.success(editing ? "Modul de ambalare a fost actualizat." : "Modul de ambalare a fost adăugat.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Modificarea nu a putut fi salvată."); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleting) return;
    try {
      await argusFetch("packaging_delete", { id: deleting.id }, {});
      setDeleting(null); await load(); toast.success("Înregistrarea a fost ștearsă.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Înregistrarea nu a putut fi ștearsă."); }
  };

  let lastGroup: string | null | undefined;
  return <div className="space-y-4">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div>
        <div className="flex items-center gap-2"><PackageOpen className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Mod de ambalare</h2></div>
        <p className="mt-1 text-sm text-muted-foreground">Așezarea produselor în ambalaje și baxuri, organizată pe client.</p>
      </div>
      {isAdmin && <Button onClick={openNew} disabled={!client}><Plus className="h-4 w-4" />Adaugă produs</Button>}
    </div>

    <div className="grid gap-3 md:grid-cols-[minmax(220px,320px)_1fr]">
      <Select value={client} onValueChange={setClient}><SelectTrigger><SelectValue placeholder="Alege clientul" /></SelectTrigger><SelectContent className="overflow-y-auto">{clients.map(([name]) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent></Select>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Caută produs sau ambalaj" className="pl-9" /></div>
    </div>

    {loading ? <div className="flex min-h-48 items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Se încarcă…</div> : visible.length === 0 ? <div className="rounded-md border border-dashed p-10 text-center text-muted-foreground">Nu există produse pentru selecția curentă.</div> : <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[840px] text-sm">
        <thead className="bg-muted/70 text-left"><tr><th className="p-3">Produs</th><th className="p-3">Gramaj</th><th className="p-3">Ambalaj primar</th><th className="p-3">Ambalaj terțiar / cutie</th><th className="p-3 text-center">Buc. / bax</th>{isAdmin && <th className="w-24 p-3 text-right">Acțiuni</th>}</tr></thead>
        <tbody>{visible.map((row) => {
          const showGroup = row.subgroup !== lastGroup; lastGroup = row.subgroup;
          return <>
            {showGroup && row.subgroup && <tr key={`${row.id}-group`} className="border-t bg-primary/5"><td colSpan={isAdmin ? 6 : 5} className="px-3 py-2 font-medium text-primary"><Badge variant="outline">{row.subgroup}</Badge></td></tr>}
            <tr key={row.id} className="border-t hover:bg-muted/30"><td className="p-3 font-medium">{row.product_name}</td><td className="p-3">{row.weight}</td><td className="p-3">{row.primary_packaging}</td><td className="p-3">{row.tertiary_packaging}</td><td className="p-3 text-center font-semibold">{row.units_per_case}</td>{isAdmin && <td className="p-2 text-right"><Button variant="ghost" size="icon-sm" title="Editează" onClick={() => openEdit(row)}><Edit2 /></Button><Button variant="ghost" size="icon-sm" title="Șterge" className="text-destructive" onClick={() => setDeleting(row)}><Trash2 /></Button></td>}</tr>
          </>;
        })}</tbody>
      </table>
    </div>}

    <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editează modul de ambalare" : "Adaugă mod de ambalare"}</DialogTitle><DialogDescription>Completează datele exact cum trebuie să apară în Picking și Vânzări.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-2 sm:grid-cols-2">
        <Field label="Client *"><Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} /></Field><Field label="Subgrupă"><Input value={form.subgroup ?? ""} onChange={(e) => update("subgroup", e.target.value || null)} placeholder="Opțional" /></Field>
        <Field label="Produs *"><Input value={form.product_name} onChange={(e) => update("product_name", e.target.value)} /></Field><Field label="Gramaj *"><Input value={form.weight} onChange={(e) => update("weight", e.target.value)} /></Field>
        <Field label="Ambalaj primar *"><Input value={form.primary_packaging} onChange={(e) => update("primary_packaging", e.target.value)} /></Field><Field label="Ambalaj terțiar / cutie *"><Input value={form.tertiary_packaging} onChange={(e) => update("tertiary_packaging", e.target.value)} /></Field>
        <Field label="Bucăți / bax *"><Input value={form.units_per_case} onChange={(e) => update("units_per_case", e.target.value)} /></Field><Field label="Ordine"><Input type="number" min={1} value={form.position} onChange={(e) => update("position", Math.max(1, Number(e.target.value) || 1))} /></Field>
      </div><DialogFooter><Button variant="outline" onClick={() => setEditing(undefined)}>Renunță</Button><Button onClick={save} disabled={saving}>{saving && <Loader2 className="animate-spin" />}Salvează</Button></DialogFooter>
    </DialogContent></Dialog>

    <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ștergi acest produs?</AlertDialogTitle><AlertDialogDescription>{deleting?.product_name} nu va mai apărea în lista de ambalare pentru {deleting?.client_name}.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Renunță</AlertDialogCancel><AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Șterge</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }