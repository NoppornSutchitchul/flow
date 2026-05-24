import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, MapPin, Pencil, Search, SearchX, Trash2, X } from "lucide-react";
import clsx from "clsx";

import { EmojiIconPickerModal } from "../catalog/ProductIconCarouselPicker";
import { HoverTooltip } from "../ui/HoverTooltip";
import { ListPaginationFooter } from "../ui/ListPaginationFooter";
import { hotelLocationsApi } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import {
  hotelLocationDisplayLabel,
  hotelLocationLabelDuplicate,
  hotelLocationLabels,
  hotelLocationSearchText,
} from "../../lib/hotelLocationDisplayName";
import { productNamesValid } from "../../lib/langInput";
import { ProductNameLangFields } from "../catalog/ProductNameLangFields";
import { hotelLocationEmoji } from "../../lib/hotelLocations";
import type { HotelLocation } from "../../lib/types";
import { useClientPagination } from "../../lib/useClientPagination";

function LocationEmojiPickerButton({
  emoji,
  onClick,
  label,
}: {
  emoji: string;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group mx-auto flex w-full max-w-[10rem] flex-col items-center gap-2 rounded-2xl border-2 border-[color:var(--color-line)]/80 bg-white px-4 py-5 shadow-sm transition hover:border-[color:var(--color-ink)]/30 hover:bg-[color:var(--color-paper-2)]/50 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-ink)]/20"
    >
      <span className="text-5xl leading-none transition group-hover:scale-105" aria-hidden>
        {emoji || "📍"}
      </span>
      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[color:var(--color-ink-muted)] group-hover:text-[color:var(--color-ink)]">
        {label}
        <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
      </span>
    </button>
  );
}

function HotelLocationFormModal({
  mode,
  location,
  allLocations,
  onClose,
}: {
  mode: "add" | "edit";
  location: HotelLocation | null;
  allLocations: HotelLocation[];
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const [labelTh, setLabelTh] = useState("");
  const [labelEn, setLabelEn] = useState("");
  const [iconEmoji, setIconEmoji] = useState("📍");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "edit" && location) {
      const labels = hotelLocationLabels(location);
      setLabelTh(labels.th);
      setLabelEn(labels.en);
      setIconEmoji(hotelLocationEmoji(location));
      return;
    }
    setLabelTh("");
    setLabelEn("");
    setIconEmoji("📍");
    setShowErrors(false);
    setFormError(null);
  }, [mode, location]);

  const excludeId = mode === "edit" && location ? location.id : undefined;

  const dupInvalid = useMemo(
    () => ({
      th: hotelLocationLabelDuplicate("th", labelTh, allLocations, excludeId),
      en: hotelLocationLabelDuplicate("en", labelEn, allLocations, excludeId),
    }),
    [labelTh, labelEn, allLocations, excludeId],
  );

  const dupMsg = t("settings.hotel_locations_error_duplicate_name");

  const dupExtraHint = useMemo(() => {
    if (!showErrors) return undefined;
    const hint: Partial<Record<"th" | "en", string>> = {};
    if (dupInvalid.th) hint.th = dupMsg;
    if (dupInvalid.en) hint.en = dupMsg;
    return Object.keys(hint).length > 0 ? hint : undefined;
  }, [showErrors, dupInvalid, dupMsg]);

  const hasDup = dupInvalid.th || dupInvalid.en;

  const namesValid = productNamesValid({ th: labelTh, en: labelEn });

  const canSave = namesValid && !hasDup;

  const actorId = current?.id;

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        label: labelTh.trim(),
        label_en: labelEn.trim(),
        icon_emoji: iconEmoji.trim() || null,
        actor_id: actorId,
      };
      if (mode === "edit" && location) {
        return hotelLocationsApi.update(location.id, payload);
      }
      return hotelLocationsApi.create(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["hotel-locations"] });
      onClose();
    },
    onError: (err: Error) => {
      if (/duplicate/i.test(err.message)) {
        setFormError(t("settings.hotel_locations_error_duplicate_name"));
        return;
      }
      setFormError(err.message);
    },
  });

  const trySave = () => {
    if (!canSave) {
      setShowErrors(true);
      return;
    }
    setFormError(null);
    save.mutate();
  };

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !save.isPending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, save.isPending]);

  const title =
    mode === "add"
      ? t("settings.hotel_locations_add_title")
      : t("settings.hotel_locations_edit");

  const fieldLabel =
    "mb-1 block text-xs font-semibold text-[color:var(--color-ink-soft)]";
  const inputWrapClass =
    "relative mt-1.5 flex items-center overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white px-3.5 py-2.5 text-sm shadow-sm transition-[border-color,box-shadow] focus-within:border-[color:var(--color-ink)]/20 focus-within:ring-2 focus-within:ring-[color:var(--color-ink)]/8";

  return (
    <>
      <div
        className="fixed inset-0 z-[100] grid place-items-center bg-black/45 px-4 py-6"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget && !save.isPending) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal
          aria-labelledby="hotel-location-form-title"
          className="flex max-h-[min(36rem,92vh)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3 sm:px-5">
            <MapPin className="h-5 w-5 shrink-0 text-[color:var(--color-ink-soft)]" aria-hidden />
            <h2 id="hotel-location-form-title" className="text-base font-semibold sm:text-lg">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={save.isPending}
              className="ml-auto grid h-9 w-9 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5">
            <LocationEmojiPickerButton
              emoji={iconEmoji}
              onClick={() => setIconPickerOpen(true)}
              label={t("settings.hotel_locations_form_emoji")}
            />

            <ProductNameLangFields
              name={labelTh}
              nameEn={labelEn}
              onNameChange={setLabelTh}
              onNameEnChange={setLabelEn}
              fieldLabel={fieldLabel}
              inputClass={inputWrapClass}
              showErrors={showErrors}
              extraInvalid={dupInvalid}
              extraHint={dupExtraHint}
              thAutoFocus
            />
            {formError && (
              <div
                className="text-[11px] font-medium leading-snug text-red-600"
                role="alert"
              >
                {formError}
              </div>
            )}
          </div>

          <div className="grid w-full shrink-0 grid-cols-4 gap-2 border-t border-[color:var(--color-line)] px-4 py-3 sm:px-5">
            <button
              type="button"
              onClick={onClose}
              disabled={save.isPending}
              className="col-span-1 flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={save.isPending}
              onClick={trySave}
              className="col-span-3 flex h-10 w-full items-center justify-center rounded-xl bg-[color:var(--color-ink)] text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
            >
              {save.isPending ? t("common.loading") : t("common.save")}
            </button>
          </div>
        </div>
      </div>

      {iconPickerOpen && (
        <EmojiIconPickerModal
          value={iconEmoji || "📍"}
          onSelect={(emoji) => {
            setIconEmoji(emoji);
            setIconPickerOpen(false);
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}
    </>
  );
}

function HotelLocationDeleteConfirmModal({
  location,
  displayName,
  pending,
  onClose,
  onConfirm,
}: {
  location: HotelLocation;
  displayName: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  const emoji = hotelLocationEmoji(location);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose, pending]);

  return (
    <div
      className="fixed inset-0 z-[110] grid place-items-center bg-black/45 px-4 py-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="alertdialog"
        aria-modal
        aria-labelledby="hotel-location-delete-title"
        aria-describedby="hotel-location-delete-desc"
        className="w-full max-w-sm overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-5 pb-4 pt-6 text-center">
          <span className="text-5xl leading-none select-none" aria-hidden>
            {emoji}
          </span>
          <p
            id="hotel-location-delete-title"
            className="mt-4 line-clamp-3 text-base font-semibold leading-snug text-[color:var(--color-ink)]"
          >
            {displayName}
          </p>
          <p
            id="hotel-location-delete-desc"
            className="mt-4 text-sm leading-relaxed text-[color:var(--color-ink-muted)]"
          >
            {t("settings.hotel_locations_delete_confirm_prompt")}
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-[color:var(--color-ink-muted)]/90">
            {t("settings.hotel_locations_delete_confirm_note")}
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 border-t border-[color:var(--color-line)] px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="col-span-1 flex h-10 w-full items-center justify-center rounded-xl border border-[color:var(--color-line)] bg-white text-sm font-medium shadow-sm hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="col-span-3 flex h-10 w-full items-center justify-center rounded-xl bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? t("common.loading") : t("settings.hotel_locations_delete")}
          </button>
        </div>
      </div>
    </div>
  );
}

function LocationCard({
  location,
  displayName,
  onEdit,
  onDelete,
  deletePending,
}: {
  location: HotelLocation;
  displayName: string;
  onEdit: () => void;
  onDelete: () => void;
  deletePending: boolean;
}) {
  const { t } = useTranslation();
  const emoji = hotelLocationEmoji(location);

  return (
    <article className="flex h-full w-full min-h-[10.5rem] flex-col rounded-xl border border-[color:var(--color-line)] bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-1 flex-col items-center justify-center px-1 py-3">
        <span className="text-5xl leading-none select-none" aria-hidden>
          {emoji}
        </span>
        <p className="mt-3 line-clamp-3 text-center text-sm font-semibold leading-snug">
          {displayName}
        </p>
      </div>
      <div className="mt-2 flex justify-center gap-1 border-t border-[color:var(--color-line)]/60 pt-2.5">
        <HoverTooltip label={t("settings.hotel_locations_edit")}>
          <button
            type="button"
            onClick={onEdit}
            className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-[color:var(--color-paper-2)]"
            aria-label={t("settings.hotel_locations_edit")}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </HoverTooltip>
        <HoverTooltip label={t("settings.hotel_locations_delete")}>
          <button
            type="button"
            onClick={onDelete}
            disabled={deletePending}
            className="grid h-8 w-8 place-items-center rounded-md border border-[color:var(--color-line)] hover:bg-red-50 disabled:opacity-50"
            aria-label={t("settings.hotel_locations_delete")}
          >
            <Trash2 className="h-3.5 w-3.5 text-red-600/90" />
          </button>
        </HoverTooltip>
      </div>
    </article>
  );
}

type HotelLocationsManagerProps = {
  addOpen: boolean;
  onAddOpenChange: (open: boolean) => void;
};

export function HotelLocationsManager({ addOpen, onAddOpenChange }: HotelLocationsManagerProps) {
  const { t, i18n } = useTranslation();
  const { current } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editTarget, setEditTarget] = useState<HotelLocation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<HotelLocation | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["hotel-locations"],
    queryFn: () => hotelLocationsApi.list(),
  });

  const actorId = current?.id;

  const removeMut = useMutation({
    mutationFn: (id: number) => hotelLocationsApi.remove(id, actorId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["hotel-locations"] }),
  });

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (!q) return true;
      return hotelLocationSearchText(r, i18n.language).includes(q);
    });
    return [...filtered].sort((a, b) =>
      a.label.localeCompare(b.label, i18n.language, { sensitivity: "base" }),
    );
  }, [rows, search, i18n.language]);

  const {
    pageItems,
    setPage,
    pageSize,
    setPageSize,
    currentPage,
    totalPages,
    totalRows,
    rangeFrom,
    rangeTo,
  } = useClientPagination(sorted, [search]);

  const showEmptyResults = !isLoading && rows.length > 0 && totalRows === 0;
  const showEmptyList = !isLoading && rows.length === 0;

  return (
    <>
      {addOpen && (
        <HotelLocationFormModal
          mode="add"
          location={null}
          allLocations={rows}
          onClose={() => onAddOpenChange(false)}
        />
      )}
      {editTarget && (
        <HotelLocationFormModal
          mode="edit"
          location={editTarget}
          allLocations={rows}
          onClose={() => setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <HotelLocationDeleteConfirmModal
          location={deleteTarget}
          displayName={hotelLocationDisplayLabel(deleteTarget, i18n.language)}
          pending={removeMut.isPending}
          onClose={() => {
            if (!removeMut.isPending) setDeleteTarget(null);
          }}
          onConfirm={() => removeMut.mutate(deleteTarget.id)}
        />
      )}

      <section className="min-w-0 overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="relative w-full">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--color-ink-muted)]"
              aria-hidden
            />
            <input
              type="text"
              role="search"
              autoComplete="off"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("settings.hotel_locations_search_placeholder")}
              className="h-9 w-full rounded-lg border border-[color:var(--color-line)] bg-white py-2 pl-9 pr-9 text-sm transition focus:border-[color:var(--color-ink)]/20 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[color:var(--color-ink-muted)] hover:bg-[color:var(--color-paper-2)] hover:text-[color:var(--color-ink)]"
                aria-label={t("common.close")}
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.25} />
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div
        className={clsx(
          "flex min-h-[18rem] flex-col overflow-hidden rounded-xl border border-[color:var(--color-line)] bg-white",
          (showEmptyResults || showEmptyList) && "flex-1",
        )}
      >
        <div
          className={clsx(
            "min-h-0 flex-1 overflow-y-auto p-3 sm:p-4",
            (showEmptyList || showEmptyResults) && "flex",
          )}
        >
          {isLoading && (
            <p className="py-8 text-center text-sm text-[color:var(--color-ink-muted)]">
              {t("common.loading")}
            </p>
          )}
          {showEmptyList && (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center text-sm text-[color:var(--color-ink-muted)]">
              <MapPin
                className="mb-3 h-12 w-12 text-[color:var(--color-ink-muted)]/30"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="font-medium">{t("settings.hotel_locations_empty")}</p>
            </div>
          )}
          {showEmptyResults && (
            <div className="flex flex-1 flex-col items-center justify-center py-10 text-center text-sm text-[color:var(--color-ink-muted)]">
              <SearchX
                className="mb-3 h-12 w-12 text-[color:var(--color-ink-muted)]/30"
                strokeWidth={1.25}
                aria-hidden
              />
              <p className="font-medium">{t("settings.hotel_locations_no_results")}</p>
              <p className="mt-1 text-xs">{t("settings.hotel_locations_no_results_sub")}</p>
            </div>
          )}
          {!isLoading && !showEmptyList && !showEmptyResults && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(10.5rem,1fr))] gap-3">
              {pageItems.map((r) => (
                <LocationCard
                  key={r.id}
                  location={r}
                  displayName={hotelLocationDisplayLabel(r, i18n.language)}
                  onEdit={() => setEditTarget(r)}
                  onDelete={() => setDeleteTarget(r)}
                  deletePending={removeMut.isPending && deleteTarget?.id === r.id}
                />
              ))}
            </div>
          )}
        </div>

        <ListPaginationFooter
          hidden={isLoading || showEmptyList || showEmptyResults}
          totalRows={totalRows}
          rangeFrom={rangeFrom}
          rangeTo={rangeTo}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </>
  );
}
