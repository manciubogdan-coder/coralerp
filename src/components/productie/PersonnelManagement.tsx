import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseCloud } from "@/integrations/supabase/cloudClient";
import { useProductionLines } from "@/hooks/productie/useProductionData";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export interface PlannerPerson {
  id: string;
  nume: string;
  linie_id: string | null;
  linie_nume: string | null;
  post: string | null;
  status: string;
  status_note: string | null;
  status_from: string | null;
  status_to: string | null;
  /** schimbul permanent al persoanei: "s1" | "s2" | null (ambele/nedefinit) */
  schimb?: string | null;
}

export const SHIFT_OPTIONS = [
  { value: "none", label: "Ambele / nedefinit" },
  { value: "s1", label: "Schimb 1" },
  { value: "s2", label: "Schimb 2" },
];

export const STATUS_OPTIONS = [
  { value: "activ", label: "Activ" },
  { value: "concediu", label: "Concediu" },
  { value: "liber", label: "Liber" },
  { value: "medical", label: "Medical" },
  { value: "problema", label: "Problemă" },
];

export const statusLabel = (s: string) => STATUS_OPTIONS.find((o) => o.value === s)?.label || s;

/** Posturi neproductive (nu țin de liniile de producție) */
export const AUX_POSTS = [
  "Etichete",
  "Picking",
  "Spălat",
  "Sortat",
  "Depozit",
  "Recepție",
  "Curățenie",
  "Mentenanță",
  "Calitate",
  "Cutii manuale",
  "Cutii automate",
  "Salate 3",
  "Magazie",
  "Tunel",
];

export const isAuxSlot = (v?: string | null) => !!v && v.startsWith("aux:");
export const auxLabel = (v: string) => v.replace(/^aux:/, "");

export const usePlannerPersonnel = () =>
  useQuery({
    queryKey: ["planner-personnel"],
    queryFn: async () => {
      const { data, error } = await supabaseCloud
        .from("planner_personal")
        .select("*")
        .order("nume");
      if (error) throw error;
      return (data || []) as PlannerPerson[];
    },
  });

const PersonnelManagement: React.FC = () => {
  const qc = useQueryClient();
  const { data: lines = [] } = useProductionLines();
  const { data: people = [], isLoading } = usePlannerPersonnel();
  const [nume, setNume] = useState("");
  const [filter, setFilter] = useState("");

  const invalidate = () => qc.invalidateQueries({ queryKey: ["planner-personnel"] });

  const addMut = useMutation({
    mutationFn: async (n: string) => {
      const { error } = await supabaseCloud.from("planner_personal").insert({ nume: n });
      if (error) throw error;
    },
    onSuccess: () => {
      setNume("");
      invalidate();
      toast.success("Persoană adăugată");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlannerPerson> }) => {
      const { error } = await supabaseCloud.from("planner_personal").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseCloud.from("planner_personal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Persoană ștearsă");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = people.filter((p) => p.nume.toLowerCase().includes(filter.toLowerCase()));
  const activi = people.filter((p) => p.status === "activ").length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" /> Personal ({activi} activi / {people.length} total)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Lista se păstrează permanent. Linia setată aici este linia implicită pe care persoana apare automat în planificator.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            className="h-9 max-w-xs"
            placeholder="Nume persoană"
            value={nume}
            onChange={(e) => setNume(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && nume.trim() && addMut.mutate(nume.trim())}
          />
          <Button size="sm" onClick={() => nume.trim() && addMut.mutate(nume.trim())}>
            <Plus className="h-4 w-4 mr-1" /> Adaugă
          </Button>
          <Input
            className="h-9 max-w-xs"
            placeholder="Caută..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[160px]">Nume</TableHead>
                <TableHead className="min-w-[180px]">Linie / post implicit</TableHead>
                <TableHead className="min-w-[140px]">Post / rol</TableHead>
                <TableHead className="min-w-[140px]">Schimb</TableHead>
                <TableHead className="min-w-[140px]">Status</TableHead>
                <TableHead className="w-[130px]">De la</TableHead>
                <TableHead className="w-[130px]">Până la</TableHead>
                <TableHead className="min-w-[180px]">Observații</TableHead>
                <TableHead className="w-[50px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <Input
                      className="h-8"
                      defaultValue={p.nume}
                      onBlur={(e) =>
                        e.target.value.trim() !== p.nume &&
                        updateMut.mutate({ id: p.id, patch: { nume: e.target.value.trim() } })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.linie_id || "none"}
                      onValueChange={(v) =>
                        updateMut.mutate({
                          id: p.id,
                          patch: {
                            linie_id: v === "none" ? null : v,
                            linie_nume:
                              v === "none"
                                ? null
                                : isAuxSlot(v)
                                ? auxLabel(v)
                                : lines.find((l: any) => l.id === v)?.nume || null,
                          },
                        })
                      }
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Fără linie" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 overflow-y-auto">
                        <SelectItem value="none">Fără linie</SelectItem>
                        <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">Linii producție</div>
                        {lines.map((l: any) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.nume}
                          </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-[10px] uppercase text-muted-foreground">
                          Posturi neproductive
                        </div>
                        {AUX_POSTS.map((a) => (
                          <SelectItem key={a} value={`aux:${a}`}>
                            {a}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isAuxSlot(p.linie_id) && (
                      <Badge variant="secondary" className="mt-1 text-[10px]">
                        neproductiv
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="ex. ambalare"
                      defaultValue={p.post || ""}
                      onBlur={(e) => updateMut.mutate({ id: p.id, patch: { post: e.target.value || null } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={p.schimb || "none"}
                      onValueChange={(v) => updateMut.mutate({ id: p.id, patch: { schimb: v === "none" ? null : v } })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SHIFT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={p.status} onValueChange={(v) => updateMut.mutate({ id: p.id, patch: { status: v } })}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {p.status !== "activ" && (
                      <Badge variant="destructive" className="mt-1 text-[10px]">
                        indisponibil
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8"
                      defaultValue={p.status_from || ""}
                      onChange={(e) => updateMut.mutate({ id: p.id, patch: { status_from: e.target.value || null } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      className="h-8"
                      defaultValue={p.status_to || ""}
                      onChange={(e) => updateMut.mutate({ id: p.id, patch: { status_to: e.target.value || null } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8"
                      placeholder="detalii"
                      defaultValue={p.status_note || ""}
                      onBlur={(e) => updateMut.mutate({ id: p.id, patch: { status_note: e.target.value || null } })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => deleteMut.mutate(p.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    Nicio persoană în listă.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default PersonnelManagement;
