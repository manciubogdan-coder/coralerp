import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html, Environment, Lightformer, ContactShadows, Float } from "@react-three/drei";
import * as THREE from "three";
import { DEPARTMENTS } from "@/lib/departments";
import BackToHubButton from "@/components/BackToHubButton";
import { Button } from "@/components/ui/button";

// Building colors are scene materials (not UI), kept as a fixed palette.
const PALETTE = ["#d9773b", "#4f8a5b", "#3f6f8f", "#c9a24a", "#8a5a7a", "#5b7f7a", "#b5543d", "#6d7f3a", "#7a6a55", "#4a6a9a", "#9a7a3a", "#5a8a8a"];

type Bld = { id: string; label: string; desc: string; path: string; pos: [number, number, number]; h: number; color: string };

function Building({ b, selected, onSelect }: { b: Bld; selected: boolean; onSelect: () => void }) {
  const ref = useRef<THREE.Group>(null);
  const [hover, setHover] = useState(false);
  useFrame((_, d) => {
    if (!ref.current) return;
    const t = selected || hover ? 1.08 : 1;
    ref.current.scale.lerp(new THREE.Vector3(t, t, t), Math.min(d * 8, 1));
  });
  return (
    <group ref={ref} position={b.pos}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = ""; }}>
      <mesh position={[0, 0.1, 0]} receiveShadow><boxGeometry args={[3.2, 0.2, 3.2]} /><meshStandardMaterial color="#9a9488" /></mesh>
      <mesh position={[0, b.h / 2 + 0.2, 0]} castShadow><boxGeometry args={[2.2, b.h, 2.2]} /><meshStandardMaterial color={b.color} roughness={0.6} emissive={b.color} emissiveIntensity={selected ? 0.35 : hover ? 0.15 : 0} /></mesh>
      <mesh position={[0, b.h + 0.55, 0]} rotation={[0, Math.PI / 4, 0]} castShadow><coneGeometry args={[1.75, 0.7, 4]} /><meshStandardMaterial color="#3d3a35" /></mesh>
      {Array.from({ length: Math.max(1, Math.floor(b.h)) }).map((_, i) => (
        <mesh key={i} position={[0, 0.8 + i, 1.11]}><planeGeometry args={[1.4, 0.35]} /><meshStandardMaterial color="#f3e7b8" emissive="#f3d27a" emissiveIntensity={0.4} /></mesh>
      ))}
      <Html position={[0, b.h + 1.4, 0]} center distanceFactor={14} style={{ pointerEvents: "none" }}>
        <div className="whitespace-nowrap rounded-md border bg-card/90 px-2 py-0.5 text-xs font-semibold text-card-foreground shadow">{b.label}</div>
      </Html>
    </group>
  );
}

function Truck({ radius, speed, color }: { radius: number; speed: number; color: string }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * speed;
    if (!ref.current) return;
    ref.current.position.set(Math.cos(t) * radius, 0.35, Math.sin(t) * radius);
    ref.current.rotation.y = -t;
  });
  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.2, 0]}><boxGeometry args={[0.5, 0.5, 1.2]} /><meshStandardMaterial color="#eeeeee" /></mesh>
      <mesh castShadow position={[0, 0.1, 0.75]}><boxGeometry args={[0.5, 0.35, 0.35]} /><meshStandardMaterial color={color} /></mesh>
    </group>
  );
}

function groundTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#7d9a5c"; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${40 + Math.random() * 60},${90 + Math.random() * 60},40,0.35)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function ViziunePage() {
  const navigate = useNavigate();
  const [sel, setSel] = useState<Bld | null>(null);
  const [ready, setReady] = useState(false);
  const tex = useMemo(groundTexture, []);
  const blds: Bld[] = useMemo(() => {
    const list = DEPARTMENTS;
    const R = 9;
    return list.map((d, i) => {
      const a = (i / list.length) * Math.PI * 2;
      return { id: d.id, label: d.label, desc: d.description, path: d.rootPath, pos: [Math.cos(a) * R, 0, Math.sin(a) * R] as [number, number, number], h: 1.5 + ((i * 7) % 4), color: PALETTE[i % PALETTE.length] };
    });
  }, []);
  const hq: Bld = { id: "argus", label: "Argus · Sediu", desc: "Turnul de comandă: întreabă-l orice despre firmă.", path: "/administrativ/argus", pos: [0, 0, 0], h: 5, color: "#2f4858" };

  return (
    <div className="relative h-[calc(100vh-4rem)] w-full overflow-hidden bg-background" data-scene-ready={ready ? "" : undefined}>
      <div className="absolute left-3 top-3 z-10 flex items-center gap-3">
        <BackToHubButton />
        <div className="rounded-lg border bg-card/90 px-3 py-2 shadow">
          <h1 className="text-lg font-bold leading-tight">Viziune</h1>
          <p className="text-xs text-muted-foreground">Coral ca un oraș 3D. Trage pentru rotire, scroll pentru zoom, clic pe o clădire.</p>
        </div>
      </div>
      {sel && (
        <div className="absolute bottom-4 left-1/2 z-10 w-[min(92%,420px)] -translate-x-1/2 rounded-xl border bg-card/95 p-4 shadow-lg">
          <div className="text-base font-bold">{sel.label}</div>
          <p className="mt-1 text-sm text-muted-foreground">{sel.desc}</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => navigate(sel.path)}>Intră în departament</Button>
            <Button variant="outline" onClick={() => setSel(null)}>Închide</Button>
          </div>
        </div>
      )}
      <Canvas shadows camera={{ position: [16, 14, 16], fov: 45 }} onCreated={() => setTimeout(() => setReady(true), 300)} onPointerMissed={() => setSel(null)}>
        <color attach="background" args={["#cfe0e8"]} />
        <fog attach="fog" args={["#cfe0e8", 30, 70]} />
        <hemisphereLight args={["#ffffff", "#6b7a55", 0.6]} />
        <directionalLight position={[12, 20, 8]} intensity={1.6} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-20} shadow-camera-right={20} shadow-camera-top={20} shadow-camera-bottom={-20} />
        <Environment resolution={64}>
          <Lightformer intensity={2} position={[0, 5, 0]} scale={[10, 10, 1]} />
          <Lightformer intensity={1} color="#bcd" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 1, 1]} />
        </Environment>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[120, 120]} /><meshStandardMaterial map={tex} /></mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow><ringGeometry args={[5.2, 6.4, 64]} /><meshStandardMaterial color="#55524c" /></mesh>
        <Truck radius={5.8} speed={0.35} color="#d9773b" />
        <Truck radius={5.8} speed={0.35} color="#4f8a5b" />
        {blds.map((b) => <Building key={b.id} b={b} selected={sel?.id === b.id} onSelect={() => setSel(b)} />)}
        <Float speed={1.5} floatIntensity={0.3} rotationIntensity={0}>
          <Building b={hq} selected={sel?.id === "argus"} onSelect={() => setSel(hq)} />
        </Float>
        <ContactShadows position={[0, 0.03, 0]} opacity={0.35} scale={40} blur={2} far={10} />
        <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.2} minDistance={8} maxDistance={45} target={[0, 1, 0]} />
      </Canvas>
    </div>
  );
}
