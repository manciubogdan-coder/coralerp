// Argus answers keep running on the server after the user leaves; this tracks threads awaiting an answer.
const KEY = "argus_pending_threads";
export type Pending = { threadId: string; sentAt: number; question: string };

export function readPending(): Pending[] {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
}
function write(list: Pending[]) {
  localStorage.setItem(KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("argus-pending-changed"));
}
export function markPending(threadId: string, question: string) {
  write([...readPending().filter((p) => p.threadId !== threadId), { threadId, sentAt: Date.now(), question: question.slice(0, 80) }]);
  if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
}
export function clearPending(threadId: string) {
  write(readPending().filter((p) => p.threadId !== threadId));
}
/** A pending answer is done when the thread was saved after the question was sent (or gave up after 30 min). */
export function isDone(p: Pending, updatedAt: string | undefined, now = Date.now()) {
  if (now - p.sentAt > 30 * 60_000) return true;
  return !!updatedAt && new Date(updatedAt).getTime() > p.sentAt;
}
