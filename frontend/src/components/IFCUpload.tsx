import React, { useRef, useState } from 'react';
import { api } from '../api/client';
import type { IFCFileInfo } from '../types/validation';

interface Props {
  projectId: number;
  ifcFile: IFCFileInfo | null;
  onUploaded: () => void;
}

export default function IFCUpload({ projectId, ifcFile, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setError('Only .ifc files are supported');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await api.ifc.upload(projectId, file);
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

  return (
    <div className="space-y-3">
      {ifcFile && (
        <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-800 dark:text-green-300 truncate">{ifcFile.filename}</p>
            <p className="text-xs text-green-600 dark:text-green-500 mt-0.5">
              {ifcFile.ifc_schema} · {ifcFile.element_count.toLocaleString()} elements
            </p>
          </div>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-green-700 dark:text-green-400 hover:underline flex-shrink-0"
          >
            Replace
          </button>
          <input ref={inputRef} type="file" accept=".ifc" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {!ifcFile && (
        <div
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            dragging
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700'
          }`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".ifc" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-gray-500">Parsing IFC file...</p>
            </div>
          ) : (
            <>
              <svg className="mx-auto w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Drop your <code className="font-mono text-blue-600 dark:text-blue-400">.ifc</code> file here
              </p>
              <p className="text-xs text-gray-500 mt-1">or click to browse · max 500 MB</p>
            </>
          )}
          {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
