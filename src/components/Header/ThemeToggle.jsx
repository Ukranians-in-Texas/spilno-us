import { useTheme } from '../../hooks/useTheme';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="flex items-center justify-center bg-gray w-13 h-13 rounded-[25px] hover:bg-[#e0e0e0] dark:hover:bg-[#2a4f7a] transition-colors cursor-pointer"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="text-xl">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
