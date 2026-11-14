import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { OfficeData } from "./useOfficeData";
import type { OfficeId, OfficeView, PersonView } from "@/lib/viziune/officeState";
import { deskSpots, OFFICE_BUILDING, OFFICE_CORRIDOR_Z, roomCenter, roomsFor, type Room } from "@/lib/viziune/officeLayout";
import { roomOrderOf } from "@/lib/viziune/officeState";
import { labelForPath } from "@/lib/activityTracking";
import { Bake, LIVE, NearHtml } from "./Bake";
import { labelScale, useWalking } from "./walkContext";

// Fixed physical palette for furniture, carpets and screens (scene materials, not UI theme colours).
const P = {
  wall: "#eef0ec", desk: "#c9a77c", deskLeg: "#55595c", chair: "#30343a", screenOff: "#1b1e22", app: "#39d353", senior: "#4a8fe8",
  skin: "#e2b48f", hair: ["#3b2a20", "#6b4a2e", "#1f1f1f", "#a07a4a"], shirt: ["#3c6e9f", "#8a4f6b", "#4f7d5a", "#c27c3a", "#5b5f97", "#7a8a96"],
  slab: "#a4a8a1", corridor: "#cfd2cb", select: "#f2c14e",
  carpet: { ceo: "#7a6a58", vanzari: "#5f7f9a", achizitii: "#6f8a6a", contabilitate: "#8a7f9c", hr: "#9a7a6e", productie: "#8d9493", calitate: "#7f9a92", mentenanta: "#9a927a", depozit: "#7d8f9e" } as Record<OfficeId, string>,
};
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const hhmm = (s: string | null) => (s ? s.slice(11, 16) : "");

/** What the person is doing now, in a few words. */
export function doingNow(p: PersonView) {
  if (p.status === "aplicatie") return `${labelForPath(p.page ?? "")}${p.tab ? ` › ${p.tab}` : ""}`;
  if (p.status === "senior") { const r = p.recent[0]; return `Senior · ${r ? `${r.cod} la ${hhmm(r.at)}` : `modifică documente`}`; }
  return "";
}

function OfficePerson({ p }: { p: PersonView }) {
  // One merged figure (arms on the keyboard) that sways a little while working.
  const g = useRef<THREE.Group>(null);
  const h = hash(p.key);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 2 + h;
    if (g.current) { g.current.rotation.y = Math.sin(t * 0.6) * 0.12; g.current.position.y = 0.2 + Math.abs(Math.sin(t * 3)) * 0.01; }
  });
  const shirt = P.shirt[h % P.shirt.length];
  return (
    <group ref={g} position={[0, 0.2, 0]} userData={LIVE}>
      <Bake deps={[shirt, h]}>
        <mesh castShadow position={[0, 0.55, 0]}><capsuleGeometry args={[0.19, 0.42, 4, 8]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh castShadow position={[0, 1.02, 0]}><sphereGeometry args={[0.14, 10, 8]} /><meshStandardMaterial color={P.skin} /></mesh>
        <mesh castShadow position={[0, 1.09, 0.03]} scale={[1, 0.7, 1]}><sphereGeometry args={[0.15, 10, 6]} /><meshStandardMaterial color={P.hair[h % P.hair.length]} /></mesh>
        <mesh castShadow position={[-0.23, 0.72, -0.05]} rotation={[-1.25, 0, 0]}><capsuleGeometry args={[0.055, 0.3, 3, 6]} /><meshStandardMaterial color={shirt} /></mesh>
        <mesh castShadow position={[0.23, 0.72, -0.05]} rotation={[-1.25, 0, 0]}><capsuleGeometry args={[0.055, 0.3, 3, 6]} /><meshStandardMaterial color={shirt} /></mesh>
      </Bake>
    </group>
  );
}

/** One work place: desk with a monitor (green = in the app, blue = in Senior, dark = away) and a chair. */
function Desk({ x, z, p, showLabel }: { x: number; z: number; p?: PersonView; showLabel: boolean }) {
  const walking = useWalking();
  const here = p && (p.status === "aplicatie" || p.status === "senior");
  const glow = p?.status === "aplicatie" ? P.app : p?.status === "senior" ? P.senior : null;
  return (
    <group position={[x, 0, z]}>
      <group position={[0, 0, -0.62]}>
        <mesh castShadow receiveShadow position={[0, 0.74, 0]}><boxGeometry args={[1.3, 0.05, 0.65]} /><meshStandardMaterial color={P.desk} roughness={0.6} /></mesh>
        {[-0.6, 0.6].map((dx) => <mesh key={dx} position={[dx, 0.37, 0]}><boxGeometry args={[0.05, 0.74, 0.6]} /><meshStandardMaterial color={P.deskLeg} /></mesh>)}
        <mesh position={[0, 1.0, -0.18]}><boxGeometry args={[0.55, 0.34, 0.04]} /><meshStandardMaterial color={P.screenOff} /></mesh>
        <mesh position={[0, 1.0, -0.155]}><planeGeometry args={[0.5, 0.29]} /><meshStandardMaterial color={glow ?? P.screenOff} emissive={glow ?? "#000000"} emissiveIntensity={glow ? 0.9 : 0} /></mesh>
        <mesh position={[0, 0.8, -0.18]}><boxGeometry args={[0.06, 0.12, 0.06]} /><meshStandardMaterial color={P.deskLeg} /></mesh>
        <mesh position={[0, 0.775, 0.1]}><boxGeometry args={[0.42, 0.02, 0.14]} /><meshStandardMaterial color="#d9d9d6" /></mesh>
      </group>
      <mesh position={[0, 0.45, 0.1]}><boxGeometry args={[0.46, 0.06, 0.46]} /><meshStandardMaterial color={P.chair} /></mesh>
      <mesh position={[0, 0.75, 0.33]}><boxGeometry args={[0.46, 0.55, 0.05]} /><meshStandardMaterial color={P.chair} /></mesh>
      <mesh position={[0, 0.22, 0.1]}><cylinderGeometry args={[0.03, 0.03, 0.44, 6]} /><meshStandardMaterial color={P.deskLeg} /></mesh>
      {here && <OfficePerson p={p!} />}
      {here && showLabel && (
        <NearHtml maxDist={30} position={[0, 1.65, 0]} center distanceFactor={labelScale(walking, 14)} style={{ pointerEvents: "none" }}>
          <div className="max-w-[170px] whitespace-nowrap rounded bg-card/90 px-1.5 py-0.5 text-center text-[9px] leading-tight text-card-foreground shadow">
            <div className="truncate font-bold">{p!.name}</div>
            <div className="truncate text-muted-foreground">{doingNow(p!)}</div>
          </div>
        </NearHtml>
      )}
    </group>
  );
}

function Plant({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.2, 0.16, 0.4, 10]} /><meshStandardMaterial color="#b8673f" /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><sphereGeometry args={[0.38, 10, 8]} /><meshStandardMaterial color="#4f8a3a" roughness={0.9} /></mesh>
    </group>
  );
}

function MeetingTable({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow><boxGeometry args={[3, 0.06, 1.2]} /><meshStandardMaterial color="#6b4a2e" roughness={0.5} /></mesh>
      <mesh position={[0, 0.37, 0]}><boxGeometry args={[0.3, 0.74, 0.3]} /><meshStandardMaterial color={P.deskLeg} /></mesh>
      {[-1, 0, 1].flatMap((i) => [-1, 1].map((s) => <mesh key={`${i}${s}`} position={[i * 0.95, 0.45, s * 0.9]}><boxGeometry args={[0.45, 0.06, 0.45]} /><meshStandardMaterial color={P.chair} /></mesh>))}
    </group>
  );
}

function OfficeRoom({ room, office, selected, onSelect, walls = true }: { room: Room; office?: OfficeView; selected: boolean; onSelect: () => void; walls?: boolean }) {
  const walking = useWalking();
  const people = office?.people ?? [];
  const inHall = room.inHall;
  const spots = useMemo(() => deskSpots(room, Math.max(inHall ? 2 : 4, people.length)), [room, people.length, inHall]);
  const extra = Math.max(0, people.length - spots.length);
  const [cx, cz] = roomCenter(room);
  const w = room.x1 - room.x0, d = room.z1 - room.z0;
  const wall = (x: number, z: number, ww: number, dd: number, k: string) => <mesh key={k} position={[x, 0.55, z]} castShadow receiveShadow><boxGeometry args={[ww, 1.1, dd]} /><meshStandardMaterial color={P.wall} /></mesh>;
  const look = people.map((p) => `${p.key}:${p.status}`).join(",");
  return (
    <group onClick={(e) => { e.stopPropagation(); if (!walking) onSelect(); }} onPointerOver={(e) => { e.stopPropagation(); if (!walking) document.body.style.cursor = "pointer"; }} onPointerOut={() => { document.body.style.cursor = ""; }}>
      <Bake deps={[room.id, room.x0, room.z0, spots.length, look, selected, walls]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, cz]} receiveShadow><planeGeometry args={[w - 0.1, d - 0.1]} /><meshStandardMaterial color={P.carpet[room.id]} roughness={0.95} /></mesh>
      {selected && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.03, cz]}><ringGeometry args={[Math.min(w, d) / 2 - 0.25, Math.min(w, d) / 2 - 0.05, 48]} /><meshBasicMaterial color={P.select} /></mesh>}
      {walls && <>
        {wall(cx, room.z0, w, 0.15, "n")}{wall(cx, room.z1, w, 0.15, "s")}
        {wall(room.x0, cz, 0.15, d, "w")}{wall(room.x1, cz, 0.15, d, "e")}
      </>}
      {spots.map(([x, z], i) => <Desk key={i} x={x} z={z} p={people[i]} showLabel />)}
      {!inHall && <>
        <Plant x={room.x1 - 0.6} z={room.z1 - 0.6} />
        <mesh position={[room.x0 + 0.45, 0.9, room.z1 - 1.2]} castShadow><boxGeometry args={[0.5, 1.8, 1.4]} /><meshStandardMaterial color="#8b6f4e" roughness={0.7} /></mesh>
        {room.id === "ceo" && <MeetingTable x={cx} z={room.z1 - 2.6} />}
      </>}
      </Bake>
      <Html position={[cx, inHall ? 2.9 : 2.4, room.z0 + 0.6]} center distanceFactor={labelScale(walking, inHall ? 13 : 22)} style={{ pointerEvents: "none" }}>
        <div className={`whitespace-nowrap rounded-md px-2 py-0.5 text-center shadow-lg ${selected ? "bg-primary text-primary-foreground" : "bg-foreground/85 text-background"}`}>
          <div className="text-[11px] font-black uppercase tracking-wide">{office?.label ?? room.id}</div>
          <div className="text-[9px] opacity-80">{office ? `${office.onlineNow} lucrează acum · ${office.docs} doc. Senior azi${extra ? ` · +${extra} fără loc` : ""}` : "…"}</div>
        </div>
      </Html>
    </group>
  );
}

export type OfficeSelection = { kind: "office"; id: OfficeId } | { kind: "birouri" };

/** Office building next to the hall plus the three offices in the changing-rooms corner of the hall. */
export function OfficesScene({ offices, selection, onSelect }: { offices: OfficeData | null; selection: { kind: string; id?: string } | null; onSelect: (s: OfficeSelection) => void }) {
  const walking = useWalking();
  const byId = new Map((offices?.offices ?? []).map((o) => [o.id, o]));
  const rooms = useMemo(() => roomsFor((offices?.order ?? roomOrderOf([])) as OfficeId[]), [offices?.order]);
  const B = OFFICE_BUILDING;
  const bw = B.x1 - B.x0, bd = B.z1 - B.z0, bcx = (B.x0 + B.x1) / 2, bcz = (B.z0 + B.z1) / 2;
  const onlineB = rooms.filter((r) => r.area === "birouri").reduce((a, r) => a + (byId.get(r.id)?.onlineNow ?? 0), 0);
  const walkX0 = B.x1, walkX1 = -4.6; // up to the picking floor
  return (
    <group>
      {/* walkway from the offices building to Picking & livrare */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(walkX0 + walkX1) / 2, 0.008, OFFICE_CORRIDOR_Z]} receiveShadow><planeGeometry args={[walkX1 - walkX0 + 0.6, 2.4]} /><meshStandardMaterial color={P.corridor} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bcx, 0.01, bcz]} receiveShadow><planeGeometry args={[bw + 1, bd + 1]} /><meshStandardMaterial color={P.slab} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[bcx, 0.015, OFFICE_CORRIDOR_Z]} receiveShadow><planeGeometry args={[bw, 3]} /><meshStandardMaterial color={P.corridor} /></mesh>
      <group onClick={(e) => { e.stopPropagation(); if (!walking) onSelect({ kind: "birouri" }); }}>
        <Html position={[bcx, 4.2, B.z0 - 1]} center distanceFactor={labelScale(walking, 26)} style={{ pointerEvents: "none" }}>
          <div className="whitespace-nowrap rounded-md bg-foreground/85 px-3 py-1 text-center text-background shadow-lg">
            <div className="text-sm font-black uppercase tracking-wider">Clădirea de birouri</div>
            <div className="text-[10px] opacity-80">{offices?.loading ? "se încarcă…" : `${onlineB} oameni lucrează acum`}</div>
          </div>
        </Html>
      </group>
      {rooms.map((r) => (
        <OfficeRoom key={r.id} room={r} office={byId.get(r.id)} selected={selection?.kind === "office" && selection.id === r.id} onSelect={() => onSelect({ kind: "office", id: r.id })} />
      ))}
    </group>
  );
}
