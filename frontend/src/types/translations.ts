export interface Translation {
  id: number;
  project_id: number;
  entity_type: 'spec' | 'requirement';
  entity_id: string;
  field: 'name' | 'description' | 'instructions' | 'label';
  language_code: string;
  value: string;
  updated_at: string;
}

export interface ProjectLanguage {
  id: number;
  code: string;
  name: string;
  enabled: boolean;
}

export const LANGUAGE_FLAGS: Record<string, string> = {
  en: '🇬🇧',
  pl: '🇵🇱',
  de: '🇩🇪',
  fr: '🇫🇷',
  es: '🇪🇸',
  nl: '🇳🇱',
};
