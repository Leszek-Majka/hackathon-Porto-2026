import React from 'react';
import type { Discipline } from '../../types/setup';

interface Props {
  disciplines: Discipline[];
  active: string[];
  onToggle: (code: string) => void;
  onReset: () => void;
}

export default function DisciplineFilter({ disciplines, active, onToggle, onReset }: Props) {
  const allActive = active.length === disciplines.length;

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Disciplines
      </h3>
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={onReset}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            allActive
              ? 'border-gray-500 text-gray-200 bg-gray-700'
              : 'border-gray-700 text-gray-500 bg-gray-800/50 hover:bg-gray-700'
          }`}
        >
          All
        </button>
        {disciplines.map(d => {
          const code = d.code ?? d.abbreviation ?? '';
          const isActive = active.includes(code);
          return (
            <button
              key={code}
              onClick={() => onToggle(code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border ${
                isActive
                  ? 'border-transparent text-white'
                  : 'border-gray-700 text-gray-500 bg-gray-800/50'
              }`}
              style={
                isActive
                  ? { backgroundColor: d.color + '30', borderColor: d.color }
                  : undefined
              }
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: d.color }}
              />
              {d.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
