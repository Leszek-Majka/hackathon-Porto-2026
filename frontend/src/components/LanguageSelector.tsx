import React from 'react';
import type { ProjectLanguage } from '../types/translations';
import { LANGUAGE_FLAGS } from '../types/translations';

interface Props {
  languages: ProjectLanguage[];
  onToggle: (code: string, enabled: boolean) => void;
}

export default function LanguageSelector({ languages, onToggle }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {languages.map(lang => (
        <button
          key={lang.code}
          onClick={() => lang.code !== 'en' && onToggle(lang.code, !lang.enabled)}
          disabled={lang.code === 'en'}
          title={lang.code === 'en' ? 'English is always enabled' : `${lang.enabled ? 'Disable' : 'Enable'} ${lang.name}`}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            lang.enabled
              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300'
              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500'
          } ${lang.code === 'en' ? 'cursor-default' : 'cursor-pointer hover:opacity-80'}`}
        >
          <span>{LANGUAGE_FLAGS[lang.code] ?? '🌐'}</span>
          <span>{lang.name}</span>
          {lang.code === 'en' && <span className="text-xs opacity-60">always on</span>}
        </button>
      ))}
    </div>
  );
}
