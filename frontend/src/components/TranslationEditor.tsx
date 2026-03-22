import React, { useState } from 'react';
import { useTranslations } from '../hooks/useTranslations';
import LanguageSelector from './LanguageSelector';
import type { IDSSpecification } from '../types/ids';
import { LANGUAGE_FLAGS } from '../types/translations';

interface Props {
  projectId: number;
  specs: IDSSpecification[];
}

type SelectedItem =
  | { type: 'spec'; id: string; name: string }
  | { type: 'req'; specId: string; id: string; name: string };

const SPEC_FIELDS: { key: 'name' | 'description' | 'instructions'; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'instructions', label: 'Instructions' },
];

const REQ_FIELDS: { key: 'label'; label: string }[] = [
  { key: 'label', label: 'Label (for reports)' },
];

export default function TranslationEditor({ projectId, specs }: Props) {
  const { languages, enabledLanguages, loading, getValue, updateValue, toggleLanguage } = useTranslations(projectId);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleSpec(specId: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(specId)) next.delete(specId);
      else next.add(specId);
      return next;
    });
  }

  if (loading) {
    return <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /></div>;
  }

  const fields = selected?.type === 'spec' ? SPEC_FIELDS : REQ_FIELDS;
  const entityType = selected?.type === 'spec' ? 'spec' : 'requirement';
  const entityId = selected?.type === 'spec' ? selected.id : selected?.id ?? '';

  return (
    <div className="space-y-5">
      {/* Language settings */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Active Languages</h3>
        <LanguageSelector languages={languages} onToggle={toggleLanguage} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Left: spec/requirement tree */}
        <div className="lg:col-span-2 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Specifications</span>
          </div>
          <div className="overflow-y-auto max-h-96">
            {specs.map(spec => (
              <div key={spec.id}>
                <div className="flex items-center">
                  <button
                    onClick={() => { toggleSpec(spec.id); setSelected({ type: 'spec', id: spec.id, name: spec.name }); }}
                    className={`flex-1 flex items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                      selected?.type === 'spec' && selected.id === spec.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <svg
                      className={`w-3.5 h-3.5 flex-shrink-0 text-gray-400 transition-transform ${expanded.has(spec.id) ? 'rotate-90' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="truncate font-medium">{spec.name}</span>
                  </button>
                </div>

                {expanded.has(spec.id) && spec.requirements.map(req => (
                  <button
                    key={req.key}
                    onClick={() => setSelected({ type: 'req', specId: spec.id, id: req.key, name: req.key })}
                    className={`w-full flex items-center gap-2 pl-9 pr-4 py-2 text-left text-xs hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-t border-gray-100 dark:border-gray-800 ${
                      selected?.type === 'req' && selected.id === req.key
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    <span className="font-mono truncate">{req.key}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right: translation editor */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-10">
              Select a specification or requirement to translate
            </div>
          ) : (
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  {selected.type === 'spec' ? 'Specification' : 'Requirement'}: {selected.name}
                </span>
              </div>
              <div className="p-4 space-y-4">
                {fields.map(field => (
                  <div key={field.key}>
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">{field.label}</h4>
                    <div className="space-y-2">
                      {enabledLanguages.map(lang => {
                        const isBase = lang.code === 'en';
                        const val = getValue(entityType, entityId, field.key, lang.code);
                        const hasTranslation = val.length > 0;

                        return (
                          <div key={lang.code} className="flex items-start gap-2">
                            <div className="flex items-center gap-1.5 w-24 flex-shrink-0 mt-2">
                              <span title={lang.name}>{LANGUAGE_FLAGS[lang.code] ?? '🌐'}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">{lang.code.toUpperCase()}</span>
                              <div
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasTranslation ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                title={hasTranslation ? 'Translated' : 'Missing translation'}
                              />
                            </div>
                            {isBase ? (
                              <div className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                {val || <span className="italic text-gray-400">No value in IDS</span>}
                              </div>
                            ) : (
                              <div className="flex-1 flex gap-2">
                                <input
                                  type="text"
                                  value={val}
                                  onChange={e => updateValue(entityType as any, entityId, field.key as any, lang.code, e.target.value)}
                                  placeholder={`${lang.name} translation...`}
                                  className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {!hasTranslation && (
                                  <button
                                    onClick={() => {
                                      const enVal = getValue(entityType, entityId, field.key, 'en');
                                      if (enVal) updateValue(entityType as any, entityId, field.key as any, lang.code, enVal);
                                    }}
                                    className="px-2 py-1 text-xs text-gray-400 hover:text-blue-600 border border-gray-200 dark:border-gray-700 rounded"
                                    title="Copy from English"
                                  >
                                    Copy EN
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
