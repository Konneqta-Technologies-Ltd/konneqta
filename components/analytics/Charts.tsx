"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ChannelConversion,
  ChannelPoint,
  DayPoint,
  GeoPoint,
  SourcePoint,
  Totals,
  VisitorStats,
} from "@/lib/analytics/queries";

const CHART_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
];

function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

export function StatCard({
  label,
  value,
  hint,
  accent = "text-zinc-900 dark:text-zinc-50",
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className={`mt-2 text-3xl font-bold ${accent}`}>{value}</p>
      {hint && (
        <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{hint}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Views over time (area)
// ---------------------------------------------------------------------------

export function ViewsChart({ data }: { data: DayPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart label="Profile views" />;
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Profile views
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="viewsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l) => `Date: ${formatDateLabel(String(l))}`}
          />
          <Area
            type="monotone"
            dataKey="count"
            name="Views"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#viewsGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shares by channel over time (stacked bar)
// ---------------------------------------------------------------------------

export function SharesByChannelChart({ data }: { data: ChannelPoint[] }) {
  if (data.length === 0) {
    return <EmptyChart label="Shares by channel" />;
  }
  // Collect the set of channels across all points.
  const channels = Array.from(
    new Set(data.flatMap((p) => Object.keys(p).filter((k) => k !== "date")))
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Shares by channel
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelFormatter={(l) => `Date: ${formatDateLabel(String(l))}`}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {channels.map((ch, i) => (
            <Bar
              key={ch}
              dataKey={ch}
              stackId="shares"
              fill={CHART_COLORS[i % CHART_COLORS.length]}
              radius={i === channels.length - 1 ? [4, 4, 0, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Top traffic sources (horizontal bar)
// ---------------------------------------------------------------------------

export function SourcesChart({ data }: { data: SourcePoint[] }) {
  if (data.length === 0) {
    return <EmptyChart label="Top traffic sources" />;
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Top traffic sources
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <YAxis
            type="category"
            dataKey="source"
            width={90}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Views" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Conversion by share channel
// ---------------------------------------------------------------------------

export function ConversionChart({ data }: { data: ChannelConversion[] }) {
  if (data.length === 0) {
    return <EmptyChart label="Conversion by share channel" />;
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Conversion by share channel
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data}>
          <XAxis
            dataKey="channel"
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="shares" name="Shares" fill="#f97316" radius={[4, 4, 0, 0]} />
          <Bar dataKey="views" name="Resulting views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Unique vs returning visitors (donut)
// ---------------------------------------------------------------------------

export function VisitorsChart({ data }: { data: VisitorStats }) {
  const total = data.unique + data.returning || 1;
  const pieData = [
    { name: "New", value: Math.max(0, data.unique - data.returning) },
    { name: "Returning", value: data.returning },
  ];
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Visitors
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
          >
            <Cell fill="#3b82f6" />
            <Cell fill="#f97316" />
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 flex justify-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          <strong className="text-zinc-700 dark:text-zinc-200">{data.unique}</strong> unique
        </span>
        <span>
          <strong className="text-zinc-700 dark:text-zinc-200">{total}</strong> total views
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Geographic distribution (horizontal bar)
// ---------------------------------------------------------------------------

export function GeoChart({
  data,
  label = "Geographic distribution",
}: {
  data: GeoPoint[];
  label?: string;
}) {
  if (data.length === 0) {
    return <EmptyChart label={label} />;
  }
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        {label}
      </h3>
      <ResponsiveContainer width="100%" height={Math.max(160, data.length * 32)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10 }}>
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
            tick={{ fontSize: 11, fill: "#a1a1aa" }}
            stroke="#e4e4e7"
          />
          <Tooltip contentStyle={tooltipStyle} />
          <Bar dataKey="count" name="Views" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const tooltipStyle: React.CSSProperties = {
  backgroundColor: "#18181b",
  border: "1px solid #3f3f46",
  borderRadius: 8,
  fontSize: 12,
  color: "#fafafa",
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-300 bg-white p-5 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-600">
        No data yet for this period.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Totals row (all stat cards at once)
// ---------------------------------------------------------------------------

export function TotalsRow({ totals }: { totals: Totals }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatCard label="Views" value={totals.views} accent="text-(--main-orange)" />
      <StatCard label="Shares" value={totals.shares} accent="text-blue-500" />
      <StatCard label="QR scans" value={totals.qrScans} accent="text-emerald-500" />
      <StatCard label="vCard downloads" value={totals.vcardDownloads} accent="text-violet-500" />
    </div>
  );
}