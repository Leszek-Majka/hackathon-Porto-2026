import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { ValidationProgressSeries } from '../types/dashboard';

interface Props {
  series: ValidationProgressSeries[];
}

export default function ValidationProgressChart({ series }: Props) {
  if (series.length === 0 || series.every(s => s.data.length === 0)) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        No validation runs yet.
      </div>
    );
  }

  // Flatten to recharts format: [{timestamp, phaseName: passRate, ...}]
  const allTimestamps = [...new Set(series.flatMap(s => s.data.map(d => d.timestamp)))].sort();
  const chartData = allTimestamps.map(ts => {
    const row: Record<string, any> = { timestamp: new Date(ts).toLocaleDateString() };
    for (const s of series) {
      const point = s.data.find(d => d.timestamp === ts);
      if (point) row[s.phase_name] = Math.round(point.pass_rate * 100);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
        <Tooltip
          formatter={(v: number) => `${v}%`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {series.map(s => (
          <Line
            key={s.phase_id}
            type="monotone"
            dataKey={s.phase_name}
            stroke={s.color}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
