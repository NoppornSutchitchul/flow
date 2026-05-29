export interface ExecutiveDashboardData {
  period_days: number;
  filter_department: string;
  generated_at: string;
  departments: string[];
  kpis: {
    total_requests: number;
    delivered: number;
    open: number;
    overdue: number;
    rush: number;
    completion_rate: number;
    avg_delivery_minutes: number;
    delivered_today: number;
    requests_today: number;
    net_stock_delta: number;
  };
  trends: {
    total_requests_pct: number;
    delivered_pct: number;
    avg_delivery_pct: number;
  };
  forecast: {
    daily_requests: number;
    weekly_requests: number;
    trend_slope: number;
  };
  dimensions: {
    by_department: Record<string, number>;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    by_hour: { hour: number; count: number }[];
    by_weekday: { weekday: string; count: number }[];
  };
  daily_volume: { date: string; count: number }[];
  top_items: { name: string; sku?: string; qty: number }[];
  staff_top: {
    name: string;
    department?: string;
    delivered: number;
    open: number;
    avg_delivery_minutes: number;
  }[];
  insights: { level: string; code: string; value?: number }[];
  recent_timeline: {
    created_at: string;
    request_code: string;
    kind: string;
    title: string;
    actor_label: string;
  }[];
}
