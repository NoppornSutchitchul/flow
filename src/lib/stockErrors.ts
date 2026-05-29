export type InsufficientStockProduct = {
  product_id: number;
  sku: string;
  name: string;
  requested: number;
  available: number;
  on_hand: number;
  committed: number;
};

export type InsufficientStockDetail = {
  code: "insufficient_stock";
  products: InsufficientStockProduct[];
};

export function isInsufficientStockDetail(
  detail: unknown,
): detail is InsufficientStockDetail {
  return (
    !!detail &&
    typeof detail === "object" &&
    "code" in detail &&
    (detail as InsufficientStockDetail).code === "insufficient_stock" &&
    Array.isArray((detail as InsufficientStockDetail).products)
  );
}

