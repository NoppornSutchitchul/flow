import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ChevronRight, Clock, Globe, KeyRound, Shield } from "lucide-react";
import clsx from "clsx";

import { PresenceIndicator } from "../components/ui/PresenceIndicator";
import { usePresenceStatus } from "../hooks/usePresenceStatus";
import { LanguageMenu } from "../components/ui/LanguageMenu";
import { PasswordChangeGuidance } from "../components/users/PasswordSetupGuidance";
import { SettingsAboutCard } from "../components/users/SettingsAboutCard";
import { useAuth } from "../lib/auth";
import { changePasswordErrorMessage } from "../lib/authErrors";
import { authApi, settingsApi } from "../lib/api";
import { prefetchObservedQueries } from "../lib/queryRefresh";
import {
  passwordContainsInvalidChars,
  validateNewPassword,
} from "../lib/passwordRules";
import { useDepartments } from "../lib/departments";
import { canShowAdminHubInSettings, isSystemAdmin } from "../lib/appFeatures";
import {
  TIME_ALERT_DEFAULTS,
  TIME_ALERT_KEYS,
  applyTimeAlertSettings,
  userPositionSubtitle,
} from "../lib/format";

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-[color:var(--color-line)] bg-white px-3.5 text-sm shadow-sm transition-[border-color,box-shadow] placeholder:text-[color:var(--color-ink-muted)] focus:border-[color:var(--color-ink)]/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/8";

function readNumber(key: string, fallback: number) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function readThresholdInitial(which: "warn" | "danger" | "breach"): number {
  const primary = TIME_ALERT_KEYS[which];
  const fb = TIME_ALERT_DEFAULTS[which];
  return readNumber(primary, fb);
}

function SettingsCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon?: typeof Clock;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="mb-4 flex items-start gap-3">
        {Icon ? (
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-paper-2)] ring-1 ring-[color:var(--color-line)]/80">
            <Icon className="h-5 w-5 text-[color:var(--color-delivered-fg)]" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold tracking-tight text-[color:var(--color-ink)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function PrimaryButton({
  children,
  disabled,
  type = "button",
  onClick,
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
  onClick?: () => void;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-11 items-center justify-center rounded-xl bg-[color:var(--color-ink)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[color:var(--color-ink-muted)]/30 disabled:text-[color:var(--color-ink-soft)] disabled:hover:opacity-100"
    >
      {children}
    </button>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const { departmentLabel } = useDepartments();
  const { current } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [passwordErr, setPasswordErr] = useState<string | null>(null);
  const [passwordPending, setPasswordPending] = useState(false);
  const presence = usePresenceStatus(Boolean(current));
  const qc = useQueryClient();

  const [warn, setWarn] = useState<string>(String(readThresholdInitial("warn")));
  const [danger, setDanger] = useState<string>(String(readThresholdInitial("danger")));
  const [breach, setBreach] = useState<string>(String(readThresholdInitial("breach")));
  const [saved, setSaved] = useState(false);

  const { data: serverThresholds } = useQuery({
    queryKey: ["settings", "time-alerts"],
    queryFn: settingsApi.getTimeAlerts,
  });

  useEffect(() => {
    if (!serverThresholds) return;
    applyTimeAlertSettings(serverThresholds);
    setWarn(String(serverThresholds.warn));
    setDanger(String(serverThresholds.danger));
    setBreach(String(serverThresholds.breach));
  }, [serverThresholds]);

  useEffect(() => {
    if (!saved) return;
    const id = window.setTimeout(() => setSaved(false), 1500);
    return () => window.clearTimeout(id);
  }, [saved]);

  const error = useMemo<string | null>(() => {
    const w = Number(warn);
    const d = Number(danger);
    const b = Number(breach);
    if (![w, d, b].every((x) => Number.isFinite(x) && x >= 0)) {
      return t("settings.time_err_positive");
    }
    if (!(w < d && d < b)) {
      return t("settings.time_err_order");
    }
    return null;
  }, [warn, danger, breach, t]);

  const isAdmin = isSystemAdmin(current);

  const passwordDisplayErr = useMemo(() => {
    if (passwordContainsInvalidChars(newPassword)) {
      return t("auth.password_invalid_chars");
    }
    const pwCheck = validateNewPassword(newPassword);
    const next = newPassword.trim();
    if (next.length > 0 && pwCheck === "too_short") {
      return t("auth.password_min_length");
    }
    if (confirmPassword.length > 0 && next !== confirmPassword.trim()) {
      return t("auth.password_mismatch");
    }
    return passwordErr;
  }, [newPassword, confirmPassword, passwordErr, t]);

  const canSubmitPassword = useMemo(() => {
    if (passwordPending || !currentPassword.trim()) return false;
    const next = newPassword.trim();
    if (validateNewPassword(newPassword) !== "ok") return false;
    if (next !== confirmPassword.trim()) return false;
    return true;
  }, [currentPassword, newPassword, confirmPassword, passwordPending]);

  const onSave = async () => {
    if (!isAdmin || error || !current) return;
    const payload = {
      warn: Number(warn),
      danger: Number(danger),
      breach: Number(breach),
    };
    const savedPayload = await settingsApi.updateTimeAlerts({
      ...payload,
      actor_id: current.id,
    });
    applyTimeAlertSettings(savedPayload);
    setSaved(true);
    void qc.invalidateQueries({ queryKey: ["settings", "time-alerts"] });
    void prefetchObservedQueries(qc, ["requests"]);
    void prefetchObservedQueries(qc, ["request"]);
    void prefetchObservedQueries(qc, ["dashboard"]);
  };

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--color-ink)]">
          {t("settings.title")}
        </h1>
      </header>

      {current ? (
        <section
          aria-labelledby="settings-profile-heading"
          className="overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-gradient-to-br from-white via-white to-[color:var(--color-paper-2)] p-5 shadow-sm"
        >
          <div className="min-w-0">
              <p className="text-center text-xs font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)] sm:text-left">
                {t("settings.profile_title")}
              </p>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
                  <h2
                    id="settings-profile-heading"
                    className="min-w-0 truncate text-center text-xl font-semibold tracking-tight text-[color:var(--color-ink)] sm:text-left"
                  >
                    {current.name}
                  </h2>
                  <dl className="flex shrink-0 flex-wrap justify-center gap-4 sm:justify-end sm:gap-6 sm:text-right">
                    <ProfileMeta
                      label={t("settings.profile_position")}
                      value={userPositionSubtitle(current, (k) => t(k))}
                    />
                    {current.department ? (
                      <ProfileMeta
                        label={t("users.table.department")}
                        value={departmentLabel(current.department)}
                      />
                    ) : null}
                  </dl>
                </div>
                <PresenceIndicator
                  status={presence}
                  showLabel
                  className="justify-center sm:justify-start"
                />
              </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className="flex flex-col gap-4">
          <SettingsCard icon={Globe} title={t("settings.language")}>
            <LanguageMenu />
          </SettingsCard>

          <SettingsAboutCard />
        </div>

        <SettingsCard icon={KeyRound} title={t("auth.change_password_title")}>
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setPasswordMsg(null);
              setPasswordErr(null);
              const cur = currentPassword;
              const next = newPassword.trim();
              const pwCheck = validateNewPassword(next);
              if (pwCheck === "too_short") {
                setPasswordErr(t("auth.password_min_length"));
                return;
              }
              if (pwCheck === "invalid_chars") {
                setPasswordErr(t("auth.password_invalid_chars"));
                return;
              }
              if (next !== confirmPassword.trim()) {
                setPasswordErr(t("auth.password_mismatch"));
                return;
              }
              setPasswordPending(true);
              try {
                await authApi.changePassword(cur, next);
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
                setPasswordMsg(t("auth.change_password_success"));
              } catch (err) {
                setPasswordErr(changePasswordErrorMessage(err, t));
              } finally {
                setPasswordPending(false);
              }
            }}
          >
            <div className="space-y-3">
              <PasswordField
                label={t("auth.current_password")}
                value={currentPassword}
                onChange={(v) => {
                  setCurrentPassword(v);
                  setPasswordErr(null);
                }}
                autoComplete="current-password"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <PasswordField
                  label={t("auth.new_password")}
                  value={newPassword}
                  onChange={(v) => {
                    setNewPassword(v);
                    setPasswordErr(null);
                  }}
                  autoComplete="new-password"
                />
                <PasswordField
                  label={t("auth.confirm_new_password")}
                  value={confirmPassword}
                  onChange={(v) => {
                    setConfirmPassword(v);
                    setPasswordErr(null);
                  }}
                  autoComplete="new-password"
                />
              </div>
              {passwordDisplayErr || passwordMsg ? (
                <div aria-live="polite">
                  {passwordDisplayErr ? (
                    <p className="text-xs leading-snug text-red-600" role="alert">
                      {passwordDisplayErr}
                    </p>
                  ) : (
                    <p className="text-xs leading-snug font-medium text-emerald-700" role="status">
                      {passwordMsg}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
            <PasswordChangeGuidance
              newPassword={newPassword}
              confirmPassword={confirmPassword}
            />
            <div className="flex justify-end border-t border-[color:var(--color-line)]/80 pt-4">
              <PrimaryButton type="submit" disabled={!canSubmitPassword || passwordPending}>
                {passwordPending ? t("common.loading") : t("auth.change_password_submit")}
              </PrimaryButton>
            </div>
          </form>
        </SettingsCard>
      </div>

      <SettingsCard
        icon={Clock}
        title={t("settings.time_alert_thresholds")}
        description={t("settings.time_alert_thresholds_intro")}
      >
        <ol className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ThresholdField
            step={1}
            label={t("settings.time_warn_min")}
            tone="warn"
            value={warn}
            onChange={setWarn}
            readOnly={!isAdmin}
          />
          <ThresholdField
            step={2}
            label={t("settings.time_danger_min")}
            tone="danger"
            value={danger}
            onChange={setDanger}
            readOnly={!isAdmin}
          />
          <ThresholdField
            step={3}
            label={t("settings.time_overdue_min")}
            tone="breach"
            value={breach}
            onChange={setBreach}
            readOnly={!isAdmin}
          />
        </ol>

        <TimeThresholdRuler
          warn={Number(warn) || 0}
          danger={Number(danger) || 0}
          breach={Number(breach) || 0}
        />

        {isAdmin ? (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-[color:var(--color-line)]/80 pt-4">
            {error ? <span className="text-sm text-red-600">{error}</span> : null}
            {saved && !error ? (
              <span className="text-sm font-medium text-[color:var(--color-delivered-fg)]">
                ✓ {t("settings.saved")}
              </span>
            ) : null}
            <PrimaryButton type="button" onClick={onSave} disabled={!!error}>
              {t("common.save")}
            </PrimaryButton>
          </div>
        ) : (
          <p className="mt-5 border-t border-[color:var(--color-line)]/80 pt-4 text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
            {t("settings.time_alert_admin_only_note")}
          </p>
        )}
      </SettingsCard>

      {canShowAdminHubInSettings(current) ? (
        <section className="rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--color-paper-2)] ring-1 ring-[color:var(--color-line)]/80">
                <Shield className="h-5 w-5 text-[color:var(--color-delivered-fg)]" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-semibold">{t("settings.admin_hub_title")}</h2>
                <p className="mt-1 text-xs leading-relaxed text-[color:var(--color-ink-soft)]">
                  {t("settings.admin_hub_desc")}
                </p>
              </div>
            </div>
            <Link
              to="/admin"
              className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[color:var(--color-ink)] px-5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
            >
              {t("settings.admin_hub_open")}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ProfileMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wide text-[color:var(--color-ink-muted)]">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-medium leading-snug text-[color:var(--color-ink)]">{value}</dd>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[color:var(--color-ink-muted)]">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={INPUT_CLASS}
      />
    </label>
  );
}

type ThresholdTone = "warn" | "danger" | "breach";

const THRESHOLD_TONE_CLASS: Record<ThresholdTone, string> = {
  warn: "bg-[color:var(--color-row-warning)] border-[color:var(--color-stock-low-bg)]/80",
  danger: "bg-[color:var(--color-row-breach)]/50 border-[color:var(--color-pending-bg)]/60",
  breach: "bg-[color:var(--color-row-breach)] border-[color:var(--color-pending-bg)]",
};

function ThresholdField({
  step,
  label,
  tone,
  value,
  onChange,
  readOnly = false,
}: {
  step: number;
  label: string;
  tone: ThresholdTone;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <li
      className={clsx(
        "flex list-none flex-col gap-3 rounded-xl border p-4",
        THRESHOLD_TONE_CLASS[tone],
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/90 text-xs font-bold tabular-nums text-[color:var(--color-ink)] shadow-sm ring-1 ring-[color:var(--color-line)]/80"
          aria-hidden
        >
          {step}
        </span>
        <span className="text-xs font-medium leading-snug text-[color:var(--color-ink-soft)]">{label}</span>
      </div>
      <div className="flex items-baseline justify-end gap-2">
        <input
          inputMode="numeric"
          aria-label={label}
          value={value}
          readOnly={readOnly}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
          className={clsx(
            "w-20 rounded-xl border border-[color:var(--color-line)] bg-white px-3 py-2 text-right text-2xl font-semibold tabular-nums text-[color:var(--color-ink)] shadow-sm focus:border-[color:var(--color-ink)]/25 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/8",
            readOnly && "cursor-default opacity-90",
          )}
        />
        <span className="pb-1 text-sm font-medium text-[color:var(--color-ink-soft)]">
          {t("settings.minutes_suffix")}
        </span>
      </div>
    </li>
  );
}

function TimeThresholdRuler({
  warn,
  danger,
  breach,
}: {
  warn: number;
  danger: number;
  breach: number;
}) {
  const scaleMax = Math.max(breach, 1);
  const pct = (m: number) => Math.min(100, (m / scaleMax) * 100);
  const pWarn = pct(warn);
  const pDanger = pct(danger);

  return (
    <div className="mt-5 min-w-0 overflow-hidden rounded-xl bg-[color:var(--color-paper-2)]/60 px-4 py-3 ring-1 ring-[color:var(--color-line)]/60">
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white ring-1 ring-[color:var(--color-line)]/80">
        <div
          className="absolute inset-y-0 bg-[color:var(--color-row-warning)]"
          style={{ left: `${pWarn}%`, width: `${Math.max(0, pDanger - pWarn)}%` }}
        />
        <div
          className="absolute inset-y-0 bg-[color:var(--color-row-breach)]"
          style={{ left: `${pDanger}%`, width: `${Math.max(0, 100 - pDanger)}%` }}
        />
      </div>
      <div className="relative mt-2 h-4 text-[10px] tabular-nums text-[color:var(--color-ink-muted)]">
        <span className="absolute left-0 top-0">0</span>
        {warn > 0 ? (
          <span className="absolute top-0 -translate-x-1/2" style={{ left: `${pWarn}%` }}>
            {warn}
          </span>
        ) : null}
        {danger > warn ? (
          <span className="absolute top-0 -translate-x-1/2" style={{ left: `${pDanger}%` }}>
            {danger}
          </span>
        ) : null}
        <span className="absolute right-0 top-0">{breach}</span>
      </div>
    </div>
  );
}
