import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Pencil, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";

import { AnimateResize } from "../ui/AnimateResize";
import { AnimateSlide } from "../ui/AnimateSlide";
import { roomOptionsApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  filterProductNameInput,
  productNameFieldInvalid,
  productNameLangOk,
} from "../../lib/langInput";
import {
  BILINGUAL_ROOM_OPTION_KINDS,
  ROOM_OPTION_KINDS,
  optionsForKind,
  roomOptionBilingualListLabel,
  useRoomOptions,
} from "../../lib/roomOptions";
import type { RoomAttributeOption, RoomOptionKind } from "../../lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
}

function filterCodeInput(kind: RoomOptionKind, raw: string): string {
  if (kind === "building" || kind === "floor" || kind === "size") {
    return raw.replace(/\D/g, "").slice(0, 3);
  }
  if (kind === "view" || kind === "bed") {
    return raw
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 32)
      .toLowerCase();
  }
  return raw.replace(/\s+/g, " ").trim().slice(0, 32);
}

function normalizeOptionCode(kind: RoomOptionKind, raw: string): string {
  const code = raw.trim();
  if (kind === "view" || kind === "bed") return code.toLowerCase();
  return code;
}

function LangInput({
  locale,
  code,
  value,
  onChange,
  placeholder,
  invalid,
  hint,
}: {
  locale: "th" | "en";
  code: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  invalid: boolean;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <label
        className={clsx(
          "flex h-10 items-stretch overflow-hidden rounded-lg border bg-white shadow-sm",
          invalid
            ? "border-red-300 focus-within:ring-2 focus-within:ring-red-200/70"
            : "border-[color:var(--color-line)]/80 focus-within:ring-2 focus-within:ring-[color:var(--color-ink)]/12",
        )}
      >
        <span
          className={clsx(
            "inline-flex w-9 shrink-0 items-center justify-center border-r font-mono text-[10px] font-bold",
            invalid
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-[color:var(--color-line)]/60 bg-[color:var(--color-paper-2)]/70 text-[color:var(--color-ink-muted)]",
          )}
          aria-hidden
        >
          {code}
        </span>
        <input
          lang={locale}
          value={value}
          onChange={(e) =>
            onChange(filterProductNameInput(locale, e.target.value))
          }
          placeholder={placeholder}
          aria-invalid={invalid}
          className="min-w-0 flex-1 bg-transparent px-3 text-sm focus:outline-none"
        />
      </label>
      {invalid && hint ? (
        <p className="mt-1 text-[11px] font-medium text-red-600">{hint}</p>
      ) : null}
    </div>
  );
}

export function RoomOptionsManagerModal({ open, onClose }: Props) {
  const { t } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const { data: allOptions = [], isLoading } = useRoomOptions(open);
  const formRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<RoomOptionKind>("building");
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [labelTh, setLabelTh] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [valueNum, setValueNum] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const isEdit = editId != null;

  const tabOptions = useMemo(
    () => optionsForKind(allOptions, tab),
    [allOptions, tab],
  );

  const needsBilingual =
    BILINGUAL_ROOM_OPTION_KINDS.includes(tab) || tab === "type";

  const clearForm = () => {
    setEditId(null);
    setCode("");
    setLabelTh("");
    setLabelEn("");
    setValueNum("");
    setShowErrors(false);
    setFormError(null);
  };

  const startEdit = (row: RoomAttributeOption) => {
    setEditId(row.id);
    setCode(row.code);
    setLabelTh(row.label_th);
    setLabelEn(row.label_en);
    setValueNum(
      row.value_num != null ? String(row.value_num) : row.code,
    );
    setShowErrors(false);
    setFormError(null);
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  };

  useEffect(() => {
    if (!open) {
      setTab("building");
      clearForm();
      setDeleteId(null);
    }
  }, [open]);

  useEffect(() => {
    clearForm();
  }, [tab]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (deleteId != null) {
        setDeleteId(null);
        return;
      }
      if (isEdit) {
        clearForm();
        return;
      }
      onClose();
    }
    if (open) document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose, deleteId, isEdit]);

  const codeTrim = code.trim();
  const thTrim = labelTh.trim();
  const enTrim = labelEn.trim();
  const sizeNum = tab === "size" ? Number(valueNum || codeTrim) : NaN;

  const effectiveCode =
    tab === "size" && Number.isFinite(sizeNum)
      ? String(sizeNum)
      : normalizeOptionCode(tab, codeTrim);

  const duplicateCode = useMemo(() => {
    if (!effectiveCode) return false;
    return tabOptions.some(
      (o) =>
        (editId == null || o.id !== editId) &&
        normalizeOptionCode(tab, o.code) === effectiveCode,
    );
  }, [effectiveCode, tabOptions, tab, editId]);

  const duplicateMessage = duplicateCode
    ? t("settings.guest_rooms_options_error_duplicate")
    : null;
  const alertMessage = formError ?? duplicateMessage;

  const codeInvalid =
    showErrors &&
    (tab === "size"
      ? !Number.isFinite(sizeNum) || sizeNum < 15 || sizeNum > 200
      : !codeTrim);

  const thInvalid =
    needsBilingual && productNameFieldInvalid("th", labelTh, showErrors);
  const enInvalid =
    needsBilingual && productNameFieldInvalid("en", labelEn, showErrors);

  const labelsValid =
    !needsBilingual ||
    (productNameLangOk("th", thTrim) && productNameLangOk("en", enTrim));

  const codeValid =
    tab === "size"
      ? Number.isFinite(sizeNum) && sizeNum >= 15 && sizeNum <= 200
      : Boolean(codeTrim);

  const editingRow = useMemo(
    () =>
      editId != null
        ? (tabOptions.find((o) => o.id === editId) ?? null)
        : null,
    [editId, tabOptions],
  );

  const editDirty = useMemo(() => {
    if (!editingRow) return false;
    const origTh = (editingRow.label_th ?? "").trim();
    const origEn = (editingRow.label_en ?? "").trim();
    const origCode = normalizeOptionCode(tab, editingRow.code);
    return (
      thTrim !== origTh ||
      enTrim !== origEn ||
      effectiveCode !== origCode
    );
  }, [editingRow, thTrim, enTrim, effectiveCode, tab]);

  const canSave =
    codeValid && labelsValid && !duplicateCode && (!isEdit || editDirty);

  const actorId = current?.id;

  const saveMut = useMutation({
    mutationFn: async () => {
      if (isEdit && editId != null) {
        return roomOptionsApi.update(editId, {
          code: effectiveCode,
          label_th: needsBilingual ? thTrim : labelTh.trim() || undefined,
          label_en: needsBilingual ? enTrim : labelEn.trim() || undefined,
          value_num: tab === "size" ? sizeNum : undefined,
          actor_id: actorId,
        });
      }
      return roomOptionsApi.create({
        kind: tab,
        code: effectiveCode,
        label_th: needsBilingual ? thTrim : labelTh.trim() || undefined,
        label_en: needsBilingual ? enTrim : labelEn.trim() || undefined,
        value_num: tab === "size" ? sizeNum : undefined,
        actor_id: actorId,
      });
    },
    onSuccess: () => {
      clearForm();
      void qc.invalidateQueries({ queryKey: ["room-options"] });
      void qc.invalidateQueries({ queryKey: ["guest-rooms"] });
    },
    onError: (err: Error) => {
      if (/duplicate/i.test(err.message)) {
        setFormError(t("settings.guest_rooms_options_error_duplicate"));
        return;
      }
      setFormError(err.message);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => roomOptionsApi.remove(id, actorId),
    onSuccess: () => {
      setDeleteId(null);
      if (editId != null) clearForm();
      void qc.invalidateQueries({ queryKey: ["room-options"] });
      void qc.invalidateQueries({ queryKey: ["guest-rooms"] });
    },
    onError: (err: Error) => {
      if (/in use/i.test(err.message)) {
        setFormError(t("settings.guest_rooms_options_error_in_use"));
      } else {
        setFormError(err.message);
      }
      setDeleteId(null);
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6">
      <div
        role="dialog"
        aria-modal
        aria-labelledby="room-options-title"
        className="flex max-h-[min(40rem,92dvh)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-4">
          <Layers className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
          <h2
            id="room-options-title"
            className="min-w-0 flex-1 text-base font-semibold leading-none"
          >
            {t("settings.guest_rooms_options_modal_title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto grid h-8 w-8 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("common.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-[color:var(--color-line)]/80 px-3 py-2"
          role="tablist"
        >
          {ROOM_OPTION_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
                tab === k
                  ? "bg-[color:var(--color-ink)] text-white"
                  : "text-[color:var(--color-ink-soft)] hover:bg-[color:var(--color-paper-2)]",
              )}
            >
              {t(`settings.guest_rooms_options_tab_${k}`)}
            </button>
          ))}
        </div>

        <AnimateResize className="min-h-0 shrink-0">
          <div className="max-h-[min(32rem,calc(92dvh-9rem))] overflow-y-auto overscroll-contain px-4 py-3">
          <AnimateSlide slideKey={tab}>
          <ul className="divide-y divide-[color:var(--color-line)]/60 rounded-xl border border-[color:var(--color-line)]/80 bg-white text-sm">
            {isLoading && (
              <li className="px-3 py-4 text-center text-[color:var(--color-ink-muted)]">
                {t("common.loading")}
              </li>
            )}
            {!isLoading && tabOptions.length === 0 && (
              <li className="px-3 py-4 text-center text-[color:var(--color-ink-muted)]">
                {t("settings.guest_rooms_options_empty")}
              </li>
            )}
            {tabOptions.map((row) => (
              <li
                key={row.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2.5",
                  editId === row.id &&
                    "bg-[color:var(--color-row-warning)] ring-1 ring-inset ring-[color:var(--color-stock-low-fg)]/18",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {roomOptionBilingualListLabel(row)}
                  </p>
                  {(tab === "view" || tab === "bed" || tab === "type") && (
                    <p className="truncate font-mono text-[11px] text-[color:var(--color-ink-muted)]">
                      {row.code}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    editId === row.id ? clearForm() : startEdit(row)
                  }
                  disabled={
                    saveMut.isPending ||
                    deleteMut.isPending ||
                    (isEdit && editId !== row.id)
                  }
                  className={clsx(
                    "grid h-8 w-8 shrink-0 place-items-center rounded-md border disabled:opacity-40",
                    editId === row.id
                      ? "border-red-200 bg-red-50 hover:bg-red-100"
                      : "border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]",
                  )}
                  aria-label={
                    editId === row.id
                      ? t("common.cancel")
                      : t("settings.guest_rooms_edit")
                  }
                >
                  {editId === row.id ? (
                    <X className="h-3.5 w-3.5 text-red-600" />
                  ) : (
                    <Pencil className="h-3.5 w-3.5 text-[color:var(--color-ink-muted)]" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteId(row.id)}
                  disabled={saveMut.isPending || deleteMut.isPending}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50 disabled:opacity-40"
                  aria-label={t("settings.guest_rooms_options_delete")}
                >
                  <Trash2 className="h-3.5 w-3.5 text-red-600/90" />
                </button>
              </li>
            ))}
          </ul>

          <div
            ref={formRef}
            className={clsx(
              "mt-4 space-y-3 rounded-xl border p-3 transition-colors duration-300",
              isEdit
                ? "border-[color:var(--color-stock-low-fg)]/30 bg-[color:var(--color-row-warning)] ring-2 ring-[color:var(--color-stock-low-bg)]/55"
                : "border-[color:var(--color-line)]/80 bg-[color:var(--color-paper-2)]/40",
            )}
          >
            <p
              className={clsx(
                "text-xs font-semibold uppercase tracking-wide",
                isEdit
                  ? "text-[color:var(--color-stock-low-fg)]"
                  : "text-[color:var(--color-ink-muted)]",
              )}
            >
              {isEdit
                ? t("settings.guest_rooms_options_edit_section")
                : t("settings.guest_rooms_options_add_section")}
            </p>

            {tab === "size" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[color:var(--color-ink-muted)]">
                  {t("settings.guest_rooms_options_size_sqm")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={valueNum || code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 3);
                    setValueNum(v);
                    setCode(v);
                    setFormError(null);
                  }}
                  className={clsx(
                    "w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2",
                    codeInvalid || duplicateCode
                      ? "border-red-300 focus:ring-red-200/70"
                      : "border-[color:var(--color-line)] focus:ring-[color:var(--color-ink)]/12",
                  )}
                  placeholder="35"
                />
              </label>
            ) : needsBilingual ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(5rem,6.5rem)_minmax(0,1fr)_minmax(0,1fr)] sm:items-end">
                <input
                  value={code}
                  onChange={(e) => {
                    setCode(filterCodeInput(tab, e.target.value));
                    setFormError(null);
                  }}
                  placeholder={t("settings.guest_rooms_options_code")}
                  aria-label={t("settings.guest_rooms_options_code")}
                  className={clsx(
                    "h-10 min-w-0 w-full rounded-lg border bg-white px-3 font-mono text-sm shadow-sm placeholder:text-[color:var(--color-ink-muted)] focus:outline-none focus:ring-2",
                    codeInvalid || duplicateCode
                      ? "border-red-300 focus:ring-red-200/70"
                      : "border-[color:var(--color-line)] focus:ring-[color:var(--color-ink)]/12",
                  )}
                />
                <div className="min-w-0">
                  <LangInput
                    locale="th"
                    code="TH"
                    value={labelTh}
                    onChange={(v) => {
                      setLabelTh(v);
                      setFormError(null);
                    }}
                    placeholder={t("settings.guest_rooms_options_label_th_ph")}
                    invalid={thInvalid}
                    hint={
                      thInvalid
                        ? t("settings.guest_rooms_options_error_lang_th")
                        : undefined
                    }
                  />
                </div>
                <div className="min-w-0">
                  <LangInput
                    locale="en"
                    code="EN"
                    value={labelEn}
                    onChange={(v) => {
                      setLabelEn(v);
                      setFormError(null);
                    }}
                    placeholder={t("settings.guest_rooms_options_label_en_ph")}
                    invalid={enInvalid}
                    hint={
                      enInvalid
                        ? t("settings.guest_rooms_options_error_lang_en")
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : (
              <input
                value={code}
                onChange={(e) => {
                  setCode(filterCodeInput(tab, e.target.value));
                  setFormError(null);
                }}
                placeholder={t("settings.guest_rooms_options_code")}
                aria-label={t("settings.guest_rooms_options_code")}
                className={clsx(
                  "h-10 w-full rounded-lg border bg-white px-3 font-mono text-sm shadow-sm placeholder:text-[color:var(--color-ink-muted)] focus:outline-none focus:ring-2",
                  codeInvalid || duplicateCode
                    ? "border-red-300 focus:ring-red-200/70"
                    : "border-[color:var(--color-line)] focus:ring-[color:var(--color-ink)]/12",
                )}
              />
            )}

            {alertMessage && (
              <p role="alert" className="text-xs font-medium text-red-600">
                {alertMessage}
              </p>
            )}

            <div className="flex w-full gap-2">
              <div
                className={clsx(
                  "shrink-0 overflow-hidden transition-[width,opacity] duration-300 ease-in-out",
                  isEdit ? "w-1/4 opacity-100" : "w-0 opacity-0",
                )}
                aria-hidden={!isEdit}
              >
                <button
                  type="button"
                  onClick={clearForm}
                  disabled={saveMut.isPending}
                  tabIndex={isEdit ? 0 : -1}
                  className="flex h-10 w-full items-center justify-center rounded-lg border border-[color:var(--color-line)] bg-white text-sm font-medium text-[color:var(--color-ink)] shadow-sm transition hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
                >
                  {t("common.cancel")}
                </button>
              </div>
              <button
                type="button"
                disabled={!canSave || saveMut.isPending}
                onClick={() => {
                  setShowErrors(true);
                  if (!canSave || (isEdit && !editDirty)) return;
                  saveMut.mutate();
                }}
                className={clsx(
                  "flex h-10 min-w-0 items-center justify-center gap-1 rounded-lg bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm transition-[width,flex-grow] duration-300 ease-in-out hover:opacity-90 disabled:opacity-50",
                  isEdit ? "w-3/4 flex-[3]" : "w-full flex-1",
                )}
              >
                {isEdit ? (
                  <Pencil className="h-4 w-4 shrink-0" aria-hidden />
                ) : (
                  <Plus className="h-4 w-4 shrink-0" aria-hidden />
                )}
                <span className="truncate">
                  {saveMut.isPending
                    ? t("common.loading")
                    : isEdit
                      ? t("settings.guest_rooms_options_edit")
                      : t("settings.guest_rooms_options_add")}
                </span>
              </button>
            </div>
          </div>
          </AnimateSlide>
          </div>
        </AnimateResize>
      </div>

      {deleteId != null && (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/45 px-4">
          <div
            role="alertdialog"
            aria-modal
            className="w-full max-w-sm rounded-2xl border border-[color:var(--color-line)] bg-white p-5 shadow-xl"
          >
            <p className="text-sm text-[color:var(--color-ink-soft)]">
              {t("settings.guest_rooms_options_delete_confirm")}
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteId(null)}
                disabled={deleteMut.isPending}
                className="flex-1 rounded-xl border border-[color:var(--color-line)] py-2.5 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => deleteMut.mutate(deleteId)}
                disabled={deleteMut.isPending}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleteMut.isPending
                  ? t("common.loading")
                  : t("settings.guest_rooms_options_delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
