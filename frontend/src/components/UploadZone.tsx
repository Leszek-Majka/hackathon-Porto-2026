import React, { useRef, useState } from 'react';
import { api } from '../api/client';

interface Props {
  projectId: number;
  onUploaded: () => void;
}

export default function UploadZone({ projectId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.endsWith('.ids')) {
      setError('Only .ids files are supported');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await api.ids.upload(projectId, file);
      onUploaded();
    } catch (err) {
      setError(`Upload failed: ${err}`);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
        dragging
          ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
          : 'border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-gray-50 dark:hover:bg-gray-800/50'
      }`}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".ids"
        className="hidden"
        onChange={onInputChange}
      />

      {uploading ? (
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">Parsing IDS file...</p>
        </div>
      ) : (
        <>
          <svg className="mx-auto w-12 h-12 text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-base font-medium text-gray-700 dark:text-gray-300">
            Drop your <code className="font-mono text-blue-600 dark:text-blue-400">.ids</code> file here
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">or click to browse</p>
        </>
      )}

      {error && (
        <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
