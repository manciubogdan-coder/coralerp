import { createContext, useContext } from "react";

/** True while the visitor walks through the factory at eye height (labels shrink, clicks go through the crosshair). */
export const WalkCtx = createContext(false);
export const useWalking = () => useContext(WalkCtx);
/** Html label size: much smaller up close at eye height than in the bird's-eye views. */
export const labelScale = (walking: boolean, base: number) => (walking ? base * 0.45 : base);
