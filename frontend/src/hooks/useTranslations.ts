import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api/client';
import type { Translation, ProjectLanguage } from '../types/translations';

export function useTranslations(projectId: number) {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [languages, setLanguages] = useState<ProjectLanguage[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [t, l] = await Promise.all([
        api.translations.list(projectId),
        api.translations.languages(projectId),
      ]);
      setTranslations(t);
      setLanguages(l);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  const getValue = useCallback((entityType: string, entityId: string, field: string, lang: string): string => {
    const found = translations.find(
      t => t.entity_type === entityType && t.entity_id === entityId && t.field === field && t.language_code === lang
    );
    return found?.value ?? '';
  }, [translations]);

  const updateValue = useCallback((
    entityType: 'spec' | 'requirement',
    entityId: string,
    field: 'name' | 'description' | 'instructions' | 'label',
    lang: string,
    value: string,
  ) => {
    const key = `${entityType}|${entityId}|${field}|${lang}`;

    // Optimistic update
    setTranslations(prev => {
      const existing = prev.find(t => t.entity_type === entityType && t.entity_id === entityId && t.field === field && t.language_code === lang);
      if (existing) {
        return prev.map(t => t === existing ? { ...t, value } : t);
      }
      return [...prev, {
        id: -Date.now(),
        project_id: projectId,
        entity_type: entityType,
        entity_id: entityId,
        field,
        language_code: lang,
        value,
        updated_at: new Date().toISOString(),
      }];
    });

    // Debounced save
    const existing = debounceTimers.current.get(key);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(async () => {
      try {
        const saved = await api.translations.upsert(projectId, { entity_type: entityType, entity_id: entityId, field, language_code: lang, value });
        setTranslations(prev => prev.map(t =>
          t.entity_type === entityType && t.entity_id === entityId && t.field === field && t.language_code === lang
            ? saved : t
        ));
      } catch { /* silent */ }
      debounceTimers.current.delete(key);
    }, 800);
    debounceTimers.current.set(key, timer);
  }, [projectId]);

  const toggleLanguage = useCallback(async (code: string, enabled: boolean) => {
    await api.translations.updateLanguages(projectId, [{ code, enabled }]);
    setLanguages(prev => prev.map(l => l.code === code ? { ...l, enabled } : l));
  }, [projectId]);

  const enabledLanguages = languages.filter(l => l.enabled);

  return { translations, languages, enabledLanguages, loading, getValue, updateValue, toggleLanguage, refresh };
}
