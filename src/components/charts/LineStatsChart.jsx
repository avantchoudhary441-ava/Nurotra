import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";

const data = [
  { name: "Jan", value: 12 },
  { name: "Feb", value: 18 },
  { name: "Mar", value: 14 },
  { name: "Apr", value: 25 },
  { name: "May", value: 22 },
  { name: "Jun", value: 32 },
];

export default function LineStatsChart() {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data}>
        <defs>
          {/* Line gradient (same as your theme) */}
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>

          {/* Glow for hover dot (LeetCode style) */}
          <filter id="dotGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <XAxis
          dataKey="name"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--text-muted)", fontSize: 12 }}
        />

        <YAxis hide />

        <Tooltip
          cursor={{
            stroke: "rgba(99,102,241,0.25)",
            strokeWidth: 1,
          }}
          contentStyle={{
            background: "var(--card-bg)",
            borderRadius: "10px",
            border: "1px solid var(--border-subtle)",
          }}
        />

        <Line
          type="linear"                 // 🔥 sharp edges (important)
          dataKey="value"
          stroke="url(#lineGrad)"
          strokeWidth={2}               // 🔥 thin line
          dot={false}                   // 🔥 no points normally
          activeDot={{
            r: 5,
            fill: "var(--card-bg)",     // hollow center like LeetCode
            stroke: "#6366f1",
            strokeWidth: 2,
            filter: "url(#dotGlow)",    // 🔥 glow on hover
          }}
          animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
