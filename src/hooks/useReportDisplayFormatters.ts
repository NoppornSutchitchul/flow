import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { productsApi } from "../lib/api";
import {
  formatLocationCode,
  hotelLocationLabelMap,
  useHotelLocations,
} from "../lib/hotelLocations";
import { refDataQueryOptions } from "../lib/queryOptions";
import {
  buildProductNameLookup,
  formatRequestDisplayName,
  resolveProductDisplayLabel,
  type ProductNameLookup,
} from "../lib/requestDisplayName";

/** Map English timeline titles stored in DB to i18n keys. */
const TIMELINE_TITLE_TO_KEY: Record<string, string> = {
  Accepted: "requests.timeline_events.accepted",
  "Started work": "requests.timeline_events.started",
  Started: "requests.timeline_events.started",
  Delivered: "requests.timeline_events.delivered",
  Paused: "requests.timeline_events.paused",
  Resumed: "requests.timeline_events.resumed",
  Cancelled: "requests.timeline_events.cancelled",
  "Auto-cancelled (overdue)": "requests.timeline_events.auto_cancelled",
  "Marked as Rush": "requests.timeline_events.rushed",
  "Rush removed": "requests.timeline_events.unrushed",
  "Guest called — proceed": "requests.timeline_events.dnd_cleared",
  "DND reported": "requests.timeline_events.dnd_reported",
  "Request created": "requests.timeline_events.created",
};

export function translateTimelineEventTitle(title: string, t: TFunction): string {
  const trimmed = title.trim();
  if (!trimmed) return title;
  const key = TIMELINE_TITLE_TO_KEY[trimmed];
  if (key) return t(key);
  return t(trimmed, { defaultValue: trimmed });
}

export function translateReportFreeText(text: string, t: TFunction): string {
  const trimmed = text.trim();
  if (!trimmed) return text;
  return t(trimmed, { defaultValue: trimmed });
}

export type ReportDisplayFormatters = {
  locationLabels: Record<string, string>;
  productLookup: ProductNameLookup;
  displayRoom: (room: string) => string;
  displayRequestName: (name: string) => string;
  displayProductName: (name: string, sku?: string) => string;
  translateEventTitle: (title: string) => string;
  translateDetail: (detail: string) => string;
};

/** Shared location + catalog labels for all report tables and charts. */
export function useReportDisplayFormatters(): ReportDisplayFormatters {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { data: hotelLocations = [] } = useHotelLocations(true);
  const { data: catalogProducts = [] } = useQuery({
    queryKey: ["products"],
    queryFn: productsApi.list,
    ...refDataQueryOptions(),
  });

  const locationLabels = useMemo(
    () => hotelLocationLabelMap(hotelLocations, lang),
    [hotelLocations, lang],
  );
  const productLookup = useMemo(
    () => buildProductNameLookup(catalogProducts),
    [catalogProducts],
  );

  return useMemo(
    () => ({
      locationLabels,
      productLookup,
      displayRoom: (room: string) => formatLocationCode(room, locationLabels, lang),
      displayRequestName: (name: string) =>
        formatRequestDisplayName(name, locationLabels, productLookup, lang),
      displayProductName: (name: string, sku?: string) =>
        resolveProductDisplayLabel(name, productLookup, lang, sku),
      translateEventTitle: (title: string) => translateTimelineEventTitle(title, t),
      translateDetail: (detail: string) => translateReportFreeText(detail, t),
    }),
    [locationLabels, productLookup, lang, t],
  );
}
