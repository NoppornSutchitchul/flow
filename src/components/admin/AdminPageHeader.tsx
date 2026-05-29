import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props {
  title: string;
  intro?: string;
  actions?: ReactNode;
}

/** Shared admin sub-page header — matches inventory (คลังสินค้า) layout. */
export function AdminPageHeader({ title, intro, actions }: Props) {
  return (
    <header className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {intro ? (
        <p className="max-w-2xl text-sm text-[color:var(--color-ink-soft)]">{intro}</p>
      ) : null}
    </header>
  );
}

const adminHeaderBtnBase =
  "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium box-border";

export const adminHeaderBtnSecondary =
  `${adminHeaderBtnBase} border border-[color:var(--color-line)] bg-white transition-colors hover:bg-[color:var(--color-paper-2)]`;

export const adminHeaderBtnPrimary =
  `${adminHeaderBtnBase} bg-[color:var(--color-ink)] text-white hover:opacity-90`;

export function AdminHeaderButton({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      className={clsx(
        variant === "primary" ? adminHeaderBtnPrimary : adminHeaderBtnSecondary,
        className,
      )}
      {...props}
    />
  );
}
