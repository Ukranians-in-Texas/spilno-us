import { useState, useRef, useEffect } from 'react';
import { categories } from '../../data/categories';
import { useLanguage } from '../../hooks/useLanguage';
import { ChevronDownIcon, ChevronRightIcon } from '../UI/Icon';

export function CategoryMenu({ onSelectCategory }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { t } = useLanguage();

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleSelect(subcategory) {
    onSelectCategory(subcategory);
    setIsOpen(false);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="hidden md:flex items-center gap-1.5 px-6.25 py-3.75 text-dark-blue font-semibold text-lg hover:bg-light-gray dark:hover:bg-white/10 rounded-[25px] transition-colors cursor-pointer"
      >
        {t('header.allServices')}
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray dark:border-stroke rounded-xl shadow-card border border-stroke p-6 z-50 w-200 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-4 gap-6">
            {categories.map((cat) => (
              <div key={cat.name}>
                <h3 className="text-sm font-bold text-dark-blue mb-2 flex items-center gap-1">
                  <span>{cat.icon}</span>
                  {t(`categories.${cat.name}`)}
                </h3>
                <ul className="space-y-1">
                  {cat.subcategories.map((sub) => (
                    <li key={sub}>
                      <button
                        onClick={() => handleSelect(sub)}
                        className="text-sm text-text hover:text-brand-blue dark:hover:text-dark-blue transition-colors text-left w-full cursor-pointer"
                      >
                        {t(`subcategories.${sub}`)}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileCategoryMenu({ onSelectCategory, onClose }) {
  const [expandedCategory, setExpandedCategory] = useState(null);
  const { t } = useLanguage();

  function handleToggle(name) {
    setExpandedCategory(expandedCategory === name ? null : name);
  }

  function handleSelect(subcategory) {
    onSelectCategory(subcategory);
    onClose();
  }

  return (
    <div className="space-y-1">
      <h3 className="text-lg font-bold text-dark-blue mb-3">{t('header.allServices')}</h3>
      {categories.map((cat) => (
        <div key={cat.name} className="border-b border-stroke last:border-0">
          <button
            onClick={() => handleToggle(cat.name)}
            className="flex items-center justify-between w-full py-3 text-left cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-bold text-dark-blue">
              <span>{cat.icon}</span>
              {t(`categories.${cat.name}`)}
            </span>
            <ChevronRightIcon
              className={`w-4 h-4 text-dark-blue transition-transform ${
                expandedCategory === cat.name ? 'rotate-90' : ''
              }`}
            />
          </button>
          {expandedCategory === cat.name && (
            <div className="pb-3 pl-8 space-y-2">
              {cat.subcategories.map((sub) => (
                <button
                  key={sub}
                  onClick={() => handleSelect(sub)}
                  className="block text-sm text-text hover:text-brand-blue transition-colors cursor-pointer"
                >
                  {t(`subcategories.${sub}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
