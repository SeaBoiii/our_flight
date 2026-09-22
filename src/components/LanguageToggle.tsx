import type { Locale } from '../types';

type LanguageToggleProps = {
  locale: Locale;
  label: string;
  onToggle: () => void;
};

export function LanguageToggle({ locale, label, onToggle }: LanguageToggleProps) {
  const targetLanguage = locale === 'en' ? 'ms' : 'en';
  const abbreviation = targetLanguage === 'ms' ? 'BM' : 'EN';

  return (
    <button
      className="language-toggle"
      type="button"
      lang={targetLanguage}
      aria-label={`${label} (${abbreviation})`}
      title={label}
      onClick={onToggle}
    >
      {abbreviation}
    </button>
  );
}
