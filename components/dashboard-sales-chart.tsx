"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { DashboardSalesSeriesPointDto } from "@/lib/schemas/commanda";
import { formatCurrency } from "@/lib/utils/money";

type DashboardSalesChartProps = {
  data: DashboardSalesSeriesPointDto[];
};

const axisCurrencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

function formatAxisCurrency(value: number) {
  return axisCurrencyFormatter.format(value / 100);
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DashboardSalesSeriesPointDto }>;
}) {
  const point = payload?.[0]?.payload;

  if (!active || !point) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>{point.displayDate}</strong>
      <span>Faturamento: {formatCurrency(point.totalSalesCents)}</span>
      <span>Comandas fechadas: {point.closedCommandasCount}</span>
    </div>
  );
}

export function DashboardSalesChart({ data }: DashboardSalesChartProps) {
  return (
    <div className="chart-shell">
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="rgba(131, 82, 115, 0.14)" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} />
          <YAxis
            tickFormatter={formatAxisCurrency}
            tickLine={false}
            axisLine={false}
            width={84}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip />} />
          <Line
            type="monotone"
            dataKey="totalSalesCents"
            name="Faturamento"
            stroke="#c92f88"
            strokeWidth={3}
            dot={{ r: 4, fill: "#c92f88" }}
            activeDot={{ r: 6, fill: "#8d1f61" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
