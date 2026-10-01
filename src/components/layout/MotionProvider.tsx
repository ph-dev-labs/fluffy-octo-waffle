"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/** Global motion defaults. `reducedMotion="user"` respects the OS accessibility setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </MotionConfig>
  );
}
