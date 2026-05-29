import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import clsx from "clsx";

export const COLLAPSE_DURATION_MS = 280;
export const COLLAPSE_EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Props {
  show: boolean;
  children: ReactNode;
  className?: string;
  /** Extra styles on the inner overflow wrapper. */
  innerClassName?: string;
  /** Animate open when show becomes true (mount or step change). */
  enterOnMount?: boolean;
}

/**
 * Smoothly expands/collapses conditional blocks (grid 0fr → 1fr).
 * Pairs well with AnimateResize — parent height tracks this animation via ResizeObserver.
 */
export function AnimateCollapse({
  show,
  children,
  className,
  innerClassName,
  enterOnMount = false,
}: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const prevShowRef = useRef(false);
  const [open, setOpen] = useState(() => (enterOnMount && show ? false : show));

  useLayoutEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useLayoutEffect(() => {
    if (reducedMotion) {
      setOpen(show);
      prevShowRef.current = show;
      return;
    }

    const rising = show && !prevShowRef.current;

    if (enterOnMount && rising) {
      setOpen(false);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setOpen(true));
      });
      prevShowRef.current = show;
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }

    setOpen(show);
    prevShowRef.current = show;
  }, [show, enterOnMount, reducedMotion]);

  const transition: CSSProperties["transition"] = reducedMotion
    ? "none"
    : `grid-template-rows ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}, opacity ${COLLAPSE_DURATION_MS}ms ${COLLAPSE_EASING}`;

  return (
    <div
      className={clsx(
        "grid",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
      style={{ transition }}
      aria-hidden={!open}
    >
      <div className={clsx("min-h-0 overflow-hidden", innerClassName)}>
        {children}
      </div>
    </div>
  );
}
