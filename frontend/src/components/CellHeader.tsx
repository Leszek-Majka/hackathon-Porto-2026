import React, { useState, useEffect } from 'react';
import type { CellHeader as CellHeaderType } from '../types/matrix';
import type { IDSSource } from '../types/sources';

interface Props {
  header: CellHeaderType;
  sources: IDSSource[];
  onSave: (header: CellHeaderType) => Promise<void>;
}

const EMPTY_HEADER: CellHeaderType = {
  title: '',
  author: '',
  date: '',
  version: '',
  description: '',
  copyright: '',
};

export default function CellHeader({ header, sources, onSave }: Props) {
  const [local, setLocal] = useState<CellHeaderType>({ ...EMPTY_HEADER, ...header });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLocal({ ...EMPTY_HEADER, ...header });
  }, [header]);

  async function handleBlur() {
    setSaving(true);
    try {
      await onSave(local);
    } finally {
      setSaving(false);
    }
  }

  function handleCopyFrom(sourceId: number) {
    const source = sources.find(s => s.id === sourceId);
    if (!source) return;
    const updated: CellHeaderType = {
      ...local,
      title: source.title || local.title,
      author: source.author || local.author,
      date: source.date || local.date,
      version: source.version || local.version,
    };
    setLocal(updated);
    onSave(updated);
  }

  const fields: { key: keyof CellHeaderType; label: string; placeholder: string }[] = [
    { key: 'title', label: 'Title', placeholder: 'IDS title...' },
    { key: 'author', label: 'Author', placeholder: 'Author name...' },
    { key: 'date', label: 'Date', placeholder: 'YYYY-MM-DD' },
    { key: 'version', label: 'Version', placeholder: '1.0' },
    { key: 'description', label: 'Description', placeholder: 'Description...' },
    { key: 'copyright', label: 'Copyright', placeholder: 'Copyright text...' },
  ];

  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">IDS Header</h4>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-amber-500">Saving...</span>}
          {sources.length > 0 && (
            <select
              className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400"
              defaultValue=""
              onChange={e => {
                if (e.target.value) handleCopyFrom(Number(e.target.value));
                e.target.value = '';
              }}
            >
              <option value="">Copy from IDS source...</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.filename}</option>
              ))}
            </select>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(f => (
          <div key={f.key} className={f.key === 'description' || f.key === 'copyright' ? 'col-span-2' : ''}>
            <label className="block text-xs text-gray-500 dark:text-gray-400 mb-0.5">{f.label}</label>
            <input
              type="text"
              value={local[f.key]}
              onChange={e => setLocal(prev => ({ ...prev, [f.key]: e.target.value }))}
              onBlur={handleBlur}
              placeholder={f.placeholder}
              className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
