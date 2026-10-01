import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import * as XLSX from "xlsx";
import { Plus, Trash2, FileSpreadsheet, Loader2, MessageSquare, BookmarkPlus } from "lucide-react";
import { CreateReportModal } from "./ArgusAgentsDashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-custom-toast";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { ARGUS_URL, argusFetch, argusHeaders } from "@/lib/argusApi";
import argusLogo from "@/assets/argus-logo.png";

type Thread = { id: string; title: string; updated_at: string };

const TOOL_TITLES: Record<string, string> = {
  "tool-metrici_perioada": "Analiză pe perioadă",
  "tool-interogare_date": "Citire date",
  "tool-genereaza_raport": "Raport Excel",
};

const SUGGESTIONS = [
  "Cum a mers firma săptămâna asta față de săptămâna trecută?",
  "Cine a greșit cel mai mult luna asta și unde?",
  "Care linie de producție e cea mai puțin productivă și de ce?",
  "Fă-mi un raport Excel cu recepțiile de materii prime din ultimele 30 de zile, pe furnizor.",
];

function ReportCard({ output }: { output: any }) {
  const [busy, setBusy] = useState(false);
  if (!output || output.eroare) return null;
  const download = async () => {
    setBusy(true);
    try {
      const r = await argusFetch<{ randuri: any[] }>("report", {}, { interogare: output.interogare });
      const ws = XLSX.utils.json_to_sheet(
        r.randuri.map((row) =>
          Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === "object" && v !== null ? JSON.stringify(v) : v])),
        ),
      );
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Raport");
      XLSX.writeFile(wb, `${String(output.titlu || "raport-argus").replace(/[^\w\- ăâîșțĂÂÎȘȚ]/g, "").slice(0, 60)}.xlsx`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Raportul nu s-a putut descărca", description: e.message });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="my-2 flex items-center justify-between gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-6 w-6 text-primary" />
        <div>
          <div className="font-medium">{output.titlu}</div>
          <div className="text-xs text-muted-foreground">
            {output.descriere} · {output.total_randuri} rânduri
          </div>
        </div>
      </div>
      <Button size="sm" onClick={download} disabled={busy}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Descarcă Excel"}
      </Button>
    </div>
  );
}

function ChatWindow({ threadId, initial, onSaved }: { threadId: string; initial: UIMessage[]; onSaved: () => void }) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${ARGUS_URL}?action=chat`,
        headers: argusHeaders,
        body: { threadId },
      }),
    [threadId],
  );
  const { messages, sendMessage, status, stop, error } = useChat({ id: threadId, messages: initial, transport, onFinish: onSaved });
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (status === "ready") taRef.current?.focus();
  }, [status, threadId]);

  const send = (t: string) => {
    if (!t.trim() || status === "submitted" || status === "streaming") return;
    sendMessage({ text: t.trim() });
    setText("");
  };

  const [agentDraft, setAgentDraft] = useState<any | null>(null);
  const textOf = (m: UIMessage) => m.parts.map((p: any) => (p.type === "text" ? p.text : "")).join("\n").trim();
  const saveAsAgent = (idx: number) => {
    let q = "";
    for (let i = idx - 1; i >= 0; i--) if (messages[i].role === "user") { q = textOf(messages[i]); break; }
    const answer = textOf(messages[idx]);
    const hasTable = /\n\|.*\|/.test(answer);
    setAgentDraft({
      title: q.slice(0, 80) || "Raport din chat",
      description: "Salvat din conversația cu Argus",
      prompt_instructions:
        `Cerința: ${q}\n\nRefă aceeași analiză cu datele actuale, în același format și cu aceleași coloane/indicatori ca în exemplul de mai jos.\n\nExemplu de rezultat dorit:\n${answer.slice(0, 2500)}`,
      preferred_widget_type: hasTable ? "table" : "auto",
      schedule_type: "on_demand",
      is_public: false,
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<img src={argusLogo} alt="Argus" className="h-14 w-14" />}
              title="Întreabă-l pe Argus"
              description="Vede tot ce mișcă în firmă: oameni, producție, depozite, greșeli."
            >
              <div className="mt-4 flex flex-col items-center gap-3">
                <img src={argusLogo} alt="Argus" className="h-14 w-14" />
                <div className="text-lg font-semibold">Întreabă-l pe Argus</div>
                <div className="grid w-full max-w-xl gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((m, idx) => (
              <React.Fragment key={m.id}>
              <Message from={m.role}>
                <MessageContent
                  className={cn(m.role === "user" && "bg-primary text-primary-foreground")}
                >
                  {m.parts.map((p: any, i) => {
                    if (p.type === "text") return <MessageResponse key={i}>{p.text}</MessageResponse>;
                    if (typeof p.type === "string" && p.type.startsWith("tool-")) {
                      return (
                        <div key={i}>
                          <Tool defaultOpen={false}>
                            <ToolHeader type={p.type} state={p.state} title={TOOL_TITLES[p.type] ?? p.type} />
                            <ToolContent>
                              <ToolInput input={p.input} />
                              <ToolOutput output={p.output ? JSON.stringify(p.output, null, 2).slice(0, 4000) : undefined} errorText={p.errorText} />
                            </ToolContent>
                          </Tool>
                          {p.type === "tool-genereaza_raport" && p.state === "output-available" && <ReportCard output={p.output} />}
                        </div>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
              {m.role === "assistant" && !(idx === messages.length - 1 && status === "streaming") && (
                <div className="-mt-2 flex">
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => saveAsAgent(idx)}>
                    <BookmarkPlus className="mr-1 h-3.5 w-3.5" /> Salvează ca agent
                  </Button>
                </div>
              )}
              </React.Fragment>
            ))
          )}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Argus analizează datele…</Shimmer>
              </MessageContent>
            </Message>
          )}
          {error && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl p-3">
        <PromptInput onSubmit={(msg) => send(msg.text ?? "")}>
          <PromptInputTextarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Întreabă orice despre firmă…"
            autoFocus
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} disabled={!text.trim() && status === "ready"} />
          </PromptInputFooter>
        </PromptInput>
      </div>
      <CreateReportModal
        open={!!agentDraft}
        onOpenChange={(o) => !o && setAgentDraft(null)}
        initial={agentDraft}
        onCreated={() => {
          setAgentDraft(null);
          toast({ title: "Agent salvat", description: "Îl găsești în tabul „Agenți & Rapoarte”." });
        }}
      />
    </div>
  );
}

export default function ArgusChat({ threadId }: { threadId?: string }) {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [initial, setInitial] = useState<UIMessage[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const loadThreads = () => argusFetch<Thread[]>("threads").then(setThreads).catch((e) => setLoadErr(e.message));
  useEffect(() => {
    loadThreads();
  }, []);

  useEffect(() => {
    setInitial(null);
    if (!threadId) return;
    argusFetch<{ messages: UIMessage[] }>("messages", { id: threadId })
      .then((r) => setInitial(r.messages))
      .catch((e) => setLoadErr(e.message));
  }, [threadId]);

  const newThread = async () => {
    try {
      const t = await argusFetch<Thread>("create_thread", {}, {});
      setThreads((x) => [t, ...x]);
      navigate(`/administrativ/argus/chat/${t.id}`);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Eroare", description: e.message });
    }
  };
  const del = async (id: string) => {
    await argusFetch("delete_thread", { id }, {}).catch(() => null);
    setThreads((x) => x.filter((t) => t.id !== id));
    if (id === threadId) navigate("/administrativ/argus/chat");
  };

  return (
    <div className="flex h-[calc(100vh-190px)] min-h-[520px] overflow-hidden rounded-xl border bg-background">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-muted/30 md:flex">
        <div className="p-3">
          <Button className="w-full" onClick={newThread}>
            <Plus className="mr-2 h-4 w-4" /> Conversație nouă
          </Button>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-2">
          {threads.map((t) => (
            <div
              key={t.id}
              className={cn(
                "group flex items-center gap-1 rounded-md text-sm",
                t.id === threadId ? "bg-primary/10 text-primary" : "hover:bg-muted",
              )}
            >
              <button className="flex min-w-0 flex-1 items-center gap-2 px-2 py-2 text-left" onClick={() => navigate(`/administrativ/argus/chat/${t.id}`)}>
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate">{t.title}</span>
              </button>
              <button className="px-2 opacity-0 group-hover:opacity-100" onClick={() => del(t.id)} aria-label="Șterge conversația">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      </aside>
      <section className="min-w-0 flex-1">
        {loadErr ? (
          <div className="p-6 text-sm text-destructive">{loadErr}</div>
        ) : !threadId ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
            <img src={argusLogo} alt="Argus" className="h-20 w-20" />
            <div className="text-xl font-semibold">Argus te ascultă</div>
            <p className="max-w-md text-sm text-muted-foreground">Pornește o conversație ca să întrebi orice despre firmă sau să ceri un raport.</p>
            <Button onClick={newThread}>
              <Plus className="mr-2 h-4 w-4" /> Conversație nouă
            </Button>
          </div>
        ) : initial === null ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ChatWindow key={threadId} threadId={threadId} initial={initial} onSaved={loadThreads} />
        )}
      </section>
    </div>
  );
}
