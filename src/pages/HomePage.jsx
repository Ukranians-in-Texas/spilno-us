import { useState, useMemo } from 'react';
import { Header } from '../components/Header/Header';
import { Hero } from '../components/Hero/Hero';
import { ServiceList } from '../components/ServiceList/ServiceList';
import { Footer } from '../components/Footer/Footer';
import { useServices } from '../hooks/useServices';
import { useLanguage } from '../hooks/useLanguage';

/**
 * HomePage is the main page of the application.
 *
 * Renders the full page layout with Header, Hero, service listings, and Footer.
 *
 * Service display has two modes:
 * - **Default**: Shows up to 6 highlighted services (featured first, then recent)
 *   followed by a second list of all remaining services.
 * - **Filtering**: When a search query or category is active, shows a single
 *   filtered list instead. A filter badge and "clear filters" link are displayed.
 *
 * Search and category filters are mutually exclusive — activating one clears the other.
 */
export function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const { t, language } = useLanguage();
  const { services, loading, error, refetch } = useServices({ lang: language });

  // Services matching the active search query and/or selected category.
  const filteredServices = useMemo(() => {
    let result = services;

    // Filter by selected subcategory
    if (selectedCategory) {
      result = result.filter((s) =>
        s.category?.split(',').map((c) => c.trim()).includes(selectedCategory)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.title?.toLowerCase().includes(query) ||
          s.description?.toLowerCase().includes(query) ||
          s.category?.toLowerCase().includes(query) ||
          s.address?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [services, searchQuery, selectedCategory]);

  const isFiltering = searchQuery || selectedCategory;

  // Up to 6 services shown in the featured section (featured ones first, ordered by featured_order).
  const highlightedServices = useMemo(() => {
    const featured = services
      .filter((s) => s.featured)
      .sort((a, b) => (a.featured_order ?? 999) - (b.featured_order ?? 999));
    const recentNonFeatured = services.filter((s) => !s.featured);
    return [...featured, ...recentNonFeatured].slice(0, 6);
  }, [services]);

  // All services not already shown in the highlighted section.
  const restServices = useMemo(() => {
    const highlightedIds = new Set(highlightedServices.map((s) => s.id));
    return services.filter((s) => !highlightedIds.has(s.id));
  }, [services, highlightedServices]);

  // Search and category are mutually exclusive filters — activating one clears the other.
  function handleCategorySelect(subcategory) {
    setSelectedCategory(subcategory);
    setSearchQuery('');
  }

  function handleSearchChange(value) {
    setSearchQuery(value);
    // Only clear the category when there is an active query; erasing the search text
    // does not restore the category — use clearFilters() for a full reset.
    if (value) {
      setSelectedCategory(null);
    }
  }

  function clearFilters() {
    setSearchQuery('');
    setSelectedCategory(null);
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A1628]">
      <Header onSelectCategory={handleCategorySelect} />

      <Hero
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        selectedCategory={selectedCategory}
        onCategorySelect={handleCategorySelect}
      />

      {isFiltering && (
        <div className="max-w-360 mx-auto px-4 pt-6">
          <div className="flex items-center gap-2 text-sm text-text/70">
            {selectedCategory && (
              <span className="bg-dark-blue dark:bg-brand-red text-white px-3 py-1 rounded-full text-xs font-bold">
                {t(`subcategories.${selectedCategory}`)}
              </span>
            )}
            <button
              onClick={clearFilters}
              className="text-brand-blue dark:text-brand-red underline font-medium hover:opacity-80 cursor-pointer"
            >
              {t('services.clearFilters')}
            </button>
          </div>
        </div>
      )}

      {isFiltering ? (
        <ServiceList
          services={filteredServices}
          loading={loading}
          error={error}
          onRetry={refetch}
          onSubcategoryClick={handleCategorySelect}
        />
      ) : (
        <>
          <ServiceList
            services={highlightedServices}
            loading={loading}
            error={error}
            onRetry={refetch}
            title={t('services.highlighted')}
            onSubcategoryClick={handleCategorySelect}
          />
          {!loading && !error && restServices.length > 0 && (
            <ServiceList
              services={restServices}
              title={t('services.allSpecialists')}
              onSubcategoryClick={handleCategorySelect}
            />
          )}
        </>
      )}

      <Footer />
    </div>
  );
}
