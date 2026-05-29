import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, X } from "lucide-react";
import clsx from "clsx";

import { usersApi } from "../../lib/api";
import { isPublicAreaHousekeeper, parseWorkZone, workZoneForGuestRoom } from "../../lib/assignees";
import { FLOORS, type Building } from "../../lib/rooms";
import type { User } from "../../lib/types";

const BUILDINGS: Building[] = [1, 2];

function choiceButtonClass(active: boolean) {
  return clsx(
    "rounded-lg border px-2.5 py-2.5 text-sm font-medium transition-colors",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-delivered-fg)]/25",
    "disabled:opacity-60 disabled:pointer-events-none",
    active
      ? "border-[color:var(--color-delivered-fg)] bg-[color:var(--color-delivered-bg)] text-[color:var(--color-delivered-fg)]"
      : "border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]",
  );
}

type HeaderParts = {
  trigger: ReactNode;
  /** @deprecated Editor is shown in a modal; always null. */
  editor: ReactNode | null;
};

interface Props {
  user: User;
  layout?: "header";
  children?: (parts: HeaderParts) => ReactNode;
}

function WorkZoneEditorFields({
  draftBuilding,
  draftFloor,
  pending,
  onBuilding,
  onFloor,
}: {
  draftBuilding: Building;
  draftFloor: number;
  pending: boolean;
  onBuilding: (b: Building) => void;
  onFloor: (f: number) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-xs font-medium text-[color:var(--color-ink-soft)]">
          {t("quick.room_step_building")}
        </p>
        <div
          className="grid grid-cols-2 gap-2"
          role="group"
          aria-label={t("queue.work_zone_building_aria")}
        >
          {BUILDINGS.map((b) => (
            <button
              key={b}
              type="button"
              aria-pressed={draftBuilding === b}
              disabled={pending}
              onClick={() => onBuilding(b)}
              className={choiceButtonClass(draftBuilding === b)}
            >
              {t("rooms.building")} {b}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-[color:var(--color-ink-soft)]">
          {t("quick.room_step_floor")}
        </p>
        <div
          className="grid grid-cols-5 gap-2"
          role="group"
          aria-label={t("queue.work_zone_floor_aria")}
        >
          {FLOORS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={draftFloor === f}
              disabled={pending}
              onClick={() => onFloor(f)}
              className={clsx(choiceButtonClass(draftFloor === f), "font-semibold tabular-nums")}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkZonePicker({ user, layout, children }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isPublicArea = isPublicAreaHousekeeper(user);
  const parsed = useMemo(() => parseWorkZone(user.work_zone), [user.work_zone]);
  const building: Building = parsed?.building === 2 ? 2 : 1;
  const floor = parsed?.floor ?? 1;

  const [open, setOpen] = useState(false);
  const [draftBuilding, setDraftBuilding] = useState<Building>(building);
  const [draftFloor, setDraftFloor] = useState(floor);

  useEffect(() => {
    if (!open) {
      setDraftBuilding(building);
      setDraftFloor(floor);
    }
  }, [building, floor, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const save = useMutation({
    mutationFn: (zone: string) => usersApi.update(user.id, { work_zone: zone }),
    onSuccess: (updated) => {
      const applyZone = (u: User) =>
        u.id === updated.id ? { ...u, work_zone: updated.work_zone } : u;
      qc.setQueryData<User>(["auth", "me"], (prev) => (prev ? applyZone(prev) : prev));
      qc.setQueryData<User[]>(["users"], (prev) =>
        prev ? prev.map(applyZone) : prev,
      );
      setOpen(false);
    },
  });

  const zoneSummary = t("queue.work_zone_summary", {
    building: t("rooms.building"),
    floor: t("rooms.floor"),
    buildingNo: building,
    floorNo: floor,
  });

  const draftDirty = draftBuilding !== building || draftFloor !== floor;

  const startEdit = () => {
    setDraftBuilding(building);
    setDraftFloor(floor);
    setOpen(true);
  };

  const cancelEdit = () => {
    setDraftBuilding(building);
    setDraftFloor(floor);
    setOpen(false);
  };

  const handleSave = () => {
    if (!draftDirty) {
      setOpen(false);
      return;
    }
    save.mutate(workZoneForGuestRoom(draftBuilding, draftFloor));
  };

  const modal =
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex items-end justify-center p-3 sm:items-center sm:p-4"
        role="presentation"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label={t("queue.work_zone_cancel")}
          onClick={cancelEdit}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="work-zone-modal-title"
          className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-[color:var(--color-line)] bg-white shadow-2xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--color-line)] px-4 py-3.5 sm:px-5">
            <MapPin className="h-4 w-4 shrink-0 text-[color:var(--color-delivered-fg)]" aria-hidden />
            <h2 id="work-zone-modal-title" className="min-w-0 flex-1 text-base font-semibold">
              {t("queue.work_zone_modal_title")}
            </h2>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={save.isPending}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg hover:bg-[color:var(--color-paper-2)]"
              aria-label={t("queue.work_zone_cancel")}
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>

          <div
            className={clsx(
              "px-4 py-4 sm:px-5",
              save.isPending && "pointer-events-none opacity-80",
            )}
          >
            <WorkZoneEditorFields
              draftBuilding={draftBuilding}
              draftFloor={draftFloor}
              pending={save.isPending}
              onBuilding={setDraftBuilding}
              onFloor={setDraftFloor}
            />
          </div>

          <div className="flex shrink-0 gap-2 border-t border-[color:var(--color-line)] px-4 py-3.5 sm:px-5">
            <button
              type="button"
              onClick={cancelEdit}
              disabled={save.isPending}
              className="flex-1 rounded-xl border border-[color:var(--color-line)] bg-white py-2.5 text-sm font-medium hover:bg-[color:var(--color-paper-2)]"
            >
              {t("queue.work_zone_cancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={save.isPending}
              className={clsx(
                "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-colors",
                draftDirty
                  ? "bg-[color:var(--color-delivered-fg)] text-white hover:opacity-90"
                  : "border border-[color:var(--color-line)] bg-white text-[color:var(--color-ink)] hover:bg-[color:var(--color-paper-2)]",
              )}
            >
              {save.isPending ? t("common.loading") : t("queue.work_zone_save")}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  if (layout === "header" && children) {
    if (isPublicArea) {
      const trigger = (
        <span
          className={clsx(
            "inline-flex max-w-full items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-center",
            "text-lg font-semibold tracking-tight text-[color:var(--color-ink)] md:text-xl lg:text-2xl",
          )}
        >
          <MapPin
            className="h-5 w-5 shrink-0 text-[color:var(--color-delivered-fg)] md:h-6 md:w-6"
            aria-hidden
          />
          <span className="min-w-0 leading-snug">{t("queue.work_zone_public_area")}</span>
        </span>
      );
      return <>{children({ trigger, editor: null })}</>;
    }

    const triggerClass = clsx(
      "inline-flex max-w-full items-center justify-center gap-2 rounded-xl px-3 py-1.5 text-center",
      "text-lg font-semibold tracking-tight text-[color:var(--color-ink)] md:text-xl lg:text-2xl",
      "transition-colors hover:bg-[color:var(--color-paper-2)]/80",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-delivered-fg)]/30",
    );

    const trigger = (
      <button
        type="button"
        onClick={startEdit}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("queue.work_zone_change")}
        className={triggerClass}
      >
        <MapPin
          className="h-5 w-5 shrink-0 text-[color:var(--color-delivered-fg)] md:h-6 md:w-6"
          aria-hidden
        />
        <span className="min-w-0 leading-snug">{zoneSummary}</span>
      </button>
    );

    return (
      <>
        {children({ trigger, editor: null })}
        {modal}
      </>
    );
  }

  return null;
}
