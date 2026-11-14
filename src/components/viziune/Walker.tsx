// First-person camera for walking through the factory: mouse (pointer lock) or finger drag to look,
// WASD / arrows / on-screen pad to walk, Shift to run, click on a machine under the crosshair for its details.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { hallWalls, lookedAt, stationBoxes, stepWalk, WALK, WALK_START, type WalkInput, type WalkPose } from "@/lib/viziune/walk";
import type { HallStation } from "@/lib/viziune/hallLayout";

export type WalkPad = { fwd: number; side: number; turn: number };
const LOOK = 0.0022;
const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.getAttribute("role") === "combobox");
};

export function Walker({ layout, pad, onLook, onPick, onExit, onLock }: {
  layout: HallStation[]; pad: React.MutableRefObject<WalkPad>;
  onLook: (stationId: string | null) => void; onPick: (stationId: string) => void; onExit: () => void; onLock: (locked: boolean) => void;
}) {
  const { camera, gl } = useThree();
  const pose = useRef<WalkPose>({ ...WALK_START });
  const pitch = useRef(-0.05);
  const keys = useRef(new Set<string>());
  const looked = useRef<string | null>(null);
  const bob = useRef(0);
  const frame = useRef(0);
  const solid = useMemo(() => [...hallWalls(), ...layout.flatMap(stationBoxes)], [layout]);
  const cb = useRef({ onLook, onPick, onExit, onLock }); cb.current = { onLook, onPick, onExit, onLock };

  // Wider lens at eye height; the bird's-eye lens comes back when the walk ends.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera; const fov = cam.fov;
    cam.fov = WALK.fov; cam.updateProjectionMatrix();
    return () => { cam.fov = fov; cam.updateProjectionMatrix(); if (document.pointerLockElement) document.exitPointerLock(); };
  }, [camera]);

  useEffect(() => {
    const el = gl.domElement;
    const canLock = typeof el.requestPointerLock === "function" && window.matchMedia("(pointer: fine)").matches;
    const locked = () => document.pointerLockElement === el;
    const turn = (dx: number, dy: number) => {
      pose.current.yaw -= dx * LOOK;
      pitch.current = Math.max(-1.2, Math.min(1.2, pitch.current - dy * LOOK));
    };
    const onMouseMove = (e: MouseEvent) => { if (locked()) turn(e.movementX, e.movementY); };
    let drag: { id: number; x: number; y: number; moved: number } | null = null;
    const onDown = (e: PointerEvent) => {
      if (locked()) return;
      if (e.pointerType !== "mouse" || !canLock) drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY; drag.moved += Math.abs(dx) + Math.abs(dy);
      turn(dx * 1.6, dy * 1.6);
    };
    const onUp = (e: PointerEvent) => {
      if (!drag || drag.id !== e.pointerId) return;
      const tap = drag.moved < 8; drag = null;
      if (tap && looked.current) cb.current.onPick(looked.current);
    };
    const onClick = () => {
      if (!canLock) return; // touch: taps are handled on pointer up
      if (!locked()) { try { const p = el.requestPointerLock() as unknown; if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {}); } catch { /* browser refused */ } return; }
      if (looked.current) { document.exitPointerLock(); cb.current.onPick(looked.current); }
    };
    const onLockChange = () => cb.current.onLock(locked());
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
      if (e.type === "keydown" && e.code === "Escape" && !locked()) { cb.current.onExit(); return; }
      if (/^(Key[WASDQE]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(e.code)) {
        e.preventDefault();
        if (e.type === "keydown") keys.current.add(e.code); else keys.current.delete(e.code);
      }
    };
    const clear = () => keys.current.clear();
    el.addEventListener("click", onClick);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", clear);
    return () => {
      el.removeEventListener("click", onClick);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      window.removeEventListener("blur", clear);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const k = keys.current, p = pad.current;
    const has = (...c: string[]) => c.some((x) => k.has(x));
    const input: WalkInput = {
      fwd: Math.max(-1, Math.min(1, (has("KeyW", "ArrowUp") ? 1 : 0) - (has("KeyS", "ArrowDown") ? 1 : 0) + p.fwd)),
      side: Math.max(-1, Math.min(1, (has("KeyD") ? 1 : 0) - (has("KeyA") ? 1 : 0) + p.side)),
      turn: Math.max(-1, Math.min(1, (has("KeyQ", "ArrowLeft") ? 1 : 0) - (has("KeyE", "ArrowRight") ? 1 : 0) + p.turn)),
      run: has("ShiftLeft", "ShiftRight"),
    };
    const before = pose.current;
    const next = stepWalk(before, input, delta, solid);
    const moved = Math.hypot(next.x - before.x, next.z - before.z);
    pose.current = next;
    bob.current += moved * 2.2;
    const sway = moved > 0 ? Math.sin(bob.current) * 0.035 : 0;
    camera.position.set(next.x, WALK.eye + sway, next.z);
    camera.rotation.set(pitch.current, next.yaw, 0, "YXZ");
    if (frame.current++ % 6 === 0) {
      const id = lookedAt(next, solid);
      if (id !== looked.current) { looked.current = id; cb.current.onLook(id); }
    }
  });
  return null;
}
