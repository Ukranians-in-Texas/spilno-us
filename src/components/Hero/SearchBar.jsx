import { SearchIcon } from '../UI/Icon';
import { useLanguage } from '../../hooks/useLanguage';

export function SearchBar({ value, onChange }) {
  const { t } = useLanguage();

  return (
    <div className="relative w-full max-w-2xl flex">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('hero.searchPlaceholder')}
        className="w-full pl-8 pr-4 py-4 rounded-l-full border border-brand-red border-r-0 bg-white dark:bg-[#0A1628] text-text text-lg placeholder:text-dark-blue/40 dark:placeholder:text-white/30 focus:outline-none transition-colors"
      />
      <button className="flex items-center justify-center w-17.5 bg-brand-red rounded-r-full border border-brand-red shrink-0 cursor-pointer">
        <SearchIcon className="w-6 h-6 text-white" />
      </button>
    </div>
  );
}
