import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export const backNavClassName = clsx(
  "inline-flex items-center gap-2.5 w-fit max-w-full rounded-xl border border-[color:var(--color-line)]",
  "bg-white px-4 py-2.5 sm:px-5 sm:py-3 text-base sm:text-lg font-semibold text-[color:var(--color-ink)]",
  "shadow-sm cursor-pointer select-none transition-colors",
  "hover:bg-[color:var(--color-paper-2)] hover:border-[color:var(--color-ink)]/15 active:bg-[color:var(--color-paper-2)]/90",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/15",
);

function BackNavContent({ children }: { children: ReactNode }) {
  return (
    <>
      <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" aria-hidden />
      <span className="text-left leading-snug">{children}</span>
    </>
  );
}

export function BackNavLink({
  to,
  children,
  className,
  ...props
}: { to: string; children: ReactNode } & Omit<ComponentProps<typeof Link>, "to" | "children">) {
  return (
    <Link to={to} className={clsx(backNavClassName, className)} {...props}>
      <BackNavContent>{children}</BackNavContent>
    </Link>
  );
}

export function BackNavButton({
  children,
  className,
  ...props
}: { children: ReactNode } & ComponentProps<"button">) {
  return (
    <button type="button" className={clsx(backNavClassName, className)} {...props}>
      <BackNavContent>{children}</BackNavContent>
    </button>
  );
}
