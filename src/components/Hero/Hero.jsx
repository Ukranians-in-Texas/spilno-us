import { SearchBar } from './SearchBar';
import { Tag } from '../UI/Tag';
import { quickTags, quickTagIcons } from '../../data/categories';
import { useLanguage } from '../../hooks/useLanguage';

export function Hero({ searchQuery, onSearchChange, selectedCategory, onCategorySelect }) {
  const { t } = useLanguage();

  return (
    <section className="bg-light-gray py-12 md:py-16 px-4">
      <div className="max-w-360 mx-auto text-center">
        <h1 className="text-2xl md:text-4xl font-bold text-dark-blue mb-4 max-w-3xl mx-auto leading-tight">
          {t('hero.headline')}
        </h1>
        <p className="text-base md:text-lg text-text/70 mb-8 max-w-2xl mx-auto">
          {t('hero.subtext')}
        </p>

        <div className="flex justify-center mb-6">
          <SearchBar value={searchQuery} onChange={onSearchChange} />
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {quickTags.map((tag) => (
            <Tag
              key={tag}
              icon={quickTagIcons[tag]}
              active={selectedCategory === tag}
              onClick={() => onCategorySelect(selectedCategory === tag ? null : tag)}
            >
              {t(`quickTags.${tag}`)}
            </Tag>
          ))}
        </div>
      </div>
    </section>
  );
}
