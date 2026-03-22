import React from 'react';

type Status = 'required' | 'optional' | 'prohibited';

interface Props {
  status: Status;
  onChange?: (newStatus: Status) => void;
  readonly?: boolean;
}

const CYCLE: Status[] = ['required', 'optional', 'prohibited'];

const STATUS_STYLE: Record<Status, string> = {
  required: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  optional: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  prohibited: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

const STATUS_LABEL: Record<Status, string> = {
  required: 'Required',
  optional: 'Optional',
  prohibited: 'Prohibited',
};

export default function StatusPill({ status, onChange, readonly }: Props) {
  function handleClick() {
    if (readonly || !onChange) return;
    const idx = CYCLE.indexOf(status);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    onChange(next);
  }

  return (
    <button
      onClick={handleClick}
      disabled={readonly || !onChange}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border transition-colors ${STATUS_STYLE[status]} ${
        readonly || !onChange ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'
      }`}
      title={readonly ? undefined : 'Click to cycle status'}
    >
      {STATUS_LABEL[status]}
    </button>
  );
}
