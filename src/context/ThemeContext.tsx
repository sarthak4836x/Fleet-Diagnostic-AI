import React, { createContext, useContext, useEffect, useState } from 'react';

export type AppTheme = 'daytime' | 'nighttime';

interface ThemeContextType {
  theme: AppTheme;
  isDaytime: boolean;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<AppTheme>(() => {
    try {
      const saved = localStorage.getItem('fleetdiag_theme');
      if (saved === 'daytime' || saved === 'nighttime') {
        return saved;
      }
    } catch {
      // fallback
    }
    // Follow the device's appearance setting by default (like macOS / iOS)
    try {
      if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'daytime';
    } catch {
      // ignore
    }
    return 'nighttime';
  });

  useEffect(() => {
    try {
      localStorage.setItem('fleetdiag_theme', theme);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }

    const root = document.documentElement;
    if (theme === 'daytime') {
      root.classList.add('theme-daytime');
      root.setAttribute('data-theme', 'daytime');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('theme-daytime');
      root.setAttribute('data-theme', 'nighttime');
      root.style.colorScheme = 'dark';
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'nighttime' ? 'daytime' : 'nighttime'));
  };

  const setTheme = (newTheme: AppTheme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDaytime: theme === 'daytime',
        toggleTheme,
        setTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
