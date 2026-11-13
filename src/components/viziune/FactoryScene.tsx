import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Environment, Lightformer, OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type { FactoryData } from "./useFactoryData";
import type { LineView } from "@/lib/viziune/factoryState";

// Scene materials are a fixed physical palette (steel, crates, greens), not UI theme colors.
const C = {
  floor: "#c9ccc4", steel: "#aeb4b8", darkSteel: "#4d5357", belt: "#2b2f31", wall: "#e9ebe6",
  crate: "#2f6b4f", crateBlue: "#2f5f86", leaf: ["#5fa83a", "#7cc04b", "#3f8a2e", "#a3cf5d", "#8a3b5a"],
  coat: "#f4f4f2", net: "#7fb2e0", skin: "#e2b48f", truck: "#f2f2ef", stripe: "#3d8b3d", cab: "#2c6e49",
  status: { lucreaza: "#3fbf4f", asteapta: "#e8b923", terminat: "#3a7bd5", oprita: "#d04437" } as Record<string, string>,
};

export type Zone = "all" | "receptie" | "depozit" | "productie" | "livrare";
export const ZONES: Record<Zone, { pos: [number, number, number]; target: [number, number, number]; label: string }> = {
  all: { pos: [6, 34, 40], target: [2, 0, 0], label: "Toată fabrica" },
  receptie: { pos: [-38, 12, 14], target: [-28, 0, 0], label: "Recepție" },
  depozit: { pos: [-24, 12, 14], target: [-17, 0, 0], label: "Depozit MP (frig)" },
  productie: { pos: [3, 20, 22], target: [3, 0, 0], label: "Linii producție" },
  livrare: { pos: [32, 13, 16], target: [22, 0, 0], label: "Picking & livrare" },
};

export type Selection = { kind: "line"; id: string } | { kind: "receptie" } | { kind: "depozit" } | { kind: "livrare" } | null;

function useFloorTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas"); c.width = c.height = 512;
    const g = c.getContext("2d")!;
    g.fillStyle = C.floor; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) { const v = 170 + Math.random() * 30; g.fillStyle = `rgba(${v},${v + 3},${v - 4},0.25)`; g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2); }
    g.strokeStyle = "rgba(0,0,0,0.08)"; g.lineWidth = 2;
    for (let i = 0; i <= 512; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(8, 4); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return t;
  }, []);
}

function Lettuce({ seed = 0, scale = 1, red = false }: { seed?: number; scale?: number; red?: boolean }) {
  const leaves = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 + seed;
    return { p: [Math.cos(a) * 0.12, 0.08 + (i % 2) * 0.04, Math.sin(a) * 0.12] as [number, number, number], c: red && i % 2 ? C.leaf[4] : C.leaf[(i + Math.floor(seed * 10)) % 4] };
  }), [seed, red]);
  return (
    <group scale={scale}>
      {leaves.map((l, i) => (<mesh key={i} position={l.p} scale={[1, 0.6, 1]} castShadow><sphereGeometry args={[0.14, 8, 6]} /><meshStandardMaterial color={l.c} roughness={0.8} /></mesh>))}
      <mesh position={[0, 0.14, 0]} scale={[1, 0.7, 1]}><sphereGeometry args={[0.13, 8, 6]} /><meshStandardMaterial color={C.leaf[3]} roughness={0.8} /></mesh>
    </group>
  );
}

function Crate({ position, color = C.crate, full = true, seed = 0 }: { position: [number, number, number]; color?: string; full?: boolean; seed?: number }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.17, 0]}><boxGeometry args={[0.8, 0.34, 0.55]} /><meshStandardMaterial color={color} roughness={0.7} /></mesh>
      {full && <group position={[0, 0.25, 0]}><group position={[-0.2, 0, 0]}><Lettuce seed={seed} scale={0.9} /></group><group position={[0.2, 0, 0]}><Lettuce seed={seed + 1.3} scale={0.9} red={seed % 3 < 1} /></group></group>}
    </group>
  );
}

function Pallet({ position, children }: { position: [number, number, number]; children?: React.ReactNode }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow position={[0, 0.07, 0]}><boxGeometry args={[1.2, 0.14, 0.8]} /><meshStandardMaterial color="#b48a5a" roughness={0.9} /></mesh>
      <group position={[0, 0.14, 0]}>{children}</group>
    </group>
  );
}

function Worker({ position, phase = 0, rotY = 0 }: { position: [number, number, number]; phase?: number; rotY?: number }) {
  const body = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Mesh>(null); const armR = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 3 + phase;
    if (body.current) body.current.position.y = Math.abs(Math.sin(t)) * 0.03;
    if (armL.current) armL.current.rotation.x = -0.9 + Math.sin(t) * 0.4;
    if (armR.current) armR.current.rotation.x = -0.9 + Math.cos(t) * 0.4;
  });
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <group ref={body}>
        <mesh castShadow position={[0, 0.55, 0]}><capsuleGeometry args={[0.2, 0.55, 4, 8]} /><meshStandardMaterial color={C.coat} /></mesh>
        <mesh castShadow position={[0, 1.1, 0]}><sphereGeometry args={[0.15, 12, 10]} /><meshStandardMaterial color={C.skin} /></mesh>
        <mesh position={[0, 1.18, 0]} scale={[1, 0.6, 1]}><sphereGeometry args={[0.165, 12, 8]} /><meshStandardMaterial color={C.net} /></mesh>
        <mesh ref={armL} position={[-0.24, 0.8, 0.05]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
        <mesh ref={armR} position={[0.24, 0.8, 0.05]}><capsuleGeometry args={[0.06, 0.35, 3, 6]} /><meshStandardMaterial color={C.coat} /></mesh>
      </group>
    </group>
  );
}

const LINE_LEN = 11;
function SaladPack({ i }: { i: number }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.09, 0]}><boxGeometry args={[0.42, 0.16, 0.3]} /><meshPhysicalMaterial color="#e8f4ea" transmission={0.6} roughness={0.15} thickness={0.1} transparent opacity={0.6} /></mesh>
      <mesh position={[0, 0.07, 0]} scale={[1.4, 0.5, 1]}><sphereGeometry args={[0.11, 8, 6]} /><meshStandardMaterial color={C.leaf[i % 4]} /></mesh>
      <mesh position={[0, 0.172, 0]}><planeGeometry args={[0.2, 0.12]} /><meshStandardMaterial color="#ffffff" /></mesh>
    </group>
  );
}

function Line({ line, position, selected, onSelect }: { line: LineView; position: [number, number, number]; selected: boolean; onSelect: () => void }) {
  const packs = useRef<THREE.Group>(null);
  const beltTex = useMemo(() => {
    const c = document.createElement("canvas"); c.width = 64; c.height = 16; const g = c.getContext("2d")!;
    g.fillStyle = C.belt; g.fillRect(0, 0, 64, 16); g.fillStyle = "#3a3f42"; for (let i = 0; i < 64; i += 8) g.fillRect(i, 0, 3, 16);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(LINE_LEN * 2, 1); return t;
  }, []);
  const running = line.status === "lucreaza";
  const nPacks = 8;
  useFrame((_, d) => {
    if (!running) return;
    const dt = Math.min(d, 0.05);
    beltTex.offset.x -= dt * 0.9;
    packs.current?.children.forEach((ch) => { ch.position.x += dt * 0.9 * (LINE_LEN / 22) * 2; if (ch.position.x > LINE_LEN / 2 - 0.3) ch.position.x = -LINE_LEN / 2 + 1.2; });
  });
  const pct = line.pieces ? Math.round((line.produced / line.pieces) * 100) : 0;
  const workers = Math.min(running ? Math.max(1, line.workers) : 0, 8);
  const sc = C.status[line.status];
  return (
    <group position={position}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}>
      {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}><planeGeometry args={[LINE_LEN + 1, 2.8]} /><meshBasicMaterial color={sc} transparent opacity={0.18} /></mesh>}
      {/* hopper with raw greens at line start */}
      <group position={[-LINE_LEN / 2 - 0.2, 0, 0]}>
        <mesh castShadow position={[0, 1.05, 0]}><cylinderGeometry args={[0.6, 0.35, 0.7, 12, 1, true]} /><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} side={THREE.DoubleSide} /></mesh>
        {line.ordersTotal > line.ordersDone && <group position={[0, 1.15, 0]}><Lettuce seed={1} scale={1.3} /></group>}
        <mesh position={[0, 0.4, 0]}><boxGeometry args={[0.15, 0.8, 0.15]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
      </group>
      {/* conveyor */}
      <mesh castShadow receiveShadow position={[0, 0.78, 0]}><boxGeometry args={[LINE_LEN, 0.1, 0.9]} /><meshStandardMaterial map={beltTex} roughness={0.9} /></mesh>
      {[-0.5, 0.5].map((z) => (<mesh key={z} position={[0, 0.86, z]}><boxGeometry args={[LINE_LEN, 0.12, 0.06]} /><meshStandardMaterial color={C.steel} metalness={0.8} roughness={0.25} /></mesh>))}
      {Array.from({ length: 6 }).map((_, i) => (<mesh key={i} position={[-LINE_LEN / 2 + 0.5 + i * ((LINE_LEN - 1) / 5), 0.38, 0]}><boxGeometry args={[0.1, 0.76, 0.8]} /><meshStandardMaterial color={C.darkSteel} metalness={0.6} /></mesh>))}
      {/* weigher / packer at the end */}
      <group position={[LINE_LEN / 2 - 1.6, 0, 0]}>
        <RoundedBox args={[1.2, 0.9, 1.2]} radius={0.06} position={[0, 1.4, 0]} castShadow><meshStandardMaterial color={C.steel} metalness={0.7} roughness={0.3} /></RoundedBox>
        <mesh position={[0, 1.45, 0.61]}><planeGeometry args={[0.5, 0.3]} /><meshStandardMaterial color="#123" emissive={running ? "#39d353" : "#223"} emissiveIntensity={0.8} /></mesh>
      </group>
      {/* packs on belt */}
      <group ref={packs} position={[0, 0.83, 0]}>
        {Array.from({ length: line.ordersTotal ? nPacks : 0 }).map((_, i) => (<group key={i} position={[-LINE_LEN / 2 + 1.2 + i * ((LINE_LEN - 1.8) / nPacks), 0, 0]}><SaladPack i={i} /></group>))}
      </group>
      {/* output carton stack, grows with produced share */}
      <group position={[LINE_LEN / 2 + 0.9, 0, 0]}>
        <Pallet position={[0, 0, 0]}>
          {Array.from({ length: Math.min(12, Math.ceil(pct / 9)) }).map((_, i) => (<mesh key={i} castShadow position={[(i % 2) * 0.55 - 0.27, 0.15 + Math.floor(i / 2) * 0.3, 0]}><boxGeometry args={[0.5, 0.28, 0.7]} /><meshStandardMaterial color="#c8a36a" /></mesh>))}
        </Pallet>
      </group>
      {/* andon light tower */}
      <group position={[-LINE_LEN / 2 + 0.6, 0, -0.75]}>
        <mesh position={[0, 0.9, 0]}><cylinderGeometry args={[0.03, 0.03, 1.8]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
        <mesh position={[0, 1.9, 0]}><cylinderGeometry args={[0.1, 0.1, 0.3, 12]} /><meshStandardMaterial color={sc} emissive={sc} emissiveIntensity={1.4} /></mesh>
        {running && <pointLight position={[0, 1.9, 0]} color={sc} intensity={2} distance={3} />}
      </group>
      {Array.from({ length: workers }).map((_, i) => {
        const side = i % 2 ? 1 : -1; const x = -LINE_LEN / 2 + 1.6 + Math.floor(i / 2) * 1.6;
        return <Worker key={i} position={[x, 0, side * 0.95]} rotY={side > 0 ? Math.PI : 0} phase={i * 1.7} />;
      })}
      <Html position={[LINE_LEN / 2 - 1.6, 2.9, 0]} center distanceFactor={14} zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <div className="w-48 rounded-lg border bg-card/95 p-2 text-card-foreground shadow-lg">
          <div className="flex items-center gap-1.5 text-xs font-bold"><span className="inline-block h-2 w-2 rounded-full" style={{ background: sc }} />{line.name}</div>
          <div className="truncate text-[10px] text-muted-foreground">{line.status === "lucreaza" ? `${line.currentProduct ?? "lucrează"} · ${line.operator ?? ""} · ${line.workers} oameni` : line.status === "asteapta" ? (line.ordersTotal ? "Oprită — are comenzi în așteptare" : "Fără comenzi azi") : line.status === "terminat" ? "Tot ce avea azi e gata" : "Linie inactivă / mentenanță"}</div>
          {line.pieces > 0 && <>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${pct}%` }} /></div>
            <div className="mt-0.5 text-[10px] tabular-nums">{line.produced.toLocaleString("ro-RO")} / {line.pieces.toLocaleString("ro-RO")} buc · {line.ordersDone}/{line.ordersTotal} comenzi</div>
          </>}
        </div>
      </Html>
    </group>
  );
}

function Truck({ from, to, label, delay = 0, loop = 22, cargo = true }: { from: [number, number, number]; to: [number, number, number]; label?: string; delay?: number; loop?: number; cargo?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const a = useMemo(() => new THREE.Vector3(...from), [from]); const b = useMemo(() => new THREE.Vector3(...to), [to]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = ((clock.elapsedTime + delay) % loop) / loop; // drive in 0-.25, park .25-.75, drive out .75-1
    const k = t < 0.25 ? THREE.MathUtils.smoothstep(t / 0.25, 0, 1) : t < 0.75 ? 1 : 1 - THREE.MathUtils.smoothstep((t - 0.75) / 0.25, 0, 1);
    ref.current.position.lerpVectors(a, b, k);
  });
  const dir = Math.atan2(to[0] - from[0], to[2] - from[2]);
  return (
    <group ref={ref} position={from}>
      <group rotation={[0, dir + Math.PI, 0]}>
        <RoundedBox args={[1.5, 1.6, 3.6]} radius={0.05} position={[0, 1.25, 0]} castShadow><meshStandardMaterial color={C.truck} roughness={0.5} /></RoundedBox>
        <mesh position={[0.76, 1.1, 0]}><planeGeometry args={[0.01, 0.01]} /></mesh>
        <mesh position={[0, 0.85, 0]} castShadow><boxGeometry args={[1.52, 0.18, 3.62]} /><meshStandardMaterial color={C.stripe} /></mesh>
        <RoundedBox args={[1.45, 1.2, 1]} radius={0.08} position={[0, 0.95, -2.3]} castShadow><meshStandardMaterial color={C.cab} metalness={0.3} roughness={0.4} /></RoundedBox>
        <mesh position={[0, 1.15, -2.81]}><planeGeometry args={[1.2, 0.5]} /><meshStandardMaterial color="#9fc7de" metalness={0.8} roughness={0.1} /></mesh>
        <mesh position={[0, 2.1, 1.2]}><boxGeometry args={[1, 0.25, 0.6]} /><meshStandardMaterial color={C.darkSteel} /></mesh>
        {[-1.2, 0.9, -2.3].map((z) => [-0.7, 0.7].map((x) => (<mesh key={`${z}${x}`} position={[x, 0.3, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.2, 14]} /><meshStandardMaterial color="#222" /></mesh>)))}
        {cargo && <group position={[0, 2.15, 0]} />}
      </group>
      {label && <Html position={[0, 2.8, 0]} center distanceFactor={18} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded border bg-card/95 px-1.5 py-0.5 text-[10px] font-semibold text-card-foreground shadow">{label}</div></Html>}
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
      <mesh castShadow position={[0, 1.05, -0.15]}><boxGeometry args={[0.7, 0.05, 0.7]} /><meshStandardMaterial color="#333" /></mesh>
      {[-0.3, 0.3].map((x) => <mesh key={x} position={[x, 0.8, -0.45]}><boxGeometry args={[0.04, 0.9, 0.04]} /><meshStandardMaterial color="#333" /></mesh>)}
      <mesh position={[0, 0.9, 0.85]}><boxGeometry args={[0.7, 1.2, 0.05]} /><meshStandardMaterial color="#555" /></mesh>
      <group position={[0, 0.25, 0.95]}><Crate position={[0, 0, 0]} seed={phase * 7} /></group>
      <Worker position={[0, 0.2, -0.05]} rotY={Math.PI} />
    </group>
  );
}

function ZoneSign({ position, title, sub }: { position: [number, number, number]; title: string; sub?: string }) {
  return (
    <Html position={position} center distanceFactor={22} style={{ pointerEvents: "none" }}>
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
  if (goal.current.zone !== zone) goal.current = { zone, active: true };
  useFrame((_, d) => {
    if (!goal.current.active || !controls.current) return;
    const z = ZONES[goal.current.zone]; const k = 1 - Math.exp(-3 * Math.min(d, 0.05));
    const p = new THREE.Vector3(...z.pos); const t = new THREE.Vector3(...z.target);
    camera.position.lerp(p, k); controls.current.target.lerp(t, k); controls.current.update();
    if (camera.position.distanceTo(p) < 0.2) goal.current.active = false;
  });
  return null;
}

export function FactoryScene({ data, zone, selection, onSelect }: { data: FactoryData; zone: Zone; selection: Selection; onSelect: (s: Selection) => void }) {
  const floor = useFloorTexture();
  const controls = useRef<any>(null);
  const lines = data.lineViews;
  const cols = lines.length > 8 ? 2 : 1;
  const perCol = Math.ceil(lines.length / cols) || 1;
  const hallDepth = Math.max(14, perCol * 3.2 + 4);
  const stock = data.stock.slice(0, 12);
  const maxStock = Math.max(1, ...stock.map((s) => s.qty));
  const ready = data.ready.slice(0, 8);
  const maxReady = Math.max(1, ...ready.map((r) => r.pieces));
  const recTrucks = Math.min(3, data.receptions.length);
  const outTrucks = ready.slice(0, 3);

  return (
    <>
      <color attach="background" args={["#dfe7ea"]} />
      <fog attach="fog" args={["#dfe7ea", 60, 140]} />
      <hemisphereLight args={["#ffffff", "#8c9282", 0.7]} />
      <directionalLight position={[20, 35, 15]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-45} shadow-camera-right={45} shadow-camera-top={30} shadow-camera-bottom={-30} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[20, 20, 1]} />
        <Lightformer intensity={1} color="#cde" position={[-10, 2, -1]} rotation-y={Math.PI / 2} scale={[30, 2, 1]} />
      </Environment>
      <CameraRig zone={zone} controls={controls} />

      {/* yard + factory floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#8c8f88" roughness={1} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[60, hallDepth + 6]} /><meshStandardMaterial map={floor} roughness={0.6} /></mesh>
      {/* half-height walls (cutaway) */}
      {[[-hallDepth / 2 - 3, 60, 0], [hallDepth / 2 + 3, 60, 0]].map(([z, w], i) => (<mesh key={i} position={[0, 0.6, z as number]} receiveShadow castShadow><boxGeometry args={[w as number, 1.2, 0.3]} /><meshStandardMaterial color={C.wall} /></mesh>))}
      {/* safety lines between zones */}
      {[-22.5, -10.5, 15.5].map((x) => (<mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.01, 0]}><planeGeometry args={[0.25, hallDepth + 4]} /><meshStandardMaterial color="#e8c21e" /></mesh>))}

      {/* ===== RECEPȚIE ===== */}
      <Clickable onSelect={() => onSelect({ kind: "receptie" })}>
        <ZoneSign position={[-27, 4.5, -hallDepth / 2]} title="Recepție" sub={`${data.receptions.reduce((a, r) => a + r.lots, 0)} loturi azi · ${Math.round(data.receptions.reduce((a, r) => a + r.kg, 0)).toLocaleString("ro-RO")} kg`} />
        {Array.from({ length: Math.min(10, data.receptions.reduce((a, r) => a + r.lots, 0)) }).map((_, i) => (
          <Pallet key={i} position={[-28 + (i % 2) * 1.5, 0, -4 + Math.floor(i / 2) * 1.2]}>
            <Crate position={[0, 0, 0]} seed={i} /><Crate position={[0, 0.34, 0]} seed={i + 2} color={C.crateBlue} />
          </Pallet>
        ))}
        {data.receptions.length === 0 && <Html position={[-27.5, 1, 0]} center distanceFactor={20} style={{ pointerEvents: "none" }}><div className="whitespace-nowrap rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground">Nicio recepție azi</div></Html>}
      </Clickable>
      {Array.from({ length: recTrucks }).map((_, i) => (
        <Truck key={i} from={[-48, 0, -6 + i * 5]} to={[-33, 0, -6 + i * 5]} delay={i * 7} label={data.receptions[i]?.supplier} />
      ))}

      {/* ===== DEPOZIT MP (cold room) ===== */}
      <Clickable onSelect={() => onSelect({ kind: "depozit" })}>
        <ZoneSign position={[-16.5, 4.5, -hallDepth / 2]} title="Depozit MP · frig 2–4°C" sub={`${data.stock.length} produse pe stoc`} />
        <mesh position={[-16.5, 1.6, 0]}><boxGeometry args={[11, 3.2, hallDepth]} /><meshPhysicalMaterial color="#bfe3ff" transparent opacity={0.12} roughness={0.1} depthWrite={false} /></mesh>
        {stock.map((s, i) => {
          const h = Math.max(1, Math.round((s.qty / maxStock) * 6));
          const x = -20 + (i % 3) * 3.4; const z = -hallDepth / 2 + 2.5 + Math.floor(i / 3) * ((hallDepth - 4) / 4);
          return (
            <group key={s.name} position={[x, 0, z]}>
              <Pallet position={[0, 0, 0]}>{Array.from({ length: h }).map((_, k) => <Crate key={k} position={[0, k * 0.34, 0]} full={k === h - 1} seed={i + k} color={k % 2 ? C.crateBlue : C.crate} />)}</Pallet>
              <Html position={[0, h * 0.34 + 0.9, 0]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
                <div className="max-w-[120px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{s.name} · {Math.round(s.qty).toLocaleString("ro-RO")} {s.unit}</div>
              </Html>
            </group>
          );
        })}
      </Clickable>
      <Forklift path={[[-12, -3], [-6, -hallDepth / 2 + 3], [-6, hallDepth / 2 - 3], [-12, 3]]} phase={0} speed={0.05} />
      <Forklift path={[[-12, 4], [-7, hallDepth / 2 - 2], [-7, -hallDepth / 2 + 2], [-12, -4]]} phase={0.5} speed={0.04} />

      {/* ===== PRODUCȚIE ===== */}
      <ZoneSign position={[3, 5, -hallDepth / 2]} title="Linii de producție" sub={`${lines.filter((l) => l.status === "lucreaza").length} lucrează acum · ${lines.reduce((a, l) => a + l.workers, 0)} oameni`} />
      {lines.map((l, i) => {
        const col = Math.floor(i / perCol); const row = i % perCol;
        const x = cols === 1 ? 3 : col === 0 ? -2.5 : 9.5;
        const z = -((perCol - 1) * 3.2) / 2 + row * 3.2;
        return <Line key={l.id} line={l} position={[x, 0, z]} selected={selection?.kind === "line" && selection.id === l.id} onSelect={() => onSelect({ kind: "line", id: l.id })} />;
      })}

      {/* ===== PICKING & LIVRARE ===== */}
      <Clickable onSelect={() => onSelect({ kind: "livrare" })}>
        <ZoneSign position={[21, 4.5, -hallDepth / 2]} title="Picking & livrare" sub={`${data.ready.length} magazine cu marfă gata`} />
        {ready.map((r, i) => {
          const h = Math.max(1, Math.round((r.pieces / maxReady) * 7));
          const x = 18 + (i % 2) * 2.2; const z = -hallDepth / 2 + 2.5 + Math.floor(i / 2) * ((hallDepth - 4) / 4);
          return (
            <group key={r.store} position={[x, 0, z]}>
              <Pallet position={[0, 0, 0]}>
                {Array.from({ length: h }).map((_, k) => <mesh key={k} castShadow position={[0, 0.15 + k * 0.3, 0]}><boxGeometry args={[1.1, 0.28, 0.75]} /><meshStandardMaterial color={k % 2 ? "#c8a36a" : "#bb955c"} /></mesh>)}
                <mesh position={[0, h * 0.3 / 2 + 0.05, 0]}><boxGeometry args={[1.14, h * 0.3 + 0.1, 0.79]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.18} roughness={0.1} depthWrite={false} /></mesh>
              </Pallet>
              <Html position={[0, h * 0.3 + 0.8, 0]} center distanceFactor={16} style={{ pointerEvents: "none" }}>
                <div className="max-w-[130px] truncate whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-[9px] font-semibold text-card-foreground shadow">{r.store} · {r.pieces.toLocaleString("ro-RO")} buc</div>
              </Html>
            </group>
          );
        })}
        {/* loading docks */}
        {[-5, 0, 5].map((z) => (<mesh key={z} position={[25.5, 0.6, z]} castShadow><boxGeometry args={[1, 1.2, 3.2]} /><meshStandardMaterial color={C.darkSteel} /></mesh>))}
      </Clickable>
      {outTrucks.map((r, i) => (<Truck key={r.store} from={[50, 0, -5 + i * 5]} to={[28.5, 0, -5 + i * 5]} delay={i * 5 + 3} loop={26} label={`→ ${r.store}`} />))}

      <OrbitControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2.15} minDistance={5} maxDistance={90} />
    </>
  );
}
