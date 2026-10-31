import { domAnimation, LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { useMotionTokens } from "../lib/motion";

/**
 * Motion for React for the whole app, mounted once around the router. Its
 * animation features ship in the entry chunk, so an `m.*` element animates
 * from its first render: loaded after the first paint, an entrance would hold
 * its starting state (words at opacity 0, a hint at height 0) until they
 * arrived, and for good if the fetch failed. Reduced motion, from the system
 * or the Settings switch, turns Motion's own transforms off too, and the
 * default transition is --duration-slow on --ease-out. `strict` refuses
 * `motion.*`, which would bundle every feature, not only these.
 */
export function QuestMotion({ children }: { children: ReactNode }) {
  const t = useMotionTokens();
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig
        reducedMotion={t.reduced ? "always" : "never"}
        transition={{ duration: t.slow, ease: t.out }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
