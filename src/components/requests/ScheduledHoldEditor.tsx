import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BellRing, Building2, DoorClosed, Minus, Plus, X } from "lucide-react";
import clsx from "clsx";
import type { ComponentType } from "react";

import { DeliverySchedulePicker } from "./DeliverySchedulePicker";
import { RequestLocationDisplay } from "./RequestLocationDisplay";
import { RoomCombobox } from "../hotel/RoomCombobox";
import { ProductItemIcon } from "../../lib/productIcons";
import { productDisplayName } from "../../lib/productDisplayName";
import { requestsApi } from "../../lib/api";
import {
  buildScheduleApiFields,
  readSchedulePickerState,
  schedulePickerFieldsEqual,
  scheduleSummaryLabel,
  type SchedulePickerState,
} from "../../lib/requestSchedule";
import { isValidQuickRoomLocation, type Room } from "../../lib/rooms";
import type { DeliveryMethod, Product, RequestDetail } from "../../lib/types";

const DELIVERY_METHODS: {
  value: DeliveryMethod;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "ring_bell", icon: BellRing },
  { value: "leave_at_door", icon: DoorClosed },
  { value: "front_desk", icon: Building2 },
];

type DraftItem = {
  product_id: number;
  sku: string;
  name: string;
  name_en?: string | null;
  qty: number;
  note?: string | null;
  is_service: boolean;
  icon_emoji?: string | null;
};

type HoldDraft = {
  room: string;
  deliveryMethod: DeliveryMethod;
  items: DraftItem[];
  schedule: SchedulePickerState;
};

function draftFromRequest(data: RequestDetail): HoldDraft {
  return {
    room: data.room,
    deliveryMethod: data.delivery_method,
    items: data.items.map((it) => ({
      product_id: it.product_id,
      sku: it.sku,
      name: it.name,
      name_en: it.name_en,
      qty: it.qty,
      note: it.note,
      is_service: it.is_service ?? false,
      icon_emoji: it.icon_emoji,
    })),
    schedule: readSchedulePickerState(data),
  };
}

function draftsEqual(a: HoldDraft, b: HoldDraft): boolean {
  if (a.room !== b.room || a.deliveryMethod !== b.deliveryMethod) return false;
  if (!schedulePickerFieldsEqual(a.schedule, b.schedule)) return false;
  if (a.items.length !== b.items.length) return false;
  return a.items.every((it, i) => {
    const other = b.items[i];
    return (
      other &&
      it.product_id === other.product_id &&
      it.qty === other.qty &&
      (it.note ?? "") === (other.note ?? "")
    );
  });
}

interface Props {
  data: RequestDetail;
  reqId: number;
  actorId?: number;
  hotelCodes: string[];
  locationLabels: Record<string, string>;
  guestRooms: Room[];
  products: Product[];
  onSaved: () => void;
}

export function ScheduledHoldEditor({
  data,
  reqId,
  actorId,
  hotelCodes,
  locationLabels,
  guestRooms,
  products,
  onSaved,
}: Props) {
  const { t, i18n } = useTranslation();
  const [baseline, setBaseline] = useState<HoldDraft>(() => draftFromRequest(data));
  const [draft, setDraft] = useState<HoldDraft>(() => draftFromRequest(data));
  const [editing, setEditing] = useState(false);
  const [itemSearch, setItemSearch] = useState("");

  useEffect(() => {
    const nextBaseline = draftFromRequest(data);
    setBaseline(nextBaseline);
    if (!editing) {
      setDraft(nextBaseline);
      setItemSearch("");
    }
  }, [data, editing]);

  const changed = !draftsEqual(draft, baseline);
  const roomValid = isValidQuickRoomLocation(draft.room.trim(), hotelCodes, guestRooms);
  const canSave = changed && roomValid && draft.items.length > 0;

  const addableProducts = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const taken = new Set(draft.items.map((it) => it.product_id));
    return products
      .filter((p) => p.department === data.department && !taken.has(p.id))
      .filter(
        (p) =>
          !q ||
          p.name.toLowerCase().includes(q) ||
          (p.name_en ?? "").toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [products, draft.items, itemSearch, data.department]);

  const save = useMutation({
    mutationFn: () => {
      const scheduleFields = buildScheduleApiFields(
        draft.schedule.mode,
        draft.schedule.delayMinutes,
        draft.schedule.atDate,
        draft.schedule.atTime,
      );
      return requestsApi.updateHold(reqId, {
        room: draft.room.trim(),
        delivery_method: draft.deliveryMethod,
        items: draft.items.map((it) => ({
          product_id: it.product_id,
          qty: it.qty,
          note: it.note,
        })),
        ...scheduleFields,
        actor_id: actorId,
      });
    },
    onSuccess: () => {
      setEditing(false);
      onSaved();
    },
  });

  const cancelEdit = () => {
    setDraft(baseline);
    setItemSearch("");
    setEditing(false);
  };

  const updateQty = (productId: number, delta: number) => {
    setDraft((cur) => ({
      ...cur,
      items: cur.items.map((it) =>
        it.product_id === productId
          ? { ...it, qty: Math.min(20, Math.max(1, it.qty + delta)) }
          : it,
      ),
    }));
  };

  const removeItem = (productId: number) => {
    setDraft((cur) => ({
      ...cur,
      items: cur.items.filter((it) => it.product_id !== productId),
    }));
  };

  const addProduct = (product: Product) => {
    setDraft((cur) => ({
      ...cur,
      items: [
        ...cur.items,
        {
          product_id: product.id,
          sku: product.sku,
          name: product.name,
          name_en: product.name_en,
          qty: 1,
          note: null,
          is_service: product.is_service,
          icon_emoji: product.icon_emoji,
        },
      ],
    }));
    setItemSearch("");
  };

  const DeliveryIcon = DELIVERY_METHODS.find((m) => m.value === data.delivery_method)?.icon ?? BellRing;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-[color:var(--color-ink-muted)]">{t("schedule.edit_hint")}</p>

      {!editing ? (
        <dl className="m-0 divide-y divide-[color:var(--color-line)]">
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center pb-3.5">
            <dt className="text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.table.room")}
            </dt>
            <dd className="min-w-0">
              <RequestLocationDisplay
                room={data.room}
                deliveryMethod={data.delivery_method}
                labelByCode={locationLabels}
                guestRooms={guestRooms}
                variant="inline"
              />
            </dd>
          </div>
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-start py-3.5">
            <dt className="pt-2 text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.table.items")}
            </dt>
            <dd className="min-w-0">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {data.items.map((it) => (
                  <li key={it.product_id} className="flex flex-col gap-1">
                    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                      <ProductItemIcon sku={it.sku} name={it.name} iconEmoji={it.icon_emoji} size="sm" />
                      <span className="font-medium leading-snug text-[color:var(--color-ink)]">
                        {productDisplayName(it, i18n.language)}
                      </span>
                      <span className="flex h-8 min-w-[2rem] shrink-0 items-center justify-center rounded-lg bg-[color:var(--color-ink)] px-2 text-sm font-bold tabular-nums leading-none text-white">
                        ×{it.qty}
                      </span>
                    </div>
                    {it.note?.trim() ? (
                      <p className="pl-11 text-xs leading-snug text-[color:var(--color-ink-soft)]">
                        {t("requests.item_note_prefix")} {it.note}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center py-3.5">
            <dt className="text-sm text-[color:var(--color-ink-muted)]">
              {t("schedule.detail_row")}
            </dt>
            <dd className="min-w-0 text-sm text-[color:var(--color-ink)]">
              {scheduleSummaryLabel(data, { t, locale: i18n.language }) ??
                t("schedule.immediate")}
            </dd>
          </div>
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center pt-3.5">
            <dt className="text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.delivery_method")}
            </dt>
            <dd className="min-w-0">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-paper-2)] px-2.5 py-1.5 text-sm">
                <DeliveryIcon className="h-4 w-4 shrink-0" />
                {t(`delivery.${data.delivery_method}`)}
              </span>
            </dd>
          </div>
        </dl>
      ) : (
        <>
          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center">
            <span className="text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.table.room")}
            </span>
            <RoomCombobox value={draft.room} onChange={(room) => setDraft((d) => ({ ...d, room }))} compact />
          </div>

          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-start">
            <span className="pt-2 text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.table.items")}
            </span>
            <div className="flex flex-col gap-2">
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {draft.items.map((it) => (
                  <li key={it.product_id} className="flex items-center gap-3">
                    <ProductItemIcon sku={it.sku} name={it.name} iconEmoji={it.icon_emoji} size="sm" />
                    <span className="min-w-0 flex-1 font-medium leading-snug">
                      {productDisplayName(it, i18n.language)}
                    </span>
                    {it.is_service ? (
                      <span className="text-xs text-[color:var(--color-ink-muted)]">×1</span>
                    ) : (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => updateQty(it.product_id, -1)}
                          disabled={it.qty <= 1}
                          className="grid h-7 w-7 place-items-center rounded border border-[color:var(--color-line)] bg-white disabled:opacity-40"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-6 text-center text-sm font-medium tabular-nums">{it.qty}</span>
                        <button
                          type="button"
                          onClick={() => updateQty(it.product_id, 1)}
                          disabled={it.qty >= 20}
                          className="grid h-7 w-7 place-items-center rounded border border-[color:var(--color-line)] bg-white disabled:opacity-40"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeItem(it.product_id)}
                      disabled={draft.items.length <= 1}
                      className="grid h-7 w-7 place-items-center rounded text-[color:var(--color-ink-muted)] hover:text-[color:var(--color-ink)] disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <input
                type="search"
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder={t("quick.items_placeholder")}
                className="w-full rounded-lg border border-[color:var(--color-line)] bg-[color:var(--color-paper)]/40 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--color-ink)]/10"
              />
              {itemSearch.trim() && addableProducts.length > 0 ? (
                <ul className="m-0 max-h-40 list-none overflow-y-auto rounded-lg border border-[color:var(--color-line)] bg-white p-1 shadow-sm">
                  {addableProducts.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addProduct(p)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[color:var(--color-paper-2)]"
                      >
                        <ProductItemIcon sku={p.sku} name={p.name} iconEmoji={p.icon_emoji} size="xs" />
                        <span className="truncate">{productDisplayName(p, i18n.language)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-start">
            <span className="pt-1 text-sm text-[color:var(--color-ink-muted)]">
              {t("schedule.detail_row")}
            </span>
            <DeliverySchedulePicker
              defaultExpanded
              className="mt-0"
              mode={draft.schedule.mode}
              onModeChange={(mode) =>
                setDraft((d) => ({ ...d, schedule: { ...d.schedule, mode } }))
              }
              delayMinutes={draft.schedule.delayMinutes}
              onDelayMinutesChange={(delayMinutes) =>
                setDraft((d) => ({ ...d, schedule: { ...d.schedule, delayMinutes } }))
              }
              atDate={draft.schedule.atDate}
              onAtDateChange={(atDate) =>
                setDraft((d) => ({ ...d, schedule: { ...d.schedule, atDate } }))
              }
              atTime={draft.schedule.atTime}
              onAtTimeChange={(atTime) =>
                setDraft((d) => ({ ...d, schedule: { ...d.schedule, atTime } }))
              }
            />
          </div>

          <div className="grid grid-cols-[6.75rem_minmax(0,1fr)] sm:grid-cols-[7.25rem_minmax(0,1fr)] gap-x-5 items-center">
            <span className="text-sm text-[color:var(--color-ink-muted)]">
              {t("requests.delivery_method")}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {DELIVERY_METHODS.map(({ value, icon: Icon }) => {
                const active = draft.deliveryMethod === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, deliveryMethod: value }))}
                    className={clsx(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm",
                      active
                        ? "border-[color:var(--color-ink)] bg-[color:var(--color-ink)] text-white"
                        : "border-[color:var(--color-line)] bg-[color:var(--color-paper-2)]",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {t(`delivery.${value}`)}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 border-t border-[color:var(--color-line)] pt-3">
        {editing ? (
          <>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={save.isPending}
              className="rounded-lg border border-[color:var(--color-line)] bg-white px-4 py-2 text-sm font-medium hover:bg-[color:var(--color-paper-2)] disabled:opacity-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={!canSave || save.isPending}
              onClick={() => save.mutate()}
              className={clsx(
                "inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] px-4 py-2 text-sm font-semibold text-white",
                (!canSave || save.isPending) && "cursor-not-allowed opacity-50",
              )}
            >
              {save.isPending ? t("common.loading") : t("schedule.save")}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[color:var(--color-ink)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
          >
            {t("schedule.edit")}
          </button>
        )}
      </div>
    </div>
  );
}
