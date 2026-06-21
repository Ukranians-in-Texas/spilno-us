// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { LanguageProvider, LanguageContext } from './LanguageContext';
import { useContext } from 'react';

function TestConsumer() {
  const { language, toggleLanguage, t } = useContext(LanguageContext);
  return (
    <div>
      <span data-testid="lang">{language}</span>
      <span data-testid="translated">{t('hero.searchPlaceholder')}</span>
      <button onClick={toggleLanguage}>toggle</button>
    </div>
  );
}

describe('LanguageContext', () => {
  beforeEach(() => { localStorage.clear(); });
  it('defaults to English', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('translates keys via t()', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('translated')).toHaveTextContent('Search for services...');
  });

  it('toggles to Ukrainian and back', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('ua');
    expect(screen.getByTestId('translated')).toHaveTextContent('Шукати послуги...');

    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('lang')).toHaveTextContent('en');
  });

  it('persists language to localStorage', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    act(() => screen.getByText('toggle').click());
    expect(localStorage.getItem('lang')).toBe('ua');
  });

  it('reads initial language from localStorage', () => {
    localStorage.setItem('lang', 'ua');
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    expect(screen.getByTestId('lang')).toHaveTextContent('ua');
  });

  it('returns the key itself for missing translations', () => {
    render(<LanguageProvider><TestConsumer /></LanguageProvider>);
    const { t } = screen.getByTestId('lang').closest('div').__test_ctx || {};
    // Test via a component that uses a missing key
    function MissingKey() {
      const { t } = useContext(LanguageContext);
      return <span data-testid="missing">{t('nonexistent.key')}</span>;
    }
    const { unmount } = render(<LanguageProvider><MissingKey /></LanguageProvider>);
    expect(screen.getByTestId('missing')).toHaveTextContent('nonexistent.key');
    unmount();
  });
});
