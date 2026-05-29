import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";

type Props = {
  label: string;
  children: ReactNode;
  className?: string;
  /** Wider tooltip for multi-line report hints. */
  wide?: boolean;
};

export function HoverTooltip({ label, children, className, wide }: Props) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ left: 0, top: 0 });

  const show = () => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ left: r.left + r.width / 2, top: r.top - 6 });
    setVisible(true);
  };

  const hide = () => setVisible(false);

  return (
    <>
      <span
        ref={anchorRef}
        className={clsx("inline-flex shrink-0", className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {visible &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className={clsx(
              "pointer-events-none fixed z-[300] -translate-x-1/2 -translate-y-full whitespace-normal rounded-md bg-[color:var(--color-ink)] px-2.5 py-1.5 text-center text-[11px] font-medium leading-snug text-white shadow-md",
              wide ? "max-w-[20rem]" : "max-w-[14rem]",
            )}
            style={{ left: coords.left, top: coords.top }}
          >
            {label}
          </span>,
          document.body,
        )}
    </>
  );
}
