import React, { useState } from 'react';
import { api } from '../api/client';
import type { Discipline } from '../types/setup';

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1', '#14B8A6', '#A855F7',
  '#22C55E', '#EAB308', '#0EA5E9', '#F43F5E',
  '#64748B', '#D97706', '#7C3AED', '#0891B2',
];

interface Props {
  projectId: number;
  disciplines: Discipline[];
  onChanged: () => void;
}

export default function DisciplineManager({ projectId, disciplines, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [newAbbr, setNewAbbr] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editAbbr, setEditAbbr] = useState('');
  const [editColor, setEditColor] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      // No color sent — backend auto-assigns the next unused palette color
      await api.disciplines.add(projectId, {
        name: newName.trim(),
        abbreviation: newAbbr.trim(),
        order_index: disciplines.length,
      });
      setNewName('');
      setNewAbbr('');
      onChanged();
    } catch (err) {
      alert(`Failed to add discipline: ${err}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(did: number, name: string) {
    if (!confirm(`Delete discipline "${name}"? This will remove all its matrix data.`)) return;
    try {
      await api.disciplines.delete(projectId, did);
      onChanged();
    } catch (err) {
      alert(`Failed to delete discipline: ${err}`);
    }
  }

  function startEdit(d: Discipline) {
    setEditingId(d.id);
    setEditName(d.name);
    setEditAbbr(d.abbreviation);
    setEditColor(d.color);
  }

  async function saveEdit(did: number) {
    try {
      await api.disciplines.update(projectId, did, {
        name: editName,
        abbreviation: editAbbr,
        color: editColor,
      });
      setEditingId(null);
      onChanged();
    } catch (err) {
      alert(`Failed to update discipline: ${err}`);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Disciplines</h3>
      {disciplines.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No disciplines yet. Add your first discipline below.</p>
      ) : (
        <div className="space-y-2">
          {disciplines.map(d => (
            <div
              key={d.id}
              className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              {editingId === d.id ? (
                <>
                  {/* Color dot preview */}
                  <div className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: editColor }} />
                  {/* Name */}
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    autoFocus
                  />
                  {/* Abbreviation */}
                  <input
                    type="text"
                    value={editAbbr}
                    onChange={e => setEditAbbr(e.target.value)}
                    placeholder="Abbr"
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {/* Compact palette swatches */}
                  <div className="flex flex-wrap gap-1 max-w-[120px]">
                    {PALETTE.map(c => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className="w-4 h-4 rounded-full border-2 transition-all flex-shrink-0"
                        style={{ backgroundColor: c, borderColor: editColor === c ? '#4338CA' : 'transparent' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => saveEdit(d.id)}
                    className="px-2 py-1 bg-indigo-600 text-white text-xs rounded hover:bg-indigo-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2 py-1 text-gray-500 text-xs rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{d.name}</span>
                  {d.abbreviation && (
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 text-gray-500 px-1.5 py-0.5 rounded">
                      {d.abbreviation}
                    </span>
                  )}
                  <button
                    onClick={() => startEdit(d)}
                    className="p-1 text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                    title="Edit discipline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(d.id, d.name)}
                    className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                    title="Delete discipline"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add form — no color picker */}
      <form onSubmit={handleAdd} className="flex gap-2 mt-2">
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Discipline name..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="text"
          value={newAbbr}
          onChange={e => setNewAbbr(e.target.value)}
          placeholder="Abbr"
          className="w-20 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {adding ? '...' : 'Add'}
        </button>
      </form>
    </div>
  );
}
