// "Beautiful" graphics: glowing signal lights and ceiling lamps, filmic colours, smooth edges and a light vignette. Off in the fast mode.
// Built with createElement: these effects pass every prop to three objects, and the dev tooling's
// data-* attributes added to JSX would crash them.
import React, { createElement as h } from "react";
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";

export function Effects() {
  return h(EffectComposer, { multisampling: 0, enableNormalPass: false, children: [
    h(Bloom, { key: "bloom", mipmapBlur: true, luminanceThreshold: 1, luminanceSmoothing: 0.2, intensity: 0.55 }),
    h(ToneMapping, { key: "tone", mode: ToneMappingMode.ACES_FILMIC }),
    h(SMAA, { key: "smaa" }),
    h(Vignette, { key: "vig", offset: 0.3, darkness: 0.45 }),
  ] } as any);
}

/** If the effects fail on a computer's graphics card, the factory keeps drawing in the fast mode instead of going blank. */
export class EffectsGuard extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("Viziune: efectele grafice au fost oprite", e); this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}
