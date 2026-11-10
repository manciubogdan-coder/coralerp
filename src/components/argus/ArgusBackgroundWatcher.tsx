import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { argusFetch } from "@/lib/argusApi";
import { clearPending, isDone, readPending } from "@/lib/argus/backgroundWatch";

type Thread = { id: string; title: string; updated_at: string };

/** Polls pending Argus threads app-wide and notifies (toast + browser notification) with a link to the answer. */
export default function ArgusBackgroundWatcher() {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    let busy = false;
    const tick = async () => {
      const pending = readPending();
      if (!pending.length || busy) return;
      busy = true;
      try {
        const threads = await argusFetch<Thread[]>("threads");
        const byId = new Map(threads.map((t) => [t.id, t]));
        for (const p of pending) {
          const t = byId.get(p.threadId);
          if (!isDone(p, t?.updated_at)) continue;
          clearPending(p.threadId);
          window.dispatchEvent(new CustomEvent("argus-done", { detail: p.threadId }));
          const link = `/administrativ/argus/chat/${p.threadId}`;
          const onPage = window.location.pathname === link && document.visibilityState === "visible";
          if (onPage) continue;
          const title = "Argus a răspuns";
          const body = p.question || t?.title || "Răspunsul este gata.";
          toast(title, { description: body, duration: 30000, action: { label: "Vezi răspunsul", onClick: () => navigate(link) } });
          if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
            const n = new Notification(title, { body, tag: `argus-${p.threadId}` });
            n.onclick = () => { window.focus(); navigate(link); n.close(); };
          }
        }
      } catch { /* retry next tick */ } finally { busy = false; }
    };
    const iv = window.setInterval(tick, 6000);
    window.addEventListener("argus-pending-changed", tick);
    return () => { window.clearInterval(iv); window.removeEventListener("argus-pending-changed", tick); };
  }, [navigate]);
  void location;
  return null;
}
