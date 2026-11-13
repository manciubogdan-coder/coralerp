import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { FactoryData } from "./useFactoryData";
import type { LineView } from "@/lib/viziune/factoryState";
import { FIXTURES, FLOWS, HALL, toPlan, toWorld, type HallStation } from "@/lib/viziune/hallLayout";
type Station = HallStation;
import { clockTime, minutesLabel, PaceBadge } from "./pace";

// Scene materials are a fixed physical palette (steel, crates, greens, water), not UI theme colors.
const C = {
  floor: "#c9ccc4", steel: "#b5bbbf", darkSteel: "#4d5357", belt: "#2b2f31", wall: "#eceee9", pillar: "#30343a",
  crate: "#2f6b4f", crateBlue: "#2f7fd0", crateGrey: "#9aa1a6", leaf: ["#5fa83a", "#7cc04b", "#3f8a2e", "#a3cf5d", "#8a3b5a"],
  coat: "#2f6b45", net: "#f2f2f2", skin: "#e2b48f", truck: "#f2f2ef", stripe: "#3d8b3d", cab: "#2c6e49",
  elevator: "#2d6fd6", water: "#6fb7e6", carton: "#c8a36a",
  flow: { materie: "#3d8fe0", finit: "#5fae3a", igiena: "#ef7d22" } as Record<string, string>,
  status: { lucreaza: "#3fbf4f", asteapta: "#e8b923", terminat: "#3a7bd5", oprita: "#7d8288", late: "#e5332a" } as Record<string, string>,
};
const W2 = HALL.w / 2, D2 = HALL.d / 2;

export type Zone = "all" | "plan" | "productie" | "cantare" | "spalare" | "receptie" | "depozit" | "livrare";
export const ZONES: Record<Zone, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  all: { pos: [-10, 62, 58], target: [0, 0, 2], label: "Toată fabrica" },
  plan: { pos: [0, 52, 0.01], target: [0, 0, 0], label: "Hala de sus" },
  productie: { pos: [-4, 36, 30], target: [0, 0, 0], label: "Hala de producție" },
  cantare: { pos: [-2, 17, 6], target: [1, 0, -10], label: "Cântare & flowpack" },
  spalare: { pos: [-6, 16, 24], target: [5, 0, 8], label: "Spălare & mese" },
  receptie: { pos: [-38, 18, 46], target: [-22, 0, 30], label: "Poartă & recepție" },
  depozit: { pos: [0, 16, 46], target: [0, 0, 28], label: "Depozit MP (frig)" },
  livrare: { pos: [20, 20, -52], target: [6, 0, -29], label: "Picking & livrare" },
};

export type Selection = { kind: "line"; id: string } | { kind: "station"; id: string } | { kind: "receptie" } | { kind: "depozit" } | { kind: "livrare" } | null;

function useFloorTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = C.floor; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) { const v = 170 + Math.random() * 30; g.fillStyle = `rgba(${v},${v + 3},${v - 4},0.25)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    for (let i = 0; i < 30; i++) { g.fillStyle = "rgba(120,130,140,0.08)"; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, 20 + Math.random() * 40, 10 + Math.random() * 20, Math.random() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "rgba(0,0,0,0.07)"; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 64) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(HALL.w / 6, HALL.d / 6); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }, []);
}

function useBeltTexture(len: number) {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 16; const g = c.getContext("2d")!;
    g.fillStyle = C.belt; g.fillRect(0, 0, 64, 16); g.fillStyle = "#3d4346"; for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 16);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(len * 2, 1); return t;
  }, [len]);
}

function Lettuce({ seed = 0, scale = 1, red = false }: { seed?: number; scale?: number; red?: boolean }) {
  const leaves = useMemo(() => Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2 + seed;
    return { p: [Math.cos(a) * 0.12, 0.08 + (i % 2) * 0.04, Math.sin(a) * 0.12] as [number, number, number], c: red && i % 2 ? C.leaf[4] : C.leaf[(i + Math.floor(seed * 10)) % 4] };
  }), [seed, red]);
  return (
    <group scale={scale}>
      {leaves.map((l, i) => (<mesh key={i} position={l.p} scale={[1, 0.6, 1]}><sphereGeometry args={[0.14, 7, 5]} /><meshStandardMaterial color={l.c} roughness={0.8} /></mesh>))}
    </group>
  );
}

function Crate({ position, color = C.crateBlue, full = true, seed = 0 }: { position: [number, number, number]; color?: string; full?: boolean; seed?: number }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.15, 0]}><boxGeometry args={[0.6, 0.3, 0.4]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      {full && <group position={[0, 0.24, 0]}><group position={[-0.13, 0, 0]}><Lettuce seed={seed} scale={0.7} /></group><group position={[0.13, 0, 0]}><Lettuce seed={seed + 1.3} scale={0.7} red={seed % 3 < 1} /></group></group>}
    </group>
  );
}

function Pallet({ position, children, rotY = 0 }: { position: [number, number, number]; children?: React.ReactNode; rotY?: number }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh castShadow receiveShadow position={[0, 0.07, 0]}><boxGeometry args={[1.2, 0.14, 0.8]} /><meshStandardMaterial color="#b48a5a" roughness={0.9} /></mesh>
      <group position={[0, 0.14, 0]}>{children}</group>
    </group>
  );
}

function CrateStack({ position, levels, seed = 0, full = true }: { position: [number, number, number]; levels: number; seed?: number; full?: boolean }) {
  return (
    <Pallet position={position}>
      {Array.from({ length: levels }).map((_, k) => [-0.3, 0.3].map((x, j) => (
        <Crate key={`${k}${j}`} position={[x, k * 0.3, 0]} full={full && k === levels - 1} seed={seed + k + j} color={(k + j) % 3 === 0 ? C.crateGrey : C.crateBlue} />
      )))}
    </Pallet>
  );
}

function Worker({ position, phase = 0, rotY = 0, sitting = false }: { position: [number, number, number]; phase?: number; rotY?: number; sitting?: boolean }) {
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null); const armR = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + phase;
    if (body.current) body.current.position.y = (sitting ? -0.25 : 0) + Math.abs(Math.sin(t)) * 0.02;
    if (armL.current) armL.current.rotation.x = -1 + Math.sin(t) * 0.45;
    if (armR.current) armR.current.rotation.x = -1 + Math.cos(t) * 0.45;
  });
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group ref={body}>
        <mesh castShadow position={[0, 0.55, 0]}><capsuleGeometry args={[0.2, 0.55, 4, 8]} /><meshStandardMaterial color={C.coat} /></mesh>
        <mesh castShadow position={[0, 1.1, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color={C.skin} /></mesh>
        <mesh position={[0, 1.18, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.165, 10, 6]} /><meshStandardMaterial color={C.net} /></mesh>
        <mesh ref={armL} position={[-0.24, 0.8, 0.05]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
        <mesh ref={armR} position={[0.24, 0.8, 0.05]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
      </group>
      {sitting && <mesh position={[0, 0.25, 0.1]}><cylinderGeometry args={[0.18, 0.18, 0.05, 12]} /><meshStandardMaterial color={C.darkSteel} /></mesh>}
    </group>
  );
}

function Tray({ i }: { i: number }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]}><boxGeometry args={[0.3, 0.1, 0.22]} /><meshStandardMaterial color="#e8f4ea" transparent opacity={0.75} roughness={0.2} /></mesh>
      <mesh position={[0, 0.07, 0]} scale={[1.3, 0.45, 1]}><sphereGeometry args={[0.08, 7, 5]} /><meshStandardMaterial color={C.leaf[i % 4]} /></mesh>
    </group>
  );
}

/** Conveyor along local z, from z0 to z1, with trays riding it while the line runs. */
function Conveyor({ z0, z1, x = 0, y = 0.8, width = 0.6, running, items = 6, slope = 0 }: { z0: number; z1: number; x?: number; y?: number; width?: number; running: boolean; items?: number; slope?: number }) {
  const len = Math.abs(z1 - z0);
  const tex = useBeltTexture(len);
  const packs = useRef<THREE.Group>(null);
  const dir = Math.sign(z1 - z0) || 1;
  useFrame((_, d) => {
    if (!running) return;
    const dt = Math.min(d, 0.05);
    tex.offset.x -= dt * 0.8;
    packs.current?.children.forEach((ch) => { ch.position.x += dt * 0.6; if (ch.position.x > len / 2 - 0.2) ch.position.x = -len / 2 + 0.2; });
  });
  const ang = Math.atan2(slope, len);
  return (
    <group position={[x, y + slope / 2, (z0 + z1) / 2]} rotation={[0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <group rotation={[0, 0, ang * (dir > 0 ? 1 : 1)]}>
        <mesh castShadow receiveShadow><boxGeometry args={[Math.hypot(len, slope), 0.08, width]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
        {[-width / 2, width / 2].map((zz) => (<mesh key={zz} position={[0, 0.06, zz]}><boxGeometry args={[Math.hypot(len, slope), 0.1, 0.05]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.25} /></mesh>))}
        <group ref={packs} position={[0, 0.04, 0]}>
          {running && Array.from({ length: items }).map((_, i) => (<group key={i} position={[-len / 2 + 0.3 + i * ((len - 0.6) / items), 0, 0]}><Tray i={i} /></group>))}
        </group>
      </group>
      {Array.from({ length: Math.max(2, Math.round(len / 1.5)) }).map((_, i, a) => (
        <mesh key={i} position={[-len / 2 + 0.2 + i * ((len - 0.4) / (a.length - 1)), -(y + slope / 2) / 2 + (slope * ((i / (a.length - 1)) - 0.5)) / 2, 0]}>
          <boxGeometry args={[0.06, y + slope / 2 + slope * ((i / (a.length - 1)) - 0.5), width - 0.1]} /><meshStandardMaterial color={C.darkSteel} metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function RotaryTable({ position, running, r = 0.9 }: { position: [number, number, number]; running: boolean; r?: number }) {
  const disc = useRef<THREE.Group>(null);
  useFrame((_, d) => { if (running && disc.current) disc.current.rotation.y += Math.min(d, 0.05) * 0.5; });
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]}><cylinderGeometry args={[0.12, 0.25, 0.8, 10]} /><meshStandardMaterial color={C.darkSteel} metalness={0.6} /></mesh>
      <group ref={disc} position={[0, 0.85, 0]}>
        <mesh castShadow receiveShadow><cylinderGeometry args={[r, r, 0.06, 32]} /><meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} /></mesh>
        {running && Array.from({ length: 8 }).map((_, i) => { const a = (i / 8) * Math.PI * 2; return <group key={i} position={[Math.cos(a) * r * 0.7, 0.03, Math.sin(a) * r * 0.7]} rotation={[0, -a, 0]}><Tray i={i} /></group>; })}
      </group>
    </group>
  );
}

/** Multihead weigher on a platform fed by a blue Z-elevator, bagger underneath (as in the hall photos). */
function Weigher({ running }: { running: boolean }) {
  const head = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (running && head.current) head.current.children.forEach((c, i) => { c.position.y = Math.max(0, Math.sin(clock.elapsedTime * 4 + i)) * 0.05; }); });
  return (
    <group>
      {[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([x, z]) => (<mesh key={`${x}${z}`} position={[x, 1.2, z]} castShadow><boxGeometry args={[0.1, 2.4, 0.1]} /><meshStandardMaterial color={C.steel} metalness={0.7} /></mesh>))}
      <mesh position={[0, 2.45, 0]} castShadow receiveShadow><boxGeometry args={[2.8, 0.1, 2.8]} /><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.35} /></mesh>
      {[-1.38, 1.38].map((x) => (<mesh key={x} position={[x, 2.9, 0]}><boxGeometry args={[0.04, 0.04, 2.8]} /><meshStandardMaterial color={C.steel} metalness={0.8} /></mesh>))}
      <mesh position={[0, 3.0, 0]} castShadow><cylinderGeometry args={[0.95, 0.35, 0.9, 16]} /><meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} /></mesh>
      <group ref={head} position={[0, 3.55, 0]}>
        {Array.from({ length: 14 }).map((_, i) => { const a = (i / 14) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]} rotation={[0, -a, 0]} castShadow><boxGeometry args={[0.28, 0.32, 0.38]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} /></mesh>; })}
      </group>
      <mesh position={[0, 3.95, 0]}><coneGeometry args={[0.5, 0.5, 14]} /><meshStandardMaterial color={C.steel} metalness={0.85} /></mesh>
      <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[0.9, 1.6, 0.9]} /><meshStandardMaterial color={C.steel} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.6, 0.46]}><planeGeometry args={[0.4, 0.25]} /><meshStandardMaterial color="#123" emissive={running ? "#39d353" : "#223"} emissiveIntensity={0.9} /></mesh>
      {/* Z-elevator */}
      <group position={[1.9, 0, -0.4]} rotation={[0, 0, 0]}>
        <mesh position={[0, 2.1, -1.1]} rotation={[-0.95, 0, 0]} castShadow><boxGeometry args={[0.5, 0.12, 4.6]} /><meshStandardMaterial color={C.elevator} roughness={0.5} /></mesh>
        <mesh position={[0, 0.35, -2.8]}><boxGeometry args={[0.7, 0.7, 0.7]} /><meshStandardMaterial color={C.steel} metalness={0.6} /></mesh>
        <mesh position={[-0.9, 3.95, 0.3]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.12, 1.6, 0.5]} /><meshStandardMaterial color={C.elevator} /></mesh>
        {running && <group position={[0, 0.85, -2.8]}><Lettuce seed={2} scale={1.2} /></group>}
      </group>
    </group>
  );
}

function FlowPacker({ running }: { running: boolean }) {
  const roll = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (running && roll.current) roll.current.rotation.x += Math.min(d, 0.05) * 3; });
  return (
    <group>
      <RoundedBox args={[1.1, 1.2, 1.6]} radius={0.05} position={[0, 0.9, 0.6]} castShadow><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></RoundedBox>
      <mesh ref={roll} position={[0, 1.75, 0.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.8, 18]} /><meshStandardMaterial color="#dfe9ef" roughness={0.3} /></mesh>
      <mesh position={[0, 1.2, 1.41]}><planeGeometry args={[0.4, 0.25]} /><meshStandardMaterial color="#123" emissive={running ? "#39d353" : "#223"} emissiveIntensity={0.9} /></mesh>
      <Conveyor z0={-1.6} z1={-0.2} running={running} width={0.4} items={3} />
      <Conveyor z0={1.4} z1={2.0} y={0.7} running={running} width={0.5} items={1} />
    </group>
  );
}

function SteelTable({ position, w = 2.6, d = 1.2, rotY = 0, children }: { position: [number, number, number]; w?: number; d?: number; rotY?: number; children?: React.ReactNode }) {
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh position={[0, 0.88, 0]} castShadow receiveShadow><boxGeometry args={[w, 0.05, d]} /><meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} /></mesh>
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => (<mesh key={`${a}${b}`} position={[a * (w / 2 - 0.08), 0.43, b * (d / 2 - 0.08)]}><boxGeometry args={[0.05, 0.86, 0.05]} /><meshStandardMaterial color={C.steel} metalness={0.8} /></mesh>))}
      <mesh position={[0, 0.2, 0]}><boxGeometry args={[w - 0.1, 0.03, d - 0.1]} /><meshStandardMaterial color={C.steel} metalness={0.8} /></mesh>
      <group position={[0, 0.9, 0]}>{children}</group>
    </group>
  );
}

function WaterTank({ position, size, running }: { position: [number, number, number]; size: [number, number, number]; running: boolean }) {
  const water = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (water.current) water.current.opacity = running ? 0.65 + Math.sin(clock.elapsedTime * 3) * 0.1 : 0.5; });
  const [w, h, d] = size;
  return (
    <group position={position}>
      {[[0, -d / 2, w, 0.06], [0, d / 2, w, 0.06]].map(([x, z, ww, dd], i) => (<mesh key={i} position={[x, h / 2, z]} castShadow><boxGeometry args={[ww, h, dd]} /><meshStandardMaterial color={C.steel} metalness={0.75} roughness={0.3} /></mesh>))}
      {[-w / 2, w / 2].map((x) => (<mesh key={x} position={[x, h / 2, 0]} castShadow><boxGeometry args={[0.06, h, d]} /><meshStandardMaterial color={C.steel} metalness={0.75} roughness={0.3} /></mesh>))}
      <mesh position={[0, 0.15, 0]}><boxGeometry args={[w, 0.3, d]} /><meshStandardMaterial color={C.steel} metalness={0.7} /></mesh>
      <mesh position={[0, h - 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[w - 0.1, d - 0.1]} /><meshStandardMaterial ref={water} color={C.water} transparent opacity={0.6} roughness={0.05} metalness={0.2} /></mesh>
      {running && Array.from({ length: 5 }).map((_, i) => (<group key={i} position={[-w / 2 + 0.4 + (i * (w - 0.8)) / 4, h - 0.15, (i % 2 ? 0.2 : -0.2) * d]}><Lettuce seed={i} scale={0.8} /></group>))}
    </group>
  );
}

function Dryer({ position, running }: { position: [number, number, number]; running: boolean }) {
  const drum = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (running && drum.current) drum.current.rotation.y += Math.min(d, 0.05) * 8; });
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.9, 1, 0.9]} /><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></mesh>
      <mesh ref={drum} position={[0, 1.05, 0]}><cylinderGeometry args={[0.38, 0.38, 0.12, 12]} /><meshStandardMaterial color={C.darkSteel} metalness={0.6} /></mesh>
    </group>
  );
}

function StationModel({ st, running, busy }: { st: Station; running: boolean; busy: boolean }) {
  if (st.kind === "cantar" || st.kind === "giostra") {
    const giostra = st.kind === "giostra";
    return (
      <group>
        <Weigher running={running} />
        {giostra ? <>
          <RotaryTable position={[-2.8, 0, -5.7]} running={running} />
          <group position={[-2.5, 0, -3]}><FlowPacker running={running} /></group>
          <Conveyor z0={1.6} z1={5.6} running={running} />
          <SteelTable position={[0, 0, 6.6]} w={1.4} d={1.2} />
        </> : <>
          <RotaryTable position={[-0.3, 0, -6.4]} running={running} />
          <Conveyor z0={-5.3} z1={-1.6} running={running} items={4} />
          <Conveyor z0={1.6} z1={6.2} running={running} />
        </>}
        <CrateStack position={[-1.9, 0, giostra ? -1.5 : -4.2]} levels={busy ? 4 : 1} full={busy} seed={st.px} />
        <CrateStack position={[-1.9, 0, giostra ? 3 : 3.2]} levels={busy ? 3 : 1} full={busy} seed={st.py} />
      </group>
    );
  }
  if (st.kind === "flowpack") return (
    <group>
      <RotaryTable position={[0.3, 0, -2.2]} running={running} r={0.75} />
      <FlowPacker running={running} />
      <SteelTable position={[0, 0, 3.2]} w={1} d={1.6} />
      <CrateStack position={[1.6, 0, 0]} levels={busy ? 3 : 1} full={busy} seed={st.py} />
    </group>
  );
  if (st.kind === "masa") return (
    <group>
      <SteelTable position={[0, 0, 0]} w={2.6} d={1.3}>
        {running && Array.from({ length: 6 }).map((_, i) => (<group key={i} position={[-1 + (i % 3) * 1, 0, i < 3 ? -0.3 : 0.3]}><Tray i={i} /></group>))}
      </SteelTable>
      <CrateStack position={[2.1, 0, 0]} levels={busy ? 3 : 1} full={busy} seed={st.px} />
    </group>
  );
  if (st.kind === "utilaj") return (
    <group>
      <RoundedBox args={[2, 1.4, 1.6]} radius={0.06} position={[0, 0.7, 0]} castShadow><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></RoundedBox>
      <mesh position={[0, 1.5, 0.81]}><boxGeometry args={[0.8, 0.35, 0.02]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
      <CrateStack position={[1.6, 0, 0]} levels={busy ? 3 : 1} full={busy} seed={st.px} />
    </group>
  );
  if (st.kind === "spalare_manual") return (
    <group>
      <WaterTank position={[0.3, 0, -1.4]} size={[3, 1, 0.9]} running={running} />
      <WaterTank position={[0.3, 0, -0.3]} size={[3, 1, 0.9]} running={running} />
      <Dryer position={[-1, 0, 0.6]} running={running} />
      <Dryer position={[-1, 0, 1.6]} running={running} />
      <CrateStack position={[1.4, 0, 1.3]} levels={busy ? 3 : 1} full={busy} seed={3} />
    </group>
  );
  // linia automată de spălat: intrare jos (de la poarta de materie primă), ieșire sus spre mese/cântare
  return (
    <group>
      <WaterTank position={[0, 0, 7.6]} size={[2.4, 1.1, 3]} running={running} />
      <Conveyor z0={5.8} z1={3.2} y={0.9} slope={1.0} width={1} running={running} items={5} />
      <WaterTank position={[0, 0, 0.6]} size={[2.4, 1.1, 4.4]} running={running} />
      <Conveyor z0={-1.8} z1={-3.6} y={1.2} width={1} running={running} items={3} />
      <group position={[0, 0, -4.8]}>
        <mesh position={[0, 1.2, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><cylinderGeometry args={[0.9, 0.9, 2.2, 18]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} /></mesh>
        <mesh position={[0, 0.35, 0]}><boxGeometry args={[2.2, 0.7, 1.4]} /><meshStandardMaterial color={C.darkSteel} metalness={0.5} /></mesh>
      </group>
      <Conveyor z0={-6} z1={-9.2} y={0.9} slope={1.4} width={1} running={running} items={4} />
      <Dryer position={[-2.6, 0, -2]} running={running} />
      <Dryer position={[-2.6, 0, -0.8]} running={running} />
    </group>
  );
}

function LateBeacon({ minutes }: { minutes: number }) {
  const g = useRef<THREE.Group>(null);
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) { g.current.position.y = 5.3 + Math.sin(t * 2.5) * 0.15; g.current.rotation.y = t * 1.5; }
    if (light.current) light.current.intensity = 4 + Math.sin(t * 6) * 3;
  });
  return (
    <group ref={g} position={[0, 5.3, 0]}>
      <mesh><octahedronGeometry args={[0.45]} /><meshStandardMaterial color={C.status.late} emissive={C.status.late} emissiveIntensity={1.6} /></mesh>
      <pointLight ref={light} color={C.status.late} distance={7} intensity={5} />
      <Html center position={[0, 0.8, 0]} distanceFactor={18} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded bg-destructive px-1.5 py-0.5 text-[11px] font-black text-destructive-foreground shadow">⚠ +{minutesLabel(minutes)}</div>
      </Html>
    </group>
  );
}

function StationCard({ st, line }: { st: Station; line?: LineView }) {
  if (!line) return <div className="whitespace-nowrap rounded bg-card/80 px-1.5 py-0.5 text-[10px] text-muted-foreground shadow">{st.label} · nealocat</div>;
  const p = line.pace;
  const late = p.status === "intarziat";
  return (
    <div className={`w-52 rounded-lg border bg-card/95 p-2 text-card-foreground shadow-lg ${late ? "border-destructive ring-2 ring-destructive/60" : ""}`}>
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold"><span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: late ? C.status.late : C.status[line.status] }} /><span className="truncate">{line.name}</span></div>
        <PaceBadge pace={p} />
      </div>
      {p.orders.length > 0 ? <>
        <div className="truncate text-[10px] font-medium">{p.orders[0].product}{p.orders.length > 1 ? ` +${p.orders.length - 1} comenzi` : ""}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">început {clockTime(p.startedAt)} · lucrat {minutesLabel(p.workedHours * 60)} · {line.workers} oameni</div>
        {p.normHours != null ? (
          <div className={`text-[10px] tabular-nums ${late ? "font-bold text-destructive" : ""}`}>
            {late ? `trebuia gata la ${clockTime(p.dueAt)}` : `gata la ~${clockTime(p.dueAt)}`} · {p.qty.toLocaleString("ro-RO")} buc la {line.norm}/h
          </div>
        ) : <div className="text-[10px] text-muted-foreground">Linia nu are normă setată</div>}
      </> : (
        <div className="text-[10px] text-muted-foreground">{line.status === "lucreaza" ? "Lucrează pe o comandă din altă zi" : line.status === "asteapta" ? (line.ordersTotal ? `Oprită · ${p.queueOrders} comenzi așteaptă` : "Fără comenzi azi") : line.status === "terminat" ? "Tot ce avea azi e gata" : "Linie inactivă"}</div>
      )}
      {line.pieces > 0 && <div className="mt-1 h-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.round((line.produced / line.pieces) * 100)}%` }} /></div>}
    </div>
  );
}

function StationNode({ st, line, selected, onSelect, editing, onGrab }: { st: Station; line?: LineView; selected: boolean; onSelect: () => void; editing?: boolean; onGrab?: (offset: [number, number]) => void }) {
  const [x, z] = toWorld(st.px, st.py);
  const running = line?.status === "lucreaza";
  const busy = !!line && (line.pace.orders.length > 0 || line.pace.queueOrders > 0);
  const late = line?.pace.status === "intarziat";
  const sc = late ? C.status.late : line ? C.status[line.status] : C.status.oprita;
  const andon = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => { if (andon.current) andon.current.emissiveIntensity = late ? 1 + Math.abs(Math.sin(clock.elapsedTime * 5)) * 2 : 1.3; });
  const big = st.kind === "cantar" || st.kind === "giostra" || st.kind === "spalare_auto";
  const footprint: [number, number] = st.kind === "spalare_auto" ? [6.5, 20] : st.kind === "cantar" || st.kind === "giostra" ? [5, 15] : st.kind === "utilaj" ? [4, 3] : st.kind === "flowpack" ? [3.4, 7] : st.kind === "spalare_manual" ? [4.6, 4.4] : [5, 2.4];
  const workers = running ? Math.min(Math.max(1, line!.workers), 8) : 0;
  const spots: [number, number, number][] = st.kind === "cantar" || st.kind === "giostra"
    ? (st.kind === "giostra" ? [[-3.9, 0, -5.7], [-1.8, 0, -5.9], [-2.8, 0, -4.6], [0.7, 0, 3], [-0.7, 0, 4.2], [0.7, 0, 5], [0, 0, 7.5], [-0.7, 0, 2.4]]
      : [[-1.4, 0, -6.4], [0.8, 0, -6.6], [-0.3, 0, -7.5], [0.7, 0, 2.6], [-0.7, 0, 3.6], [0.7, 0, 4.8], [-0.7, 0, 5.6], [0.6, 0, -4]])
    : st.kind === "flowpack" ? [[-0.6, 0, -2.4], [1.1, 0, -2.6], [0.8, 0, 3.2], [-0.8, 0, 3.4], [0.3, 0, -3.2], [-0.8, 0, 1], [0.8, 0, 1.5], [-0.8, 0, 2.4]]
    : st.kind === "masa" || st.kind === "utilaj" ? [[-0.9, 0, -0.95], [0, 0, -0.95], [0.9, 0, -0.95], [-0.9, 0, 0.95], [0, 0, 0.95], [0.9, 0, 0.95], [-1.6, 0, 0], [1.6, 0, 0.9]]
    : st.kind === "spalare_manual" ? [[0.3, 0, -2.2], [-0.8, 0, -2.2], [1.4, 0, -2.2], [-1.8, 0, 1], [0, 0, 0.6], [1.4, 0, 0.4], [-1.8, 0, 2.2], [0.4, 0, 1.6]]
    : [[-1.8, 0, 7.6], [-1.8, 0, 1], [-1.8, 0, -4.8], [1.8, 0, 3], [1.8, 0, -1], [-3.4, 0, -1.4], [1.8, 0, -7], [-1.8, 0, 4.5]];
  return (
    <group position={[x, 0, z]}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerDown={(e) => { if (!editing || !onGrab) return; e.stopPropagation(); onSelect(); onGrab([x - e.point.x, z - e.point.z]); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = editing ? "grab" : "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      <group rotation={[0, -((st.rot || 0) * Math.PI) / 180, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={footprint} />
        <meshBasicMaterial color={editing && selected ? C.status.lucreaza : sc} transparent opacity={selected ? 0.32 : editing ? 0.16 : late ? 0.2 : 0.07} />
      </mesh>
      <StationModel st={st} running={running} busy={busy} />
      {Array.from({ length: workers }).map((_, i) => {
        const p = spots[i % spots.length];
        return <Worker key={i} position={p} rotY={Math.atan2(-p[0], -p[2])} phase={i * 1.7} sitting={st.kind === "masa" && i < 6} />;
      })}
      <group position={[big ? 2.2 : 1.4, 0, big ? 1.4 : -1]}>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.03, 0.03, 2.2]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
        <mesh position={[0, 2.3, 0]}><cylinderGeometry args={[0.12, 0.12, 0.35, 12]} /><meshStandardMaterial ref={andon} color={sc} emissive={sc} emissiveIntensity={1.3} /></mesh>
      </group>
      </group>
      {late && <LateBeacon minutes={line!.pace.lateMinutes} />}
      <Html position={[0, big ? 6.4 : 3.2, 0]} center distanceFactor={20} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <StationCard st={st} line={line} />
      </Html>
    </group>
  );
}

function FlowStripe({ pts, color }: { pts: [number, number][]; color: string }) {
  const segs = pts.slice(1).map((p, i) => {
    const [ax, az] = toWorld(...pts[i]); const [bx, bz] = toWorld(...p);
    return { x: (ax + bx) / 2, z: (az + bz) / 2, len: Math.hypot(bx - ax, bz - az) + 0.25, rot: Math.atan2(bx - ax, bz - az) };
  });
  return <>{segs.map((s, i) => (<mesh key={i} position={[s.x, 0.014, s.z]} rotation={[-Math.PI / 2, 0, s.rot]}><planeGeometry args={[0.25, s.len]} /><meshBasicMaterial color={color} transparent opacity={0.85} /></mesh>))}</>;
}

/** Crates riding a floor flow while the hall works: raw material in, finished cartons out. */
function FlowMovers({ pts, kind, count }: { pts: [number, number][]; kind: string; count: number }) {
  const path = useMemo(() => {
    const cp = new THREE.CurvePath<THREE.Vector3>();
    pts.slice(1).forEach((p, i) => { const [ax, az] = toWorld(...pts[i]); const [bx, bz] = toWorld(...p); cp.add(new THREE.LineCurve3(new THREE.Vector3(ax, 0, az), new THREE.Vector3(bx, 0, bz))); });
    return cp;
  }, [pts]);
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const L = path.getLength();
    ref.current?.children.forEach((ch, i) => {
      const t = ((clock.elapsedTime * 0.7) / L + i / count) % 1;
      ch.position.copy(path.getPointAt(t));
    });
  });
  return (
    <group ref={ref}>
      {Array.from({ length: count }).map((_, i) => (
        <group key={i}>
          {kind === "materie" ? <Crate position={[0, 0.02, 0]} seed={i} /> : <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.5, 0.35, 0.4]} /><meshStandardMaterial color={C.carton} /></mesh>}
        </group>
      ))}
    </group>
  );
}

function Truck({ from, to, label, delay = 0, loop = 22 }: { from: [number, number, number]; to: [number, number, number]; label?: string; delay?: number; loop?: number }) {
  const ref = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(...from), [from]); const b = useMemo(() => new THREE.Vector3(...to), [to]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime + delay) % loop) / loop;
    const k = t < 0.25 ? THREE.MathUtils.smoothstep(t / 0.25, 0, 1) : t < 0.75 ? 1 : 1 - THREE.MathUtils.smoothstep((t - 0.75) / 0.25, 0, 1);
    ref.current.position.lerpVectors(a, b, k);
  });
  const dir = Math.atan2(to[0] - from[0], to[2] - from[2]);
  return (
    <group ref={ref} position={from}>
      <group rotation={[0, dir + Math.PI, 0]}>
        <RoundedBox args={[1.5, 1.6, 3.6]} radius={0.05} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color={C.truck} roughness={0.5} /></RoundedBox>
        <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[1.52, 0.18, 3.62]} /><meshStandardMaterial color={C.stripe} /></mesh>
        <RoundedBox args={[1.45, 1.2, 1]} radius={0.08} position={[0, 0.95, -2.3]} castShadow><meshStandardMaterial color={C.cab} metalness={0.3} roughness={0.4} /></RoundedBox>
        <mesh position={[0, 1.15, -2.81]}><planeGeometry args={[1.2, 0.5]} /><meshStandardMaterial color="#9fc7de" metalness={0.8} roughness={0.1} /></mesh>
        {[-1.2, 0.9, -2.3].map((z) => [-0.7, 0.7].map((x) => (<mesh key={`${z}${x}`} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 14]} /><meshStandardMaterial color="#222" /></mesh>)))}
      </group>
      {label && <Html position={[0, 2.8, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded border bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-card-foreground shadow">{label}</div></Html>}
    </group>
  );
}

function Forklift({ path, speed = 0.12, phase = 0 }: { path: [number, number][]; speed?: number; phase?: number }) {
  const ref = useRef<THREE.Group>(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(path.map(([x, z]) => new THREE.Vector3(x, 0, z)), true), [path]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = (clock.elapsedTime * speed + phase) % 1;
    const p = curve.getPointAt(t); const q = curve.getPointAt((t + 0.01) % 1);
    ref.current.position.copy(p); ref.current.rotation.y = Math.atan2(q.x - p.x, q.z - p.z);
  });
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.45, 0]}><boxGeometry args={[0.8, 0.6, 1.2]} /><meshStandardMaterial color="#e8b923" /></mesh>
      {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 0.8, -0.45]}><boxGeometry args={[0.04, 0.9, 0.04]} /><meshStandardMaterial color="#333" /></mesh>)}
      <mesh position={[0, 0.9, 0.85]}><boxGeometry args={[0.7, 1.2, 0.05]} /><meshStandardMaterial color="#555" /></mesh>
      <group position={[0, 0.25, 0.95]}><Crate position={[0, 0, 0]} seed={phase * 7} /></group>
    </group>
  );
}

function ZoneSign({ position, title, sub }: { position: [number, number, number]; title: string; sub?: string }) {
  return (
    <Html position={position} center distanceFactor={26} style={{ pointerEvents: "none" }}>
      <div className="whitespace-nowrap rounded-md bg-foreground/85 px-3 py-1 text-center text-background shadow-lg">
        <div className="text-sm font-black uppercase tracking-wider">{title}</div>
        {sub && <div className="text-[10px] opacity-80">{sub}</div>}
      </div>
    </Html>
  );
}

function Clickable({ onSelect, children }: { onSelect: () => void; children: React.ReactNode }) {
  return <group onClick={(e) => { e.stopPropagation(); onSelect(); }} onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>{children}</group>;
}

function CameraRig({ zone, controls }: { zone: Zone; controls: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const goal = useRef({ zone, active: true });
  const first = useRef(true);
  if (goal.current.zone !== zone) goal.current = { zone, active: true };
  useFrame((_, d) => {
    if (!goal.current.active || !controls.current) return;
    const z = ZONES[goal.current.zone]; const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    const p = new THREE.Vector3(...z.pos); const t = new THREE.Vector3(...z.target);
    if (first.current) { first.current = false; camera.position.copy(p); controls.current.target.copy(t); controls.current.update(); goal.current.active = false; return; }
    camera.position.lerp(p, k); controls.current.target.lerp(t, k); controls.current.update();
    if (camera.position.distanceTo(p) < 0.2) goal.current.active = false;
  });
  return null;
}

/** Hall shell from the plan: cut-away walls with the raw-material gate (south) and dispatch exit (north), pillars, staff rooms. */
function HallShell() {
  const floor = useFloorTexture();
  const gateX = toWorld(375, 0)[0], exitX = toWorld(610, 0)[0];
  const wall = (x: number, z: number, w: number, d: number, k: string) => (<mesh key={k} position={[x, 0.7, z]} castShadow receiveShadow><boxGeometry args={[w, 1.4, d]} /><meshStandardMaterial color={C.wall} /></mesh>);
  const seg = (a: number, b: number, z: number, k: string) => wall((a + b) / 2, z, b - a, 0.3, k);
  const [ox0, oz0] = toWorld(0, 930); const [ox1] = toWorld(215, 1200);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.005, 0]}><planeGeometry args={[HALL.w, HALL.d]} /><meshStandardMaterial map={floor} roughness={0.55} metalness={0.05} /></mesh>
      {wall(-W2, 0, 0.3, HALL.d, "w")}{wall(W2, 0, 0.3, HALL.d, "e")}
      {seg(-W2, gateX - 1.8, D2, "s1")}{seg(gateX + 1.8, W2, D2, "s2")}
      {seg(-W2, exitX - 1.6, -D2, "n1")}{seg(exitX + 1.6, W2, -D2, "n2")}
      {Array.from({ length: 7 }).flatMap((_, i) => { const z = -D2 + (i * HALL.d) / 6; return [-W2, W2].map((x) => (<mesh key={`p${i}${x}`} position={[x, 1.6, z]}><boxGeometry args={[0.55, 3.2, 0.55]} /><meshStandardMaterial color={C.pillar} /></mesh>)); })}
      {/* vestiare / birouri (colțul de jos-stânga din plan) */}
      <group>
        <mesh position={[(ox0 + ox1) / 2, 1.3, oz0]}><boxGeometry args={[ox1 - ox0, 2.6, 0.25]} /><meshStandardMaterial color={C.pillar} /></mesh>
        <mesh position={[ox1, 1.3, (oz0 + D2) / 2]}><boxGeometry args={[0.25, 2.6, D2 - oz0]} /><meshStandardMaterial color={C.pillar} /></mesh>
        <mesh position={[(ox0 + ox1) / 2 - 1, 1.3, (oz0 + D2) / 2]}><boxGeometry args={[0.2, 2.6, D2 - oz0 - 2]} /><meshStandardMaterial color={C.pillar} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(ox0 + ox1) / 2, 0.01, (oz0 + D2) / 2]}><planeGeometry args={[ox1 - ox0, D2 - oz0]} /><meshStandardMaterial color="#9a9d97" /></mesh>
        <Html position={[(ox0 + ox1) / 2, 3.2, (oz0 + D2) / 2]} center distanceFactor={26} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded bg-card/85 px-1.5 py-0.5 text-[10px] text-muted-foreground">Vestiare · birouri</div></Html>
      </group>
      {FIXTURES.map((f) => { const [x, z] = toWorld(f.px, f.py); return (
        <group key={f.label} position={[x, 0, z]}>
          <RoundedBox args={[(f.w / 780) * HALL.w, 1.3, (f.d / 1200) * HALL.d]} radius={0.05} position={[0, 0.65, 0]} castShadow><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></RoundedBox>
          <Html position={[0, 1.8, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded bg-card/85 px-1 text-[9px] text-muted-foreground">{f.label}</div></Html>
        </group>); })}
      {FLOWS.map((f, i) => <FlowStripe key={i} pts={f.pts} color={C.flow[f.kind]} />)}
    </group>
  );
}

export function FactoryScene({ data: raw, zone, selection, onSelect, layout: layoutProp, editing = false, onMove }: {
  data: FactoryData; zone: Zone; selection: Selection; onSelect: (s: Selection) => void;
  /** Hall being edited (draft); defaults to the saved layout. */
  layout?: HallStation[]; editing?: boolean; onMove?: (id: string, px: number, py: number) => void;
}) {
  // Every list may still be loading (or missing while the page reloads): draw empty zones instead of crashing.
  const data = {
    ...raw,
    lineViews: raw?.lineViews ?? [], receptions: raw?.receptions ?? [], prereceptions: raw?.prereceptions ?? [],
    stock: raw?.stock ?? [], ready: raw?.ready ?? [],
  };
  const controls = useRef<any>(null);
  const byId = new Map(data.lineViews.map((l) => [l.id, l]));
  const layout = layoutProp ?? raw?.layout ?? [];
  const byStation = new Map<string, string>();
  for (const st of layout) if (st.lineId && byId.has(st.lineId) && ![...byStation.values()].includes(st.lineId)) byStation.set(st.id, st.lineId);
  // Dragging a machine across the floor in edit mode: the camera stays still while a finger/mouse is down.
  const [drag, setDrag] = useState<{ id: string; off: [number, number] } | null>(null);
  useEffect(() => {
    if (!drag) return;
    const up = () => { setDrag(null); document.body.style.cursor = ""; if (controls.current) controls.current.enabled = true; };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [drag]);
  useEffect(() => { if (!editing) setDrag(null); }, [editing]);
  const working = data.lineViews.filter((l) => l.status === "lucreaza");
  const late = data.lineViews.filter((l) => l.pace.status === "intarziat");
  const stock = data.stock.slice(0, 12);
  const maxStock = Math.max(1, ...stock.map((s) => s.qty));
  const ready = data.ready.slice(0, 10);
  const maxReady = Math.max(1, ...ready.map((r) => r.pieces));
  const recTrucks = Math.min(3, data.receptions.length);
  const outTrucks = ready.slice(0, 3);
  const exitX = toWorld(610, 0)[0];

  return (
    <>
      <color attach="background" args={["#dfe7ea"]} />
      <fog attach="fog" args={["#dfe7ea", 90, 190]} />
      <hemisphereLight args={["#ffffff", "#8c9282", 0.75]} />
      <directionalLight position={[25, 45, 20]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={45} shadow-camera-bottom={-45} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer intensity={1} color="#cde" position={[-10, 2, -1]} rotation-y={Math.PI / 2} scale={[30, 2, 1]} />
      </Environment>
      <CameraRig zone={zone} controls={controls} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[260, 260]} /><meshStandardMaterial color="#8c8f88" roughness={1} /></mesh>

      {/* ===== HALA DE PRODUCȚIE (după plan) ===== */}
      <HallShell />
      <ZoneSign position={[-W2 - 2, 4, -D2 + 3]} title="Hala de producție" sub={`${working.length} linii lucrează · ${data.lineViews.reduce((a, l) => a + l.workers, 0)} oameni${late.length ? ` · ⚠ ${late.length} peste normă` : ""}`} />
      {layout.map((st) => {
        const lid = byStation.get(st.id);
        const line = lid ? byId.get(lid) : undefined;
        return <StationNode key={st.id} st={st} line={line} editing={editing}
          selected={editing ? selection?.kind === "station" && selection.id === st.id : (selection?.kind === "line" && selection.id === lid) || (selection?.kind === "station" && selection.id === st.id)}
          onSelect={() => onSelect(line && !editing ? { kind: "line", id: line.id } : { kind: "station", id: st.id })}
          onGrab={(off) => { if (controls.current) controls.current.enabled = false; setDrag({ id: st.id, off }); document.body.style.cursor = "grabbing"; }} />;
      })}
      {editing && drag && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}
          onPointerMove={(e) => { e.stopPropagation(); const [px, py] = toPlan(e.point.x + drag.off[0], e.point.z + drag.off[1]); onMove?.(drag.id, px, py); }}
          onPointerUp={() => setDrag(null)}>
          <planeGeometry args={[HALL.w + 30, HALL.d + 30]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}
      {working.length > 0 && FLOWS.filter((f) => f.kind !== "igiena").map((f, i) => <FlowMovers key={i} pts={f.pts} kind={f.kind} count={f.pts.length > 3 ? 4 : 2} />)}

      {/* ===== DEPOZIT MP (frig), la poarta de materie primă ===== */}
      <Clickable onSelect={() => onSelect({ kind: "depozit" })}>
        <ZoneSign position={[0, 4.5, 23]} title="Depozit MP · frig 2–4°C" sub={`${data.stock.length} produse pe stoc`} />
        <mesh position={[0, 1.6, 28.5]}><boxGeometry args={[24, 3.2, 10]} /><meshPhysicalMaterial color="#bfe3ff" transparent opacity={0.12} roughness={0.1} depthWrite={false} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 28.5]}><planeGeometry args={[24, 10]} /><meshStandardMaterial color="#b9c3c8" /></mesh>
        {stock.map((s, i) => {
          const h = Math.max(1, Math.round((s.qty / maxStock) * 6));
          const x = -9 + (i % 6) * 3.6; const z = 26 + Math.floor(i / 6) * 4.5;
          return (
            <group key={s.name} position={[x, 0, z]}>
              <CrateStack position={[0, 0, 0]} levels={h} seed={i} />
              <Html position={[0, h * 0.3 + 0.9, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
                <div className="max-w-[120px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{s.name} · {Math.round(s.qty).toLocaleString("ro-RO")} {s.unit}</div>
              </Html>
            </group>
          );
        })}
      </Clickable>
      <Forklift path={[[-6, 25], [-0.5, 21.5], [5, 25], [0, 31]]} speed={0.05} />

      {/* ===== RECEPȚIE ===== */}
      <Clickable onSelect={() => onSelect({ kind: "receptie" })}>
        <ZoneSign position={[-22, 4.5, 23]} title="Recepție" sub={`${data.receptions.reduce((a, r) => a + r.lots, 0)} loturi azi · ${Math.round(data.receptions.reduce((a, r) => a + r.kg, 0)).toLocaleString("ro-RO")} kg`} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, 0.006, 29]}><planeGeometry args={[14, 12]} /><meshStandardMaterial color="#a9aea7" /></mesh>
        {Array.from({ length: Math.min(10, data.receptions.reduce((a, r) => a + r.lots, 0)) }).map((_, i) => (
          <CrateStack key={i} position={[-25 + (i % 2) * 1.6, 0, 25 + Math.floor(i / 2) * 1.6]} levels={2} seed={i} />
        ))}
        {data.receptions.length === 0 && <Html position={[-22, 1, 29]} center distanceFactor={20} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground">Nicio recepție azi</div></Html>}
      </Clickable>
      {Array.from({ length: recTrucks }).map((_, i) => (
        <Truck key={i} from={[-55, 0, 25 + i * 4.5]} to={[-31, 0, 25 + i * 4.5]} delay={i * 7} label={data.receptions[i]?.supplier} />
      ))}
      <Clickable onSelect={() => onSelect({ kind: "receptie" })}>
        <ZoneSign position={[-27, 5, 39]} title="Poartă · prerecepții" sub={data.prereceptions.length ? `${data.prereceptions.length} camioane așteptate · ${Math.round(data.prereceptions.reduce((a, p) => a + p.kgLeft, 0)).toLocaleString("ro-RO")} kg de descărcat` : "Nimic anunțat care să mai aștepte"} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-27, 0.005, 42]}><planeGeometry args={[26, 6]} /><meshStandardMaterial color="#6f726c" /></mesh>
        <mesh position={[-40, 0.9, 39.5]}><boxGeometry args={[0.2, 1.8, 0.2]} /><meshStandardMaterial color="#d04437" /></mesh>
        <mesh position={[-40, 1.7, 41.5]}><boxGeometry args={[0.12, 0.12, 4]} /><meshStandardMaterial color="#d04437" /></mesh>
        {data.prereceptions.slice(0, 5).map((p, i) => (
          <group key={p.id} position={[-37 + i * 4.4, 0, 42.5]}>
            <Truck from={[0, 0, 0]} to={[0, 0, -0.01]} loop={1000} label={`${p.late ? "⚠ întârziat · " : ""}${p.supplier} · ${Math.round(p.kgLeft).toLocaleString("ro-RO")} kg`} />
          </group>
        ))}
      </Clickable>

      {/* ===== PICKING & LIVRARE, la ieșirea de sus din plan ===== */}
      <Clickable onSelect={() => onSelect({ kind: "livrare" })}>
        <ZoneSign position={[exitX, 4.5, -23]} title="Picking & livrare" sub={`${data.ready.length} magazine cu marfă gata`} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[exitX, 0.006, -29]}><planeGeometry args={[24, 12]} /><meshStandardMaterial color="#b3b8b0" /></mesh>
        {ready.map((r, i) => {
          const h = Math.max(1, Math.round((r.pieces / maxReady) * 7));
          const x = exitX - 8 + (i % 5) * 4; const z = -26 - Math.floor(i / 5) * 5;
          return (
            <group key={r.store} position={[x, 0, z]}>
              <Pallet position={[0, 0, 0]}>
                {Array.from({ length: h }).map((_, k) => <mesh key={k} castShadow position={[0, 0.15 + k * 0.3, 0]}><boxGeometry args={[1.1, 0.28, 0.75]} /><meshStandardMaterial color={k % 2 ? C.carton : "#bb955c"} /></mesh>)}
                <mesh position={[0, h * 0.3 / 2 + 0.05, 0]}><boxGeometry args={[1.14, h * 0.3 + 0.1, 0.79]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.18} roughness={0.1} depthWrite={false} /></mesh>
              </Pallet>
              <Html position={[0, h * 0.3 + 0.8, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
                <div className="max-w-[130px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{r.store} · {r.pieces.toLocaleString("ro-RO")} buc</div>
              </Html>
            </group>
          );
        })}
        {[-6, 0, 6].map((dx) => (<mesh key={dx} position={[exitX + dx, 0.6, -35.5]} castShadow><boxGeometry args={[3.2, 1.2, 1]} /><meshStandardMaterial color={C.darkSteel} /></mesh>))}
      </Clickable>
      <Forklift path={[[exitX - 4, -24], [exitX, -21.5], [exitX + 4, -25], [exitX, -31]]} speed={0.05} phase={0.4} />
      {outTrucks.map((r, i) => (<Truck key={r.store} from={[exitX - 6 + i * 6, 0, -64]} to={[exitX - 6 + i * 6, 0, -38.5]} delay={i * 5 + 3} loop={26} label={`→ ${r.store}`} />))}

      <OrbitControls ref={controls} makeDefault enabled={!drag} maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={130} />
    </>
  );
}
