// Chat tools that let Argus create/list/modify the user's dashboard agents (Argus's own config, not ERP data).
import { jsonSchema, tool } from "npm:ai@7.0.123";
import { validFilters } from "./agentFilters.ts";

const WIDGETS = ["auto", "bar_chart", "line_chart", "pie_chart", "kpi", "table", "markdown"];
const SCHED = ["on_demand", "daily", "weekly", "monthly"];
type C = { cloud: any };

const filterSchema = {
  type: "array", maxItems: 6,
  description: "Filtre selectabile la rulare. type: period (default today|yesterday|last_7|last_30|this_month|last_month), choice (cu options, de ex. luna 1..12, an, client), text (produs/furnizor). Pune MEREU filtrele pe care utilizatorul vrea să le schimbe.",
  items: {
    type: "object", additionalProperties: false, required: ["label", "type", "options", "default"],
    properties: {
      label: { type: "string" }, type: { type: "string", enum: ["period", "text", "choice"] },
      options: { type: ["array", "null"], items: { type: "string" } }, default: { type: "string" },
    },
  },
};

export function agentBuilderTools(c: C, userId: string, email: string) {
  async function addCard(templateId: string, span: number) {
    const { data: last } = await c.cloud.from("argus_user_dashboard_cards").select("position_order").eq("user_id", userId).order("position_order", { ascending: false }).limit(1).maybeSingle();
    await c.cloud.from("argus_user_dashboard_cards").upsert(
      { user_id: userId, template_id: templateId, position_order: (last?.position_order ?? -1) + 1, column_span: span },
      { onConflict: "user_id,template_id", ignoreDuplicates: true },
    );
  }
  return {
    lista_agenti: tool({
      description: "Listează agenții/rapoartele/calculatoarele utilizatorului de pe tabloul Argus (id, titlu, instrucțiuni, filtre). Folosește-l înainte de a modifica un agent.",
      inputSchema: jsonSchema<Record<string, never>>({ type: "object", additionalProperties: false, properties: {} }),
      execute: async () => {
        const { data, error } = await c.cloud.from("argus_report_templates").select("id,title,description,prompt_instructions,preferred_widget_type,schedule_type,params,created_by")
          .or(`created_by.eq.${userId},is_public.eq.true`).order("created_at", { ascending: false }).limit(50);
        if (error) return { eroare: error.message };
        return { agenti: (data ?? []).map((t: any) => ({ ...t, al_meu: t.created_by === userId, created_by: undefined })) };
      },
    }),
    creeaza_agent: tool({
      description: "Creează un agent / raport / calculator reutilizabil pe tabloul Argus al utilizatorului, cu filtre selectabile. Folosește-l când utilizatorul cere un agent, raport recurent sau calculator. ÎNAINTE de a-l apela, propune în chat titlul, ce face și filtrele și cere confirmarea; apelează-l doar după ce utilizatorul a confirmat. Instrucțiunile trebuie să fie complete și autonome (ce date, ce calcul, ce coloane, ce instrument: pentru prețuri calculeaza_pret cu produsul/clientul/luna/anul din filtre), referindu-se la filtre prin eticheta lor.",
      inputSchema: jsonSchema<any>({
        type: "object", additionalProperties: false, required: ["titlu", "descriere", "instructiuni", "widget", "programare", "filtre"],
        properties: {
          titlu: { type: "string", maxLength: 150 }, descriere: { type: "string", maxLength: 500 },
          instructiuni: { type: "string", maxLength: 4000 },
          widget: { type: "string", enum: WIDGETS }, programare: { type: "string", enum: SCHED }, filtre: filterSchema,
        },
      }),
      execute: async (b: any) => {
        const title = String(b.titlu ?? "").trim().slice(0, 150), prompt = String(b.instructiuni ?? "").trim().slice(0, 4000);
        if (!title || !prompt) return { eroare: "Titlul și instrucțiunile sunt obligatorii." };
        const w = WIDGETS.includes(b.widget) ? b.widget : "auto", s = SCHED.includes(b.programare) ? b.programare : "on_demand";
        const { data: t, error } = await c.cloud.from("argus_report_templates").insert({
          title, description: String(b.descriere ?? "").slice(0, 500), prompt_instructions: prompt, preferred_widget_type: w,
          schedule_type: s, is_public: false, created_by: userId, created_by_name: email,
          last_scheduled_at: s === "on_demand" ? null : new Date().toISOString(),
          params: validFilters((b.filtre ?? []).map((f: any) => ({ ...f, options: f.options ?? undefined }))),
        }).select("id,title,params").single();
        if (error) return { eroare: error.message };
        await addCard(t.id, w.endsWith("chart") || w === "table" ? 2 : 1);
        return { creat: true, id: t.id, titlu: t.title, filtre: t.params, nota: "Agentul e pe tabloul Argus (tab Agenți). Spune-i utilizatorului să aleagă filtrele și să apese Actualizează." };
      },
    }),
    modifica_agent: tool({
      description: "Modifică un agent existent al utilizatorului (titlu, instrucțiuni, filtre, widget, programare). Trimite doar câmpurile schimbate (null = neschimbat). La filtre trimite lista COMPLETĂ nouă. Cere confirmarea înainte.",
      inputSchema: jsonSchema<any>({
        type: "object", additionalProperties: false, required: ["id", "titlu", "descriere", "instructiuni", "widget", "programare", "filtre"],
        properties: {
          id: { type: "string" }, titlu: { type: ["string", "null"] }, descriere: { type: ["string", "null"] },
          instructiuni: { type: ["string", "null"] }, widget: { type: ["string", "null"] }, programare: { type: ["string", "null"] },
          filtre: { ...filterSchema, type: ["array", "null"] },
        },
      }),
      execute: async (b: any) => {
        const patch: Record<string, unknown> = {};
        if (b.titlu?.trim()) patch.title = b.titlu.trim().slice(0, 150);
        if (typeof b.descriere === "string") patch.description = b.descriere.slice(0, 500);
        if (b.instructiuni?.trim()) patch.prompt_instructions = b.instructiuni.trim().slice(0, 4000);
        if (WIDGETS.includes(b.widget)) patch.preferred_widget_type = b.widget;
        if (SCHED.includes(b.programare)) { patch.schedule_type = b.programare; if (b.programare !== "on_demand") patch.last_scheduled_at = new Date().toISOString(); }
        if (Array.isArray(b.filtre)) patch.params = validFilters(b.filtre.map((f: any) => ({ ...f, options: f.options ?? undefined })));
        if (!Object.keys(patch).length) return { eroare: "Nimic de modificat." };
        const { data, error } = await c.cloud.from("argus_report_templates").update(patch).eq("id", String(b.id)).eq("created_by", userId).select("id,title,params").maybeSingle();
        if (error) return { eroare: error.message };
        if (!data) return { eroare: "Poți modifica doar agenții creați de tine (verifică id-ul cu lista_agenti)." };
        return { modificat: true, ...data };
      },
    }),
  };
}
