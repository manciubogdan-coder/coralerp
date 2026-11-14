// Draw-call savers for the Viziune scene: <Bake> merges the still meshes of a subtree into one mesh per
// surface type (colours kept as vertex colours), <NearHtml> shows a label only when the camera is close.
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** Marks a group or mesh that moves on its own (animated by ref): <Bake> leaves it and everything inside it alone. */
export const LIVE = { live: true } as const;

type Bucket = { geos: THREE.BufferGeometry[]; meshes: THREE.Object3D[]; basic: boolean; roughness: number; metalness: number; cast: boolean; receive: boolean };
const noRaycast = () => {};

/** Merges the plain opaque meshes under `root` (not live, not inside another bake) into a few meshes; returns an undo. */
export function bakeInto(root: THREE.Object3D): () => void {
  root.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map<string, Bucket>();
  const hidden: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    for (const ch of o.children) {
      if (ch.userData.live || ch.userData.bakeRoot || !ch.visible) continue;
      const m = ch as THREE.Mesh;
      if (m.isMesh && !(m as THREE.InstancedMesh).isInstancedMesh && !(m as THREE.SkinnedMesh).isSkinnedMesh && m.children.length === 0 && !Array.isArray(m.material)) {
        const mat = m.material as any;
        const std = !!mat.isMeshStandardMaterial && !mat.isMeshPhysicalMaterial;
        const basic = !!mat.isMeshBasicMaterial;
        const plain = (std || basic) && !mat.map && !mat.transparent && mat.side === THREE.FrontSide && !mat.vertexColors && !mat.alphaTest
          && (!std || mat.emissive.getHex() === 0 || mat.emissiveIntensity === 0);
        const pos = m.geometry?.getAttribute("position"), nor = m.geometry?.getAttribute("normal");
        if (plain && pos && nor) {
          const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry;
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", src.getAttribute("position").clone());
          g.setAttribute("normal", src.getAttribute("normal").clone());
          g.applyMatrix4(rel.multiplyMatrices(inv, m.matrixWorld));
          const n = g.getAttribute("position").count, col = new Float32Array(n * 3);
          for (let i = 0; i < n; i++) { col[i * 3] = mat.color.r; col[i * 3 + 1] = mat.color.g; col[i * 3 + 2] = mat.color.b; }
          g.setAttribute("color", new THREE.BufferAttribute(col, 3));
          if (src !== m.geometry) src.dispose();
          const q = (v: number) => Math.round(v * 4) / 4; // close surface finishes share one draw
          const roughness = std ? q(mat.roughness) : 0, metalness = std ? q(mat.metalness) : 0;
          const key = `${basic ? "b" : "s"}|${roughness}|${metalness}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}`;
          const b = buckets.get(key) ?? { geos: [], meshes: [], basic, roughness, metalness, cast: m.castShadow, receive: m.receiveShadow };
          b.geos.push(g); b.meshes.push(m); buckets.set(key, b);
          m.visible = false; hidden.push(m);
          continue;
        }
      }
      visit(ch);
    }
  };
  visit(root);
  const merged: THREE.Mesh[] = [];
  for (const b of buckets.values()) {
    const geo = mergeGeometries(b.geos, false);
    b.geos.forEach((g) => g.dispose());
    if (!geo) { b.meshes.forEach((m) => { m.visible = true; }); continue; }
    const mat = b.basic ? new THREE.MeshBasicMaterial({ vertexColors: true }) : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: b.roughness, metalness: b.metalness });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = b.cast; mesh.receiveShadow = b.receive; mesh.raycast = noRaycast; // clicks still hit the hidden originals
    mesh.userData.baked = true;
    root.add(mesh); merged.push(mesh);
  }
  return () => {
    for (const m of merged) { root.remove(m); m.geometry.dispose(); (m.material as THREE.Material).dispose(); }
    for (const h of hidden) h.visible = true;
  };
}

/**
 * Group whose still content is drawn as a few merged meshes. `deps` must change whenever the meshes inside
 * change (added, removed, moved, recoloured); animated parts must be marked with userData={LIVE}.
 */
export function Bake({ deps = [], children, position, rotation }: { deps?: unknown[]; children?: React.ReactNode; position?: [number, number, number]; rotation?: [number, number, number] }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => (ref.current ? bakeInto(ref.current) : undefined), deps); // eslint-disable-line react-hooks/exhaustive-deps
  // Only known props reach the three group: dev tooling adds data-* attributes that three objects cannot take.
  return <group ref={ref} userData={BAKE_ROOT} position={position} rotation={rotation}>{children}</group>;
}
const BAKE_ROOT = { bakeRoot: true };

/** A drei <Html> label that exists only while the camera is within `maxDist` metres (checked a few times a second). */
type HtmlProps = React.ComponentProps<typeof Html>;
export function NearHtml({ maxDist, position, children, center, distanceFactor, style, zIndexRange, className }: { maxDist: number; position?: [number, number, number]; children?: React.ReactNode } & Pick<HtmlProps, "center" | "distanceFactor" | "style" | "zIndexRange" | "className">) {
  const ref = useRef<THREE.Group>(null);
  const [near, setNear] = useState(false);
  const state = useRef({ near: false, n: Math.floor(Math.random() * 10) });
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    const s = state.current;
    if (s.n++ % 10 || !ref.current) return;
    ref.current.getWorldPosition(v);
    const want = v.distanceTo(camera.position) < maxDist;
    if (want !== s.near) { s.near = want; setNear(want); }
  });
  return <group ref={ref} position={position}>{near && <Html center={center} distanceFactor={distanceFactor} style={style} zIndexRange={zIndexRange} className={className}>{children}</Html>}</group>;
}
