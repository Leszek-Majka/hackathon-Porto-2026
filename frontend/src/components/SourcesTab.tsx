import React, { useRef, useState } from 'react';
import { useSources } from '../hooks/useSources';
import IDSSourceCard from './IDSSourceCard';

interface Props {
  projectId: number;
}

export default function SourcesTab({ projectId }: Props) {
  const { sources, loading, upload, remove } = useSources(projectId);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.name.toLowerCase().endsWith('.ids')) {
          alert(`"${file.name}" is not an .ids file.`);
          continue;
        }
        await upload(file);
      }
    } catch (err) {
      alert(`Failed to upload: ${err}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-lg font-semibold text-gray-900 dark:text-white mb-1">IDS Import</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Upload IDS files to use as requirement sources. Drag specs or individual requirements from the tree into matrix cells.
        </p>
      </div>

      {/* Import actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors min-h-[210px] flex flex-col items-center justify-center ${
            dragOver
              ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".ids"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-600"></div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Uploading...</span>
            </div>
          ) : (
            <>
              <svg className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Import IDS Files</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Drop .ids files here or click to browse</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Multiple files supported</p>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => {}}
          className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors min-h-[210px] flex flex-col items-center justify-center border-gray-300 dark:border-gray-600 hover:border-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
        >
          <svg className="w-8 h-8 mx-auto mb-3 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14z" />
          </svg>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Generate IDS with AI</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Create an IDS draft from project intent, disciplines, phases, and delivery requirements.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start from prompts, notes, or structured project data</p>
        </button>
      </div>

      {/* Source list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      ) : sources.length === 0 ? (
        <div className="text-center py-8 text-sm text-gray-400 dark:text-gray-500">
          No IDS sources yet. Upload your first file above.
        </div>
      ) : (
        <div className="space-y-3">
          {sources.map(s => (
            <IDSSourceCard
              key={s.id}
              source={s}
              projectId={projectId}
              onRemove={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
