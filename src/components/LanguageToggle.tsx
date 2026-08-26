import type { Locale } from '../types';

type LanguageToggleProps = {
  locale: Locale;
  label: string;
  onToggle: () => void;
};

export function LanguageToggle({ locale, label, onToggle }: LanguageToggleProps) {
  const targetLanguage = locale === 'en' ? 'ms' : 'en';

  return (
    <button
      className="language-toggle"
      type="button"
      lang={targetLanguage}
      aria-label={label}
      title={label}
      onClick={onToggle}
    >
      {targetLanguage === 'ms' ? 'BM' : 'EN'}
    </button>
  );
}
