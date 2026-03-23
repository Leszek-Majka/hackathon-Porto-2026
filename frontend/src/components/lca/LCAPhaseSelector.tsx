import React from 'react';
import type { Phase } from '../../types/project';

interface Props {
  phases: Phase[];
  selectedPhaseId: number | null;
  onSelect: (phaseId: number) => void;
}

export default function LCAPhaseSelector({ phases, selectedPhaseId, onSelect }: Props) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        RIBA plan of work stages
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {phases.map(p => {
          const active = selectedPhaseId === p.id;
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                active
                  ? 'text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
              style={active ? { backgroundColor: p.color } : undefined}
            >
              <span className="font-mono">{p.code || `P${p.order_index}`}</span>
              <span>{p.name}</span>
              {p.gate && (
                <span className="text-[10px] opacity-70 bg-black/20 px-1 rounded">
                  {p.gate}
                </span>
              )}
              {p.loin !== null && p.loin !== undefined && (
                <span className="text-[10px] opacity-50 bg-black/10 px-1 rounded">
                  L{p.loin}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
