import React, { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { FactoryData } from "./useFactoryData";
import type { LineView } from "@/lib/viziune/factoryState";
import { FLOWS, HALL, moverRoutes, toPlan, toWorld, type HallStation } from "@/lib/viziune/hallLayout";
import { fillSlots, rowPairCells, type StorageSlot } from "@/lib/viziune/storageLayout";
import { focusView, nextView, type NavAction, type V3 } from "@/lib/viziune/cameraNav";

const MOVER_ROUTES = moverRoutes();
// Pallet places: MP cold store (24×10 m south of the gate), reception floor, picking floor before the docks.
const DEPOT_CELLS = rowPairCells(-8.45, 24.4, 14, 3);
const RECEPTION_CELLS = rowPairCells(-27.8, 24.4, 9, 3);
const pickingCells = (x: number) => rowPairCells(x - 8.45, -24.6, 14, 2, { dir: -1, aisle: 4.5 });
type Station = HallStation;
import { clockTime, minutesLabel, PaceBadge } from "./pace";
import { OfficesScene } from "./OfficeScene";
import type { OfficeData } from "./useOfficeData";
import type { OfficeId } from "@/lib/viziune/officeState";
import { HALL_OFFICE_SPLIT } from "@/lib/viziune/officeLayout";
import { Bake, LIVE, NearHtml } from "./Bake";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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

export type Zone = "all" | "plan" | "productie" | "cantare" | "spalare" | "receptie" | "depozit" | "livrare" | "birouri" | "birouriHala" | "birouDepozit";
export const ZONES: Record<Zone, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  all: { pos: [0, 66, 62], target: [8, 0, 2], label: "Toată fabrica" },
  plan: { pos: [0, 52, 0.01], target: [0, 0, 0], label: "Hala de sus" },
  productie: { pos: [-4, 36, 30], target: [0, 0, 0], label: "Hala de producție" },
  cantare: { pos: [-2, 17, 6], target: [1, 0, -10], label: "Cântare & flowpack" },
  spalare: { pos: [-6, 16, 24], target: [5, 0, 8], label: "Spălare & mese" },
  receptie: { pos: [-38, 18, 46], target: [-22, 0, 30], label: "Poartă & recepție" },
  depozit: { pos: [0, 16, 46], target: [0, 0, 28], label: "Depozit MP (frig)" },
  livrare: { pos: [20, 20, -52], target: [6, 0, -29], label: "Picking & livrare" },
  birouri: { pos: [-34, 26, -8], target: [-19, 0, -34], label: "Clădirea de birouri" },
  birouriHala: { pos: [-11, 17, 24], target: [-8.2, 0, 15.5], label: "Birouri din hală" },
  birouDepozit: { pos: [25, 13, 40], target: [15.4, 0, 27], label: "Birou depozit MP" },
};

/** A camera move asked by the page: fly to a zone, nudge with the navigation pad, or look at one machine. */
export type CameraCmd = { seq: number } & ({ kind: "zone"; zone: Zone } | { kind: "nav"; action: NavAction } | { kind: "focus"; x: number; z: number });

export type Selection = { kind: "line"; id: string } | { kind: "station"; id: string } | { kind: "receptie" } | { kind: "depozit" } | { kind: "livrare" } | { kind: "office"; id: OfficeId } | { kind: "birouri" } | null;

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

/** Logo texture shared by every truck; loaded once, without suspending the scene. */
let logoTex: THREE.Texture | null = null;
function useLogo() {
  return useMemo(() => {
    if (!logoTex) { logoTex = new THREE.TextureLoader().load("/lovable-uploads/10bd962a-0fb6-4412-be40-32a121aca7c4.png"); logoTex.colorSpace = THREE.SRGBColorSpace; logoTex.anisotropy = 4; }
    return logoTex;
  }, []);
}

/**
 * Full warehouse floor drawn with a handful of instanced meshes: one pallet per place, 2×2 crates (or
 * cartons) per level, leaves on the top crates. Thousands of boxes stay cheap enough for phones.
 */
function PalletField({ slots, goods }: { slots: StorageSlot[]; goods: "crate" | "carton" }) {
  const pallets = useRef<THREE.InstancedMesh>(null);
  const units = useRef<THREE.InstancedMesh>(null);
  const tops = useRef<THREE.InstancedMesh>(null);
  const layout = useMemo(() => {
    const u: { x: number; y: number; z: number; c: string }[] = [];
    const t: { x: number; y: number; z: number; c: string }[] = [];
    const pal = goods === "crate" ? [C.crateBlue, C.crateBlue, C.crateGrey] : [C.carton, "#bb955c", "#d6b47e"];
    slots.forEach((sl, si) => {
      for (let k = 0; k < sl.levels; k++) for (const [ox, oz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) {
        const y = 0.14 + k * 0.3 + 0.14;
        u.push({ x: sl.x + ox, y, z: sl.z + oz, c: pal[(k + si + (ox > 0 ? 1 : 0)) % 3] });
        if (goods === "crate" && k === sl.levels - 1) t.push({ x: sl.x + ox, y: y + 0.14, z: sl.z + oz, c: C.leaf[(sl.item + (oz > 0 ? 1 : 0)) % 5] });
      }
    });
    return { u, t };
  }, [slots, goods]);
  React.useLayoutEffect(() => {
    const m = new THREE.Matrix4(); const col = new THREE.Color();
    slots.forEach((sl, i) => { m.makeTranslation(sl.x, 0.07, sl.z); pallets.current?.setMatrixAt(i, m); });
    layout.u.forEach((b, i) => { m.makeTranslation(b.x, b.y, b.z); units.current?.setMatrixAt(i, m); units.current?.setColorAt(i, col.set(b.c)); });
    layout.t.forEach((b, i) => { m.makeTranslation(b.x, b.y, b.z); tops.current?.setMatrixAt(i, m); tops.current?.setColorAt(i, col.set(b.c)); });
    for (const r of [pallets, units, tops]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; r.current.computeBoundingSphere(); }
  }, [slots, layout]);
  if (!slots.length) return null;
  return (
    <group>
      <instancedMesh key={`p${slots.length}`} ref={pallets} args={[undefined, undefined, slots.length]} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.14, 0.8]} /><meshStandardMaterial color="#b48a5a" roughness={0.9} />
      </instancedMesh>
      <instancedMesh key={`u${layout.u.length}`} ref={units} args={[undefined, undefined, layout.u.length]} castShadow receiveShadow>
        <boxGeometry args={goods === "crate" ? [0.58, 0.28, 0.38] : [0.58, 0.28, 0.39]} /><meshStandardMaterial roughness={0.75} />
      </instancedMesh>
      {layout.t.length > 0 && (
        <instancedMesh key={`t${layout.t.length}`} ref={tops} args={[undefined, undefined, layout.t.length]}>
          <sphereGeometry args={[0.22, 8, 5]} /><meshStandardMaterial roughness={0.8} />
        </instancedMesh>
      )}
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
  // One merged figure per worker (arms in working pose); it bobs and turns a little while working.
  const body = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + phase;
    if (body.current) { body.current.position.y = (sitting ? -0.25 : 0) + Math.abs(Math.sin(t)) * 0.03; body.current.rotation.y = Math.sin(t * 0.5) * 0.18; }
  });
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group ref={body} userData={LIVE}>
        <Bake>
          <mesh castShadow position={[0, 0.55, 0]}><capsuleGeometry args={[0.2, 0.55, 4, 8]} /><meshStandardMaterial color={C.coat} /></mesh>
          <mesh castShadow position={[0, 1.1, 0]}><sphereGeometry args={[0.15, 10, 8]} /><meshStandardMaterial color={C.skin} /></mesh>
          <mesh castShadow position={[0, 1.18, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.165, 10, 6]} /><meshStandardMaterial color={C.net} /></mesh>
          <mesh castShadow position={[-0.24, 0.8, 0.05]} rotation={[-1, 0, 0]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
          <mesh castShadow position={[0.24, 0.8, 0.05]} rotation={[-1, 0, 0]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
        </Bake>
      </group>
      {sitting && <mesh position={[0, 0.25, 0.1]}><cylinderGeometry args={[0.18, 0.18, 0.05, 12]} /><meshStandardMaterial color={C.darkSteel} /></mesh>}
    </group>
  );
}

function Tray({ i }: { i: number }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.06, 0]}><boxGeometry args={[0.3, 0.1, 0.22]} /><meshStandardMaterial color="#dcebdf" roughness={0.3} /></mesh>
      <mesh position={[0, 0.07, 0]} scale={[1.3, 0.45, 1]}><sphereGeometry args={[0.08, 7, 5]} /><meshStandardMaterial color={C.leaf[i % 4]} /></mesh>
    </group>
  );
}

/** Tray with leaves as one shared geometry (vertex colours), so a whole belt of trays is one instanced draw. */
let trayGeo: THREE.BufferGeometry | null = null;
let trayMat: THREE.Material | null = null;
function trayParts() {
  if (!trayGeo) {
    const part = (g: THREE.BufferGeometry, hex: string) => {
      const n = g.index ? g.toNonIndexed() : g; const out = new THREE.BufferGeometry();
      out.setAttribute("position", n.getAttribute("position")); out.setAttribute("normal", n.getAttribute("normal"));
      const c = new THREE.Color(hex), col = new Float32Array(out.getAttribute("position").count * 3);
      for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
      out.setAttribute("color", new THREE.BufferAttribute(col, 3)); return out;
    };
    const box = new THREE.BoxGeometry(0.3, 0.1, 0.22); box.translate(0, 0.06, 0);
    const leaf = new THREE.SphereGeometry(0.08, 7, 5); leaf.scale(1.3, 0.45, 1); leaf.translate(0, 0.09, 0);
    trayGeo = mergeGeometries([part(box, "#dcebdf"), part(leaf, C.leaf[0])], false);
    trayMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  }
  return { geo: trayGeo!, mat: trayMat! };
}

/** Conveyor along local z, from z0 to z1, with trays riding it while the line runs. */
function Conveyor({ z0, z1, x = 0, y = 0.8, width = 0.6, running, items = 6, slope = 0 }: { z0: number; z1: number; x?: number; y?: number; width?: number; running: boolean; items?: number; slope?: number }) {
  const len = Math.abs(z1 - z0);
  const tex = useBeltTexture(len);
  const packs = useRef<THREE.InstancedMesh>(null);
  const xs = useMemo(() => Array.from({ length: items }, (_, i) => -len / 2 + 0.3 + i * ((len - 0.6) / items)), [items, len]);
  const tray = trayParts();
  const dir = Math.sign(z1 - z0) || 1;
  const mtx = useMemo(() => new THREE.Matrix4(), []);
  useFrame((_, d) => {
    if (!running) return;
    const dt = Math.min(d, 0.05);
    tex.offset.x -= dt * 0.8;
    const m = packs.current; if (!m) return;
    for (let i = 0; i < xs.length; i++) { xs[i] += dt * 0.6; if (xs[i] > len / 2 - 0.2) xs[i] = -len / 2 + 0.2; m.setMatrixAt(i, mtx.makeTranslation(xs[i], 0, 0)); }
    m.instanceMatrix.needsUpdate = true;
  });
  const ang = Math.atan2(slope, len);
  return (
    <group position={[x, y + slope / 2, (z0 + z1) / 2]} rotation={[0, dir > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <group rotation={[0, 0, ang * (dir > 0 ? 1 : 1)]}>
        <mesh castShadow receiveShadow><boxGeometry args={[Math.hypot(len, slope), 0.08, width]} /><meshStandardMaterial map={tex} roughness={0.9} /></mesh>
        {[-width / 2, width / 2].map((zz) => (<mesh key={zz} position={[0, 0.06, zz]}><boxGeometry args={[Math.hypot(len, slope), 0.1, 0.05]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.25} /></mesh>))}
        {running && <instancedMesh ref={packs} args={[tray.geo, tray.mat, items]} position={[0, 0.04, 0]} userData={LIVE} frustumCulled={false} dispose={null} />}
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
      <group ref={disc} position={[0, 0.85, 0]} userData={LIVE}>
        <Bake deps={[running, r]}>
          <mesh castShadow receiveShadow><cylinderGeometry args={[r, r, 0.06, 32]} /><meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} /></mesh>
          {running && Array.from({ length: 8 }).map((_, i) => { const a = (i / 8) * Math.PI * 2; return <group key={i} position={[Math.cos(a) * r * 0.7, 0.03, Math.sin(a) * r * 0.7]} rotation={[0, -a, 0]}><Tray i={i} /></group>; })}
        </Bake>
      </group>
    </group>
  );
}

/** Multihead weigher on a platform fed by a blue Z-elevator, bagger underneath (as in the hall photos). */
function Weigher({ running }: { running: boolean }) {
  const head = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (running && head.current) { head.current.position.y = 3.55 + Math.max(0, Math.sin(clock.elapsedTime * 4)) * 0.04; head.current.rotation.y = clock.elapsedTime * 0.5; } });
  return (
    <group>
      {[[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]].map(([x, z]) => (<mesh key={`${x}${z}`} position={[x, 1.2, z]} castShadow><boxGeometry args={[0.1, 2.4, 0.1]} /><meshStandardMaterial color={C.steel} metalness={0.7} /></mesh>))}
      <mesh position={[0, 2.45, 0]} castShadow receiveShadow><boxGeometry args={[2.8, 0.1, 2.8]} /><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.35} /></mesh>
      {[-1.38, 1.38].map((x) => (<mesh key={x} position={[x, 2.9, 0]}><boxGeometry args={[0.04, 0.04, 2.8]} /><meshStandardMaterial color={C.steel} metalness={0.8} /></mesh>))}
      <mesh position={[0, 3.0, 0]} castShadow><cylinderGeometry args={[0.95, 0.35, 0.9, 16]} /><meshStandardMaterial color={C.steel} metalness={0.85} roughness={0.25} /></mesh>
      <group ref={head} position={[0, 3.55, 0]} userData={LIVE}>
        <Bake>
          {Array.from({ length: 14 }).map((_, i) => { const a = (i / 14) * Math.PI * 2; return <mesh key={i} position={[Math.cos(a) * 0.95, 0, Math.sin(a) * 0.95]} rotation={[0, -a, 0]} castShadow><boxGeometry args={[0.28, 0.32, 0.38]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.3} /></mesh>; })}
        </Bake>
      </group>
      <mesh position={[0, 3.95, 0]}><coneGeometry args={[0.5, 0.5, 14]} /><meshStandardMaterial color={C.steel} metalness={0.85} /></mesh>
      <mesh position={[0, 1.5, 0]} castShadow><boxGeometry args={[0.9, 1.6, 0.9]} /><meshStandardMaterial color={C.steel} metalness={0.6} roughness={0.4} /></mesh>
      <mesh position={[0, 1.6, 0.46]}><planeGeometry args={[0.4, 0.25]} /><meshStandardMaterial color="#123" emissive={running ? "#39d353" : "#223"} emissiveIntensity={0.9} /></mesh>
      {/* Z-elevator */}
      <group position={[1.9, 0, 0.4]} scale={[1, 1, -1]}>
        <mesh position={[0, 2.1, -1.1]} rotation={[-0.95, 0, 0]} castShadow><boxGeometry args={[0.5, 0.12, 4.6]} /><meshStandardMaterial color={C.elevator} roughness={0.5} /></mesh>
        <mesh position={[0, 0.35, -2.8]}><boxGeometry args={[0.7, 0.7, 0.7]} /><meshStandardMaterial color={C.steel} metalness={0.6} /></mesh>
        <mesh position={[-0.9, 3.95, 0.3]} rotation={[0, 0, Math.PI / 2]}><boxGeometry args={[0.12, 1.6, 0.5]} /><meshStandardMaterial color={C.elevator} /></mesh>
        {running && <group position={[0, 0.85, -2.8]}><Lettuce seed={2} scale={1.2} /></group>}
      </group>
    </group>
  );
}

function FlowPacker({ running }: { running: boolean }) {
  return (
    <group>
      <RoundedBox args={[1.1, 1.2, 1.6]} radius={0.05} position={[0, 0.9, 0.6]} castShadow><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></RoundedBox>
      <mesh position={[0, 1.75, 0.6]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.8, 18]} /><meshStandardMaterial color="#dfe9ef" roughness={0.3} /></mesh>
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
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.9, 1, 0.9]} /><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, 1.05, 0]}><cylinderGeometry args={[0.38, 0.38, 0.12, 12]} /><meshStandardMaterial color={C.darkSteel} metalness={0.6} /></mesh>
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
          <group position={[-2.5, 0, -3]} rotation={[0, Math.PI, 0]}><FlowPacker running={running} /></group>
          <Conveyor z0={6.2} z1={3.4} x={1.9} running={running} />
          <SteelTable position={[0, 0, 6.6]} w={1.4} d={1.2} />
        </> : <>
          <RotaryTable position={[-0.3, 0, -6.4]} running={running} />
          <Conveyor z0={-1.6} z1={-5.3} running={running} items={4} />
          <Conveyor z0={6.6} z1={3.4} x={1.9} running={running} items={4} />
        </>}
        <CrateStack position={[-1.9, 0, giostra ? -1.5 : -4.2]} levels={busy ? 4 : 1} full={busy} seed={st.px} />
        <CrateStack position={[-1.9, 0, giostra ? 3 : 3.2]} levels={busy ? 3 : 1} full={busy} seed={st.py} />
      </group>
    );
  }
  if (st.kind === "flowpack") return (
    <group>
      <RotaryTable position={[0.3, 0, -2.2]} running={running} r={0.75} />
      <group rotation={[0, Math.PI, 0]}><FlowPacker running={running} /></group>
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
  const mat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (g.current) { g.current.position.y = 5.3 + Math.sin(t * 2.5) * 0.15; g.current.rotation.y = t * 1.5; }
    if (mat.current) mat.current.emissiveIntensity = 1.4 + Math.abs(Math.sin(t * 6)) * 1.6;
  });
  return (
    <group ref={g} position={[0, 5.3, 0]}>
      <mesh><octahedronGeometry args={[0.45]} /><meshStandardMaterial ref={mat} color={C.status.late} emissive={C.status.late} emissiveIntensity={1.6} /></mesh>
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
      {line.workers > 0 && <div className="mt-0.5 flex items-center gap-1 text-[11px] font-bold"><span className="rounded border bg-secondary px-1.5 py-px text-secondary-foreground">👷 {line.workers} {line.workers === 1 ? "operator" : "operatori"}</span>{line.operator && <span className="truncate text-[10px] font-normal text-muted-foreground">{line.operator}</span>}</div>}
      {p.orders.length > 0 ? <>
        <div className="truncate text-[10px] font-medium">{p.orders[0].product}{p.orders.length > 1 ? ` +${p.orders.length - 1} comenzi` : ""}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">început {clockTime(p.startedAt)} · lucrat {minutesLabel(p.workedHours * 60)}</div>
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
  const workers = line && line.workers > 0 ? Math.min(line.workers, 16) : 0;
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
      <Bake rotation={[0, -((st.rot || 0) * Math.PI) / 180, 0]} deps={[st.kind, running, busy, workers, st.px, st.py]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <planeGeometry args={footprint} />
        <meshBasicMaterial color={editing && selected ? C.status.lucreaza : sc} transparent opacity={selected ? 0.32 : editing ? 0.16 : late ? 0.2 : 0.07} />
      </mesh>
      <StationModel st={st} running={running} busy={busy} />
      {Array.from({ length: workers }).map((_, i) => {
        const base = spots[i % spots.length]; const ring = Math.floor(i / spots.length);
        // Past the first eight, operators stand a step behind the first row.
        const p: [number, number, number] = ring ? [base[0] + (base[0] >= 0 ? 0.6 : -0.6), 0, base[2] + (base[2] >= 0 ? 0.5 : -0.5)] : base;
        return <Worker key={i} position={p} rotY={Math.atan2(-p[0], -p[2])} phase={i * 1.7} sitting={st.kind === "masa" && i < 6 && !ring} />;
      })}
      <group position={[big ? 2.2 : 1.4, 0, big ? 1.4 : -1]}>
        <mesh position={[0, 1.1, 0]}><cylinderGeometry args={[0.03, 0.03, 2.2]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
        <mesh position={[0, 2.3, 0]} userData={LIVE}><cylinderGeometry args={[0.12, 0.12, 0.35, 12]} /><meshStandardMaterial ref={andon} color={sc} emissive={sc} emissiveIntensity={1.3} /></mesh>
      </group>
      </Bake>
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
  return <>{segs.map((s, i) => (<mesh key={i} position={[s.x, 0.014, s.z]} rotation={[-Math.PI / 2, 0, s.rot]}><planeGeometry args={[0.25, s.len]} /><meshBasicMaterial color={color} /></mesh>))}</>;
}

/** Crates riding a floor flow while the hall works: raw material in, finished cartons out. */
function FlowMovers({ pts, kind, count }: { pts: [number, number][]; kind: string; count: number }) {
  // pts always run in the direction goods travel (see moverRoutes)
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
          <Bake>{kind === "materie" ? <Crate position={[0, 0.02, 0]} seed={i} /> : <mesh position={[0, 0.2, 0]} castShadow><boxGeometry args={[0.5, 0.35, 0.4]} /><meshStandardMaterial color={C.carton} /></mesh>}</Bake>
        </group>
      ))}
    </group>
  );
}

/**
 * Truck docking at a ramp: it backs in (cab facing away from the dock, rear doors to the ramp), waits while
 * it is loaded/unloaded, then drives off forward. `heading` overrides the facing for parked trucks.
 */
function Truck({ from, to, label, delay = 0, loop = 22, heading }: { from: [number, number, number]; to: [number, number, number]; label?: string; delay?: number; loop?: number; heading?: number }) {
  const ref = useRef<THREE.Group>(null);
  const rear = useRef<THREE.Group>(null);
  const logo = useLogo();
  const a = useMemo(() => new THREE.Vector3(...from), [from]); const b = useMemo(() => new THREE.Vector3(...to), [to]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime + delay) % loop) / loop;
    const k = t < 0.25 ? THREE.MathUtils.smoothstep(t / 0.25, 0, 1) : t < 0.75 ? 1 : 1 - THREE.MathUtils.smoothstep((t - 0.75) / 0.25, 0, 1);
    ref.current.position.lerpVectors(a, b, k);
    const backing = heading === undefined && t > 0.02 && t < 0.25;
    const glow = backing ? (Math.sin(clock.elapsedTime * 10) > 0 ? 2 : 0.3) : 0;
    rear.current?.children.forEach((m) => { ((m as THREE.Mesh).material as THREE.MeshStandardMaterial).emissiveIntensity = glow; });
  });
  // Cab is at local -z; facing the travel direction would be dir + π, so dir points the cab away from the dock.
  const dir = heading ?? Math.atan2(to[0] - from[0], to[2] - from[2]);
  return (
    <group ref={ref} position={from}>
      <Bake rotation={[0, dir, 0]} deps={[dir]}>
        <group ref={rear} userData={LIVE}>{[-0.55, 0.55].map((x) => (<mesh key={x} position={[x, 0.7, 1.82]}><boxGeometry args={[0.22, 0.14, 0.04]} /><meshStandardMaterial color="#f6b73c" emissive="#ffb020" emissiveIntensity={0} /></mesh>))}</group>
        <RoundedBox args={[1.5, 1.6, 3.6]} radius={0.05} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color={C.truck} roughness={0.5} /></RoundedBox>
        <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[1.52, 0.18, 3.62]} /><meshStandardMaterial color={C.stripe} /></mesh>
        {[1, -1].map((sx) => (<mesh key={sx} position={[sx * 0.765, 1.35, 0.1]} rotation={[0, (sx * Math.PI) / 2, 0]}><planeGeometry args={[1.25, 1.25]} /><meshStandardMaterial map={logo} transparent alphaTest={0.05} roughness={0.5} /></mesh>))}
        <mesh position={[0, 1.4, 1.815]}><planeGeometry args={[1.05, 1.05]} /><meshStandardMaterial map={logo} transparent alphaTest={0.05} roughness={0.5} /></mesh>
        <RoundedBox args={[1.45, 1.2, 1]} radius={0.08} position={[0, 0.95, -2.3]} castShadow><meshStandardMaterial color={C.cab} metalness={0.3} roughness={0.4} /></RoundedBox>
        <mesh position={[0, 1.15, -2.81]}><planeGeometry args={[1.2, 0.5]} /><meshStandardMaterial color="#9fc7de" metalness={0.8} roughness={0.1} /></mesh>
        {[-1.2, 0.9, -2.3].map((z) => [-0.7, 0.7].map((x) => (<mesh key={`${z}${x}`} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 14]} /><meshStandardMaterial color="#222" /></mesh>)))}
      </Bake>
      {label && <NearHtml maxDist={55} position={[0, 2.8, 0]} center distanceFactor={22} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded border bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-card-foreground shadow">{label}</div></NearHtml>}
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
    <group ref={ref}><Bake>
      <mesh castShadow position={[0, 0.45, 0]}><boxGeometry args={[0.8, 0.6, 1.2]} /><meshStandardMaterial color="#e8b923" /></mesh>
      {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 0.8, -0.45]}><boxGeometry args={[0.04, 0.9, 0.04]} /><meshStandardMaterial color="#333" /></mesh>)}
      <mesh position={[0, 0.9, 0.85]}><boxGeometry args={[0.7, 1.2, 0.05]} /><meshStandardMaterial color="#555" /></mesh>
      <group position={[0, 0.25, 0.95]}><Crate position={[0, 0, 0]} seed={phase * 7} /></group>
    </Bake></group>
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

function CameraRig({ cmd, controls }: { cmd: CameraCmd; controls: React.MutableRefObject<any> }) {
  const { camera } = useThree();
  const goal = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const seen = useRef(-1);
  useFrame((_, d) => {
    const c = controls.current;
    if (!c) return;
    if (seen.current !== cmd.seq) {
      const first = seen.current === -1;
      seen.current = cmd.seq;
      // Nudges start from where an unfinished move was heading, so quick presses add up.
      const from = goal.current ?? { pos: camera.position.clone(), target: c.target.clone() };
      const v = cmd.kind === "zone" ? { pos: ZONES[cmd.zone].pos, target: ZONES[cmd.zone].target }
        : cmd.kind === "focus" ? focusView(cmd.x, cmd.z)
        : nextView(from.pos.toArray() as V3, from.target.toArray() as V3, cmd.action);
      goal.current = { pos: new THREE.Vector3(...v.pos), target: new THREE.Vector3(...v.target) };
      if (first) { camera.position.copy(goal.current.pos); c.target.copy(goal.current.target); c.update(); goal.current = null; return; }
    }
    if (!goal.current) return;
    const k = 1 - Math.exp(-4 * Math.min(d, 0.05));
    camera.position.lerp(goal.current.pos, k); c.target.lerp(goal.current.target, k); c.update();
    if (camera.position.distanceTo(goal.current.pos) < 0.15 && c.target.distanceTo(goal.current.target) < 0.15) goal.current = null;
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
    <Bake>
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
        <Html position={[(ox0 + HALL_OFFICE_SPLIT) / 2, 3.2, (oz0 + D2) / 2]} center distanceFactor={26} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded bg-card/85 px-1.5 py-0.5 text-[10px] text-muted-foreground">Vestiare</div></Html>
      </group>
      {FLOWS.map((f, i) => <FlowStripe key={i} pts={f.pts} color={C.flow[f.kind]} />)}
    </Bake>
  );
}

export function FactoryScene({ data: raw, camera, selection, onSelect, layout: layoutProp, editing = false, onMove, offices = null }: {
  data: FactoryData; camera: CameraCmd; selection: Selection; onSelect: (s: Selection) => void;
  /** People in the offices (office building + offices in the hall). */
  offices?: OfficeData | null;
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
  const exitXw = toWorld(610, 0)[0];
  // Dense floors: every pallet place is used, products/stores get places in proportion to what they have.
  const stockSlots = useMemo(() => fillSlots(data.stock.map((s) => s.qty), DEPOT_CELLS, 6, 2), [data.stock]);
  const readySlots = useMemo(() => fillSlots(data.ready.map((r) => r.pieces), pickingCells(exitXw), 7, 2), [data.ready, exitXw]);
  const recLots = data.receptions.reduce((a, r) => a + r.lots, 0);
  const recSlots = useMemo(() => fillSlots(data.receptions.map((r) => r.kg), RECEPTION_CELLS.slice(0, Math.min(RECEPTION_CELLS.length, recLots)), 4, 2), [data.receptions, recLots]);
  const firstSlot = (slots: StorageSlot[], n: number) => { const m = new Map<number, StorageSlot>(); for (const sl of slots) if (!m.has(sl.item) && m.size < n) m.set(sl.item, sl); return [...m.entries()]; };
  const recTrucks = Math.min(3, data.receptions.length);
  const outTrucks = data.ready.slice(0, 3);
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
      <CameraRig cmd={camera} controls={controls} />

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
      {working.length > 0 && MOVER_ROUTES.map((f, i) => <FlowMovers key={i} pts={f.pts} kind={f.kind} count={f.pts.length > 4 ? 5 : 3} />)}

      {/* ===== DEPOZIT MP (frig), la poarta de materie primă ===== */}
      <Clickable onSelect={() => onSelect({ kind: "depozit" })}>
        <ZoneSign position={[0, 4.5, 23]} title="Depozit MP · frig 2–4°C" sub={`${data.stock.length} produse pe stoc`} />
        <mesh position={[0, 1.6, 28.5]}><boxGeometry args={[24, 3.2, 10]} /><meshPhysicalMaterial color="#bfe3ff" transparent opacity={0.12} roughness={0.1} depthWrite={false} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 28.5]}><planeGeometry args={[24, 10]} /><meshStandardMaterial color="#b9c3c8" /></mesh>
        <PalletField slots={stockSlots} goods="crate" />
        {firstSlot(stockSlots, 12).map(([item, sl]) => { const it = data.stock[item]; return (
          <NearHtml maxDist={40} key={it.name} position={[sl.x, sl.levels * 0.3 + 0.7, sl.z]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
            <div className="max-w-[120px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{it.name} · {Math.round(it.qty).toLocaleString("ro-RO")} {it.unit}</div>
          </NearHtml>
        ); })}
      </Clickable>
      <Forklift path={[[-10.6, 26.7], [0, 26.7], [10.6, 26.7], [10.6, 30.4], [0, 30.4], [-10.6, 30.4]]} speed={0.035} />

      {/* ===== RECEPȚIE ===== */}
      <Clickable onSelect={() => onSelect({ kind: "receptie" })}>
        <ZoneSign position={[-22, 4.5, 23]} title="Recepție" sub={`${data.receptions.reduce((a, r) => a + r.lots, 0)} loturi azi · ${Math.round(data.receptions.reduce((a, r) => a + r.kg, 0)).toLocaleString("ro-RO")} kg`} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-22, 0.006, 29]}><planeGeometry args={[14, 12]} /><meshStandardMaterial color="#a9aea7" /></mesh>
        <PalletField slots={recSlots} goods="crate" />
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
            <Truck from={[0, 0, 0]} to={[0, 0, -0.01]} loop={1000} heading={0} label={`${p.late ? "⚠ întârziat · " : ""}${p.supplier} · ${Math.round(p.kgLeft).toLocaleString("ro-RO")} kg`} />
          </group>
        ))}
      </Clickable>

      {/* ===== PICKING & LIVRARE, la ieșirea de sus din plan ===== */}
      <Clickable onSelect={() => onSelect({ kind: "livrare" })}>
        <ZoneSign position={[exitX, 4.5, -23]} title="Picking & livrare" sub={`${data.ready.length} magazine cu marfă gata`} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[exitX, 0.006, -29]}><planeGeometry args={[24, 12]} /><meshStandardMaterial color="#b3b8b0" /></mesh>
        <PalletField slots={readySlots} goods="carton" />
        {firstSlot(readySlots, 12).map(([item, sl]) => { const r = data.ready[item]; return (
          <NearHtml maxDist={40} key={r.store} position={[sl.x, sl.levels * 0.3 + 0.7, sl.z]} center distanceFactor={18} style={{ pointerEvents: "none" }}>
            <div className="max-w-[130px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{r.store} · {r.pieces.toLocaleString("ro-RO")} buc</div>
          </NearHtml>
        ); })}
        {[-6, 0, 6].map((dx) => (<mesh key={dx} position={[exitX + dx, 0.6, -35.5]} castShadow><boxGeometry args={[3.2, 1.2, 1]} /><meshStandardMaterial color={C.darkSteel} /></mesh>))}
      </Clickable>
      <Forklift path={[[exitX - 10.6, -26.85], [exitX, -26.85], [exitX + 10.6, -26.85], [exitX + 10.6, -33.6], [exitX, -33.6], [exitX - 10.6, -33.6]]} speed={0.035} phase={0.4} />
      {outTrucks.map((r, i) => (<Truck key={r.store} from={[exitX - 6 + i * 6, 0, -64]} to={[exitX - 6 + i * 6, 0, -38.5]} delay={i * 5 + 3} loop={26} label={`→ ${r.store}`} />))}

      {/* ===== BIROURI ===== */}
      {!editing && <OfficesScene offices={offices} selection={selection} onSelect={onSelect} />}

      <OrbitControls ref={controls} makeDefault enabled={!drag} maxPolarAngle={Math.PI / 2.15} minDistance={4} maxDistance={130} />
    </>
  );
}
