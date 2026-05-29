import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type TransitionEvent,
} from "react";
import clsx from "clsx";

import { COLLAPSE_DURATION_MS, COLLAPSE_EASING } from "./AnimateCollapse";

interface Props {
  children: ReactNode;
  className?: string;
  /** Re-measure when these change (step key, list length, etc.). */
  deps?: readonly unknown[];
  /** Skip transition when height change is smaller than this (e.g. building ↔ floor). */
  similarThreshold?: number;
  /** Clip overflow only during height transition (keeps popovers visible when idle). */
  clipWhileAnimating?: boolean;
}

/**
 * Animates height between content sizes (expand down / shrink up).
 * Unlike enter-from-zero collapse, keeps the previous height and transitions to the next.
 */
export function AnimateExpand({
  children,
  className,
  deps = [],
  similarThreshold = 12,
  clipWhileAnimating = true,
}: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const heightRef = useRef<number | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [canTransition, setCanTransition] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [animating, setAnimating] = useState(false);

  const onTransitionEnd = useCallback((e: TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName === "height") setAnimating(false);
  }, []);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setCanTransition(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().height);
      const prev = heightRef.current;

      if (prev === null) {
        heightRef.current = next;
        setHeight(next);
        return;
      }

      if (prev === next) return;

      const delta = Math.abs(next - prev);
      const shouldAnimate =
        canTransition && !reducedMotion && delta > similarThreshold;

      if (!shouldAnimate) {
        setAnimating(false);
        heightRef.current = next;
        setHeight(next);
        return;
      }

      const outer = outerRef.current;
      const from = outer
        ? Math.ceil(outer.getBoundingClientRect().height)
        : prev;

      setAnimating(true);
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

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);

    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- explicit deps from caller
  }, [canTransition, reducedMotion, similarThreshold, ...deps]);

  const style: CSSProperties = {
    height: height ?? "auto",
    overflow:
      clipWhileAnimating && animating ? "hidden" : "visible",
    transition:
      canTransition && !reducedMotion && height !== null
        ? `height ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}`
        : "none",
  };

  return (
    <div
      ref={outerRef}
      className={clsx(className)}
      style={style}
      onTransitionEnd={onTransitionEnd}
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
