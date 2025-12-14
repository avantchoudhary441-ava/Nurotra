import {
  BarChart,
  Bar,
  XAxis,
  ResponsiveContainer,
  Cell,
  Tooltip
} from "recharts";

/**
 * Distribution-style data (like LeetCode)
 * Middle bar = user's rank
 */
const data = [
  { value: 6 },
  { value: 8 },
  { value: 12 },
  { value: 20 },
  { value: 34 },
  { value: 52 }, // 👈 highlighted bar (your rank)
  { value: 38 },
  { value: 26 },
  { value: 16 },
  { value: 10 },
  { value: 8 },
  { value: 6 },
  { value: 5 },
  { value: 4 },
];

export default function BarRankChart() {
  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barCategoryGap={4}>
        <defs>
          {/* USE YOUR EXISTING ACCENT COLORS */}
          <linearGradient id="rankGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-1)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>

        {/* No axis – clean LeetCode style */}
        <XAxis hide />

        <Tooltip
          cursor={false}
          contentStyle={{
            background: "var(--card-bg)",
            borderRadius: "8px",
            border: "1px solid var(--border-subtle)",
            fontSize: "12px",
            color: "var(--text-main)",
          }}
        />

        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={
                i === 5
                  ? "url(#rankGrad)"                 // highlighted bar
                  : "rgba(255,255,255,0.12)"        // muted bars (same as before)
              }
              className="rank-bar"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
