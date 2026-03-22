import React from 'react';
import type { MatrixStatus } from '../types/project';

interface Props {
  value: MatrixStatus;
  onChange: (value: MatrixStatus) => void;
  disabled?: boolean;
}

const OPTIONS: { value: MatrixStatus; label: string; classes: string }[] = [
  { value: 'required', label: 'REQ', classes: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 border-green-200 dark:border-green-700' },
  { value: 'optional', label: 'OPT', classes: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  { value: 'excluded', label: '—', classes: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-700' },
];

export default function StatusSelector({ value, onChange, disabled }: Props) {
  const cycle = () => {
    if (disabled) return;
    const idx = OPTIONS.findIndex(o => o.value === value);
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    onChange(next.value);
  };

  const current = OPTIONS.find(o => o.value === value) ?? OPTIONS[0];

  return (
    <button
      onClick={cycle}
      disabled={disabled}
      title={`Status: ${value}. Click to change.`}
      className={`w-14 h-7 text-xs font-mono font-semibold rounded border transition-all select-none ${current.classes} ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'hover:opacity-80 cursor-pointer'
      }`}
    >
      {current.label}
    </button>
  );
}
