// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ThemeProvider, ThemeContext } from './ThemeContext';
import { useContext } from 'react';

function TestConsumer() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
    </div>
  );
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  it('defaults to light theme', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles to dark and adds class to html element', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('toggles back to light and removes dark class', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    act(() => screen.getByText('toggle').click());
    expect(screen.getByTestId('theme')).toHaveTextContent('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme to localStorage', () => {
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    act(() => screen.getByText('toggle').click());
    expect(localStorage.getItem('theme')).toBe('dark');
  });

  it('reads initial theme from localStorage', () => {
    localStorage.setItem('theme', 'dark');
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
