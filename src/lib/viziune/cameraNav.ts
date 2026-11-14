// On-screen / keyboard navigation of the 3D factory camera. Pure vector maths, no React or three.
export type V3 = [number, number, number];
export type NavAction = "inainte" | "inapoi" | "stanga" | "dreapta" | "rotStanga" | "rotDreapta" | "aproape" | "departe";

export const NAV_LIMITS = { minDist: 6, maxDist: 120, rotStep: Math.PI / 8, zoomIn: 0.7, zoomOut: 1.4 };

/**
 * Next camera view for one button press: moves are relative to where the camera looks (forward = into the
 * screen on the floor), step grows with the distance so a far view moves faster; rotation orbits the target.
 */
export function nextView(pos: V3, target: V3, action: NavAction): { pos: V3; target: V3 } {
  const off: V3 = [pos[0] - target[0], pos[1] - target[1], pos[2] - target[2]];
  const dist = Math.hypot(...off);
  const flat = Math.hypot(off[0], off[2]) || 1;
  const fwd: [number, number] = [-off[0] / flat, -off[2] / flat];
  const right: [number, number] = [-fwd[1], fwd[0]];
  const step = Math.max(4, dist * 0.25);
  const move = (dx: number, dz: number) => ({ pos: [pos[0] + dx, pos[1], pos[2] + dz] as V3, target: [target[0] + dx, target[1], target[2] + dz] as V3 });
  switch (action) {
    case "inainte": return move(fwd[0] * step, fwd[1] * step);
    case "inapoi": return move(-fwd[0] * step, -fwd[1] * step);
    case "dreapta": return move(right[0] * step, right[1] * step);
    case "stanga": return move(-right[0] * step, -right[1] * step);
    case "rotStanga": case "rotDreapta": {
      const a = action === "rotStanga" ? -NAV_LIMITS.rotStep : NAV_LIMITS.rotStep;
      const x = off[0] * Math.cos(a) - off[2] * Math.sin(a), z = off[0] * Math.sin(a) + off[2] * Math.cos(a);
      return { pos: [target[0] + x, pos[1], target[2] + z], target };
    }
    case "aproape": case "departe": {
      const want = Math.min(NAV_LIMITS.maxDist, Math.max(NAV_LIMITS.minDist, dist * (action === "aproape" ? NAV_LIMITS.zoomIn : NAV_LIMITS.zoomOut)));
      const k = want / (dist || 1);
      return { pos: [target[0] + off[0] * k, target[1] + off[1] * k, target[2] + off[2] * k], target };
    }
  }
}

/** Close look at one machine: slightly from the left and from the front, high enough to see the operators. */
export const focusView = (x: number, z: number): { pos: V3; target: V3 } => ({ pos: [x - 4, 15, z + 13], target: [x, 0, z] });
