import { useLanguage } from '../../hooks/useLanguage';

export function LanguageSelector() {
  const { language, toggleLanguage } = useLanguage();

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2.5 bg-gray h-13 px-3.75 rounded-[25px] hover:bg-[#e0e0e0] dark:hover:bg-[#2a4f7a] transition-colors cursor-pointer"
      aria-label={`Switch to ${language === 'en' ? 'Ukrainian' : 'English'}`}
    >
      <span className="text-lg">{language === 'en' ? '\uD83C\uDDFA\uD83C\uDDF8' : '\uD83C\uDDFA\uD83C\uDDE6'}</span>
      <span className="text-lg font-semibold text-dark-blue dark:text-white">{language === 'en' ? 'US' : 'UA'}</span>
    </button>
  );
}
