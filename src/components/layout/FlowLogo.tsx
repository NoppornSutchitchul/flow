import clsx from "clsx";

interface Props {
  className?: string;
}

/**
 * Brand mark for "Flow" — an S-curve between two dots, framed in a
 * rounded square. Reads as "stuff flows from A to B".
 */
export function FlowLogo({ className }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={clsx("text-[color:var(--color-ink)]", className)}
      aria-hidden
    >
      <rect width="24" height="24" rx="6" fill="currentColor" />
      <path
        d="M6 7 C 12 7 12 17 18 17"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="6" cy="7" r="1.8" fill="white" />
      <circle cx="18" cy="17" r="1.8" fill="white" />
    </svg>
  );
}
