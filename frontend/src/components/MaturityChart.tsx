import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { MaturityChartEntry } from '../types/dashboard';

interface Props {
  data: MaturityChartEntry[];
}

export default function MaturityChart({ data }: Props) {
  if (data.length === 0) {
    return <div className="flex items-center justify-center h-48 text-sm text-gray-400">No phases defined.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="required" name="Required" stackId="a" fill="#2E7D32" radius={[0, 0, 0, 0]} />
        <Bar dataKey="optional" name="Optional" stackId="a" fill="#E65100" />
        <Bar dataKey="excluded" name="Excluded" stackId="a" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
