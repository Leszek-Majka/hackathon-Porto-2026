import React, { useState } from 'react';
import { api } from '../api/client';
import type { Phase } from '../types/project';

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16',
  '#F97316', '#6366F1', '#14B8A6', '#A855F7',
  '#22C55E', '#EAB308', '#0EA5E9', '#F43F5E',
  '#64748B', '#D97706', '#7C3AED', '#0891B2',
];

interface Props {
  projectId: number;
  phases: Phase[];
  onChanged: () => void;
}

export default function PhaseManager({ projectId, phases, onChanged }: Props) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      // No color — backend auto-assigns the next unused palette color
      await api.phases.add(projectId, newName.trim(), undefined, phases.length);
      setNewName('');
      onChanged();
    } catch (err) {
      alert(`Failed to add phase: ${err}`);
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(phaseId: number, name: string) {
    if (!confirm(`Delete phase "${name}"? This will also remove its matrix data.`)) return;
    try {
      await api.phases.delete(projectId, phaseId);
      onChanged();
    } catch (err) {
      alert(`Failed to delete phase: ${err}`);
    }
  }

  function startEdit(phase: Phase) {
    setEditingId(phase.id);
    setEditName(phase.name);
    setEditColor(phase.color);
  }

  async function saveEdit(phaseId: number) {
    try {
      await api.phases.update(projectId, phaseId, { name: editName, color: editColor });
      setEditingId(null);
      onChanged();
    } catch (err) {
      alert(`Failed to update phase: ${err}`);
    }
  }

  return (
    <div className="space-y-3">
      {phases.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">No phases defined yet. Add your first phase below.</p>
      ) : (
        <div className="space-y-2">
          {phases
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map(phase => (
              <div
                key={phase.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                {editingId === phase.id ? (
                  <>
                    {/* Color dot preview */}
                    <div className="w-4 h-4 rounded-full flex-shrink-0 border border-gray-200" style={{ backgroundColor: editColor }} />
                    {/* Name */}
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    {/* Compact palette swatches */}
                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                      {PALETTE.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className="w-4 h-4 rounded-full border-2 transition-all flex-shrink-0"
                          style={{
                            backgroundColor: c,
                            borderColor: editColor === c ? '#1d4ed8' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    <button
                      onClick={() => saveEdit(phase.id)}
                      className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
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
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: phase.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                      {phase.name}
                    </span>
                    <button
                      onClick={() => startEdit(phase)}
                      className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                      title="Edit phase"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(phase.id, phase.name)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                      title="Delete phase"
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
          placeholder="New phase name..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {adding ? '...' : 'Add Phase'}
        </button>
      </form>
    </div>
  );
}
