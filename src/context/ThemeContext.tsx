import React, { createContext, useContext, useEffect, useState } from 'react';

type ThemeMode = 'dark' | 'light';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ThemeMode {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem('exam_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      // ignore storage errors
    }
    return getSystemTheme();
  });

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';

      body.classList.add('dark');
      body.classList.remove('light');
      body.setAttribute('data-theme', 'dark');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';

      body.classList.add('light');
      body.classList.remove('dark');
      body.setAttribute('data-theme', 'light');
    }
  }, [theme]);

  // Follow OS system color changes dynamically unless the user explicitly toggled a preference
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      const hasManualOverride = localStorage.getItem('exam_theme_manual') === 'true';
      if (!hasManualOverride) {
        const nextTheme: ThemeMode = e.matches ? 'dark' : 'light';
        setThemeState(nextTheme);
        try {
          localStorage.setItem('exam_theme', nextTheme);
        } catch {
          // ignore
        }
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('exam_theme', newTheme);
      localStorage.setItem('exam_theme_manual', 'true');
    } catch {
      // ignore
    }
  };

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      try {
        localStorage.setItem('exam_theme', next);
        localStorage.setItem('exam_theme_manual', 'true');
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        toggleTheme,
        isDark: theme === 'dark',
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

