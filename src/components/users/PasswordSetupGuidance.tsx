import clsx from "clsx";
import { Check, Circle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { newPasswordMeetsRules, PASSWORD_MIN_LENGTH } from "../../lib/passwordRules";

function GuidanceList({
  title,
  tips,
}: {
  title: string;
  tips: { ok: boolean; text: string }[];
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/40 px-3 py-3">
      <p className="text-xs font-medium text-[color:var(--color-ink-muted)]">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {tips.map((tip) => (
          <li key={tip.text} className="flex items-start gap-2 text-sm leading-snug">
            {tip.ok ? (
              <Check
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-delivered-fg)]"
                aria-hidden
              />
            ) : (
              <Circle
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--color-ink-muted)]"
                strokeWidth={2}
                aria-hidden
              />
            )}
            <span
              className={clsx(
                tip.ok ? "text-[color:var(--color-ink-soft)]" : "text-[color:var(--color-ink-muted)]",
              )}
            >
              {tip.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PasswordSetupGuidance({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}) {
  const { t } = useTranslation();
  const trimmed = password.trim();
  const lengthOk = trimmed.length >= PASSWORD_MIN_LENGTH;
  const charsOk = trimmed.length > 0 && !/[^\x21-\x7E]/.test(trimmed);
  const matches =
    password.length > 0 && password.trim() === confirmPassword.trim();

  return (
    <GuidanceList
      title={t("auth.password_guidance_title")}
      tips={[
        { ok: lengthOk && charsOk, text: t("auth.password_tip_ascii_length") },
        { ok: matches, text: t("auth.password_tip_confirm") },
      ]}
    />
  );
}

export function PasswordChangeGuidance({
  newPassword,
  confirmPassword,
}: {
  newPassword: string;
  confirmPassword: string;
}) {
  const { t } = useTranslation();
  const meetsRules = newPasswordMeetsRules(newPassword);
  const matches =
    newPassword.length > 0 && newPassword.trim() === confirmPassword.trim();

  return (
    <GuidanceList
      title={t("auth.change_password_guidance_title")}
      tips={[
        { ok: meetsRules, text: t("auth.change_password_tip_length") },
        { ok: matches, text: t("auth.change_password_tip_confirm") },
      ]}
    />
  );
}
