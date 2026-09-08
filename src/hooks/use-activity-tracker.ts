import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  normalizePath,
  readActiveTab,
  sendActivityPings,
  type ActivityPing,
} from '@/lib/activityTracking';

const TICK_MS = 15000; // cât de des se măsoară
const FLUSH_MS = 60000; // cât de des se trimit datele
const IDLE_MS = 5 * 60 * 1000; // inactivitate după care nu mai contorizăm

/**
 * Contorizează timpul petrecut de utilizator în aplicație, pe fiecare pagină
 * și pe tab-ul activ din pagină. Trimite periodic „ping"-uri în baza de date.
 */
export function useActivityTracker() {
  const { user, profile } = useAuth();
  const location = useLocation();

  const pathRef = useRef(location.pathname);
  const bufferRef = useRef<Map<string, number>>(new Map());
  const lastActiveRef = useRef<number>(Date.now());
  const userRef = useRef<{ id: string; email: string | null; name: string | null } | null>(null);

  pathRef.current = location.pathname;
  userRef.current = user
    ? {
        id: user.id,
        email: profile?.email ?? user.email ?? null,
        name: profile?.display_name ?? profile?.name ?? null,
      }
    : null;

  useEffect(() => {
    const markActive = () => {
      lastActiveRef.current = Date.now();
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'focus'];
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const tick = window.setInterval(() => {
      if (!userRef.current) return;
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (Date.now() - lastActiveRef.current > IDLE_MS) return;

      const path = normalizePath(pathRef.current);
      const tab = readActiveTab() ?? '';
      const key = `${path}\u0000${tab}`;
      bufferRef.current.set(key, (bufferRef.current.get(key) ?? 0) + TICK_MS / 1000);
    }, TICK_MS);

    const flush = () => {
      const u = userRef.current;
      if (!u) return;
      const entries = Array.from(bufferRef.current.entries());
      if (entries.length === 0) return;
      bufferRef.current.clear();
      const now = new Date().toISOString();
      const rows: ActivityPing[] = entries.map(([key, seconds]) => {
        const [path, tab] = key.split('\u0000');
        return {
          user_id: u.id,
          email: u.email,
          display_name: u.name,
          path,
          tab: tab || null,
          seconds: Math.round(seconds),
          occurred_at: now,
        };
      });
      void sendActivityPings(rows);
    };

    const flushInterval = window.setInterval(flush, FLUSH_MS);
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);

    return () => {
      events.forEach((e) => window.removeEventListener(e, markActive));
      window.clearInterval(tick);
      window.clearInterval(flushInterval);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);
}
