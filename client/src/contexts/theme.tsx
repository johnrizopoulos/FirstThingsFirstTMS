import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "terminal" | "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const themes: Record<Theme, Record<string, string>> = {
  terminal: {
    "--background": "120 10% 5%",
    "--foreground": "120 100% 50%",
    "--card": "120 10% 10%",
    "--card-foreground": "120 100% 50%",
    "--popover": "120 10% 8%",
    "--popover-foreground": "120 100% 50%",
    "--primary": "120 100% 50%",
    "--primary-foreground": "0 0% 0%",
    "--secondary": "120 50% 15%",
    "--secondary-foreground": "120 100% 60%",
    "--muted": "120 30% 15%",
    "--muted-foreground": "120 40% 40%",
    "--accent": "120 100% 50%",
    "--accent-foreground": "0 0% 0%",
    "--border": "120 50% 25%",
    "--input": "120 50% 20%",
    "--ring": "120 100% 50%",
  },
  dark: {
    "--background": "0 0% 10%",
    "--foreground": "0 0% 90%",
    "--card": "0 0% 15%",
    "--card-foreground": "0 0% 90%",
    "--popover": "0 0% 12%",
    "--popover-foreground": "0 0% 90%",
    "--primary": "0 0% 90%",
    "--primary-foreground": "0 0% 10%",
    "--secondary": "0 0% 25%",
    "--secondary-foreground": "0 0% 85%",
    "--muted": "0 0% 30%",
    "--muted-foreground": "0 0% 60%",
    "--accent": "0 0% 90%",
    "--accent-foreground": "0 0% 10%",
    "--border": "0 0% 30%",
    "--input": "0 0% 20%",
    "--ring": "0 0% 90%",
  },
  light: {
    "--background": "0 0% 100%",
    "--foreground": "0 0% 0%",
    "--card": "0 0% 100%",
    "--card-foreground": "0 0% 0%",
    "--popover": "0 0% 100%",
    "--popover-foreground": "0 0% 0%",
    "--primary": "0 0% 0%",
    "--primary-foreground": "0 0% 100%",
    "--secondary": "0 0% 90%",
    "--secondary-foreground": "0 0% 20%",
    "--muted": "0 0% 80%",
    "--muted-foreground": "0 0% 40%",
    "--accent": "0 0% 0%",
    "--accent-foreground": "0 0% 100%",
    "--border": "0 0% 80%",
    "--input": "0 0% 90%",
    "--ring": "0 0% 0%",
  },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("terminal");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const saved = localStorage.getItem("theme") as Theme | null;
    const themeToApply = (saved && themes[saved]) ? saved : "terminal";
    setTheme(themeToApply);
    applyTheme(themeToApply);
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    const themeVars = themes[newTheme];
    Object.entries(themeVars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  };

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const themeOrder: Theme[] = ["terminal", "dark", "light"];
    const currentIndex = themeOrder.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    const newTheme = themeOrder[nextIndex];
    changeTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
