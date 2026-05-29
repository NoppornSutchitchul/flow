import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";

import { COLLAPSE_DURATION_MS, COLLAPSE_EASING } from "./AnimateCollapse";

interface Props {
  children: ReactNode;
  className?: string;
  /** When false, height follows content with no transition. */
  enabled?: boolean;
}

/**
 * Smoothly animates height when children change size (e.g. modal steps, expandable panels).
 * Uses ResizeObserver — dropdowns with position:absolute do not affect measured height.
 */
export function AnimateResize({ children, className, enabled = true }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef<number | null>(null);
  const canTransitionRef = useRef(false);
  const [height, setHeight] = useState<number | null>(null);
  const [canTransition, setCanTransition] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const applyHeight = (next: number, animate: boolean) => {
      const prev = heightRef.current;
      if (prev === next) return;

      const shouldAnimate =
        animate &&
        enabled &&
        canTransitionRef.current &&
        !reducedMotion &&
        prev !== null;

      if (!shouldAnimate) {
        heightRef.current = next;
        setHeight(next);
        return;
      }

      const outer = outerRef.current;
      const from =
        outer != null
          ? Math.ceil(outer.getBoundingClientRect().height)
          : prev;

      heightRef.current = from;
      setHeight(from);
      void outer?.offsetHeight;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          heightRef.current = next;
          setHeight(next);
        });
      });
    };

    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      const isFirst = heightRef.current === null;
      applyHeight(next, !isFirst);
    };

    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        canTransitionRef.current = true;
        setCanTransition(true);
      });
    });

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [enabled, reducedMotion]);

  const style: CSSProperties = {
    height: height ?? "auto",
    overflow: "hidden",
    transition:
      enabled &&
      canTransition &&
      !reducedMotion &&
      height !== null
        ? `height ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}`
        : "none",
  };

  return (
    <div ref={outerRef} className={clsx(className)} style={style}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
