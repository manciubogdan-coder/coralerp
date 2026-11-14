// "Beautiful" graphics: glowing signal lights and ceiling lamps, filmic colours, smooth edges and a light vignette. Off in the fast mode.
// Built with createElement: these effects pass every prop to three objects, and the dev tooling's
// data-* attributes added to JSX would crash them.
import { createElement as h } from "react";
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
