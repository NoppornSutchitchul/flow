import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";

import { COLLAPSE_DURATION_MS, COLLAPSE_EASING } from "./AnimateCollapse";

const SLIDE_OFFSET_PX = 14;

interface Props {
  children: ReactNode;
  /** When this changes, slide content up/down to match height growth or shrink. */
  slideKey: string | number;
  className?: string;
}

/**
 * Slides inner content vertically when `slideKey` changes and measured height differs.
 * Pairs with AnimateResize on a parent — expand slides down, shrink slides up.
 */
export function AnimateSlide({ children, slideKey, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const heightBeforeKeyRef = useRef<number | null>(null);
  const prevKeyRef = useRef(slideKey);
  const [offsetY, setOffsetY] = useState(0);
  const [opacity, setOpacity] = useState(1);
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
    const el = ref.current;
    if (!el) return;

    const keyChanged = prevKeyRef.current !== slideKey;
    const after = Math.ceil(el.getBoundingClientRect().height);
    const before = heightBeforeKeyRef.current;

    if (
      keyChanged &&
      before !== null &&
      canTransition &&
      !reducedMotion
    ) {
      const delta = after - before;
      if (delta > 6) {
        setOffsetY(-SLIDE_OFFSET_PX);
        setOpacity(0.82);
        void el.offsetHeight;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOffsetY(0);
            setOpacity(1);
          });
        });
      } else if (delta < -6) {
        setOffsetY(SLIDE_OFFSET_PX);
        setOpacity(0.82);
        void el.offsetHeight;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setOffsetY(0);
            setOpacity(1);
          });
        });
      }
    }

    prevKeyRef.current = slideKey;

    return () => {
      if (el) {
        heightBeforeKeyRef.current = Math.ceil(
          el.getBoundingClientRect().height,
        );
      }
    };
  }, [slideKey, canTransition, reducedMotion]);

  const style: CSSProperties = {
    transform: `translateY(${offsetY}px)`,
    opacity,
    transition:
      canTransition && !reducedMotion
        ? `transform ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}, opacity ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}`
        : "none",
  };

  return (
    <div ref={ref} className={clsx(className)} style={style}>
      {children}
    </div>
  );
}
