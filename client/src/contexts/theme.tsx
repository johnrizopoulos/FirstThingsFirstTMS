import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Load theme from localStorage
    const saved = localStorage.getItem("theme") as Theme | null;
    if (saved) {
      setTheme(saved);
      applyTheme(saved);
    } else {
      applyTheme("dark");
    }
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === "light") {
      root.style.setProperty("--background", "#f5f5f5");
      root.style.setProperty("--foreground", "#000000");
      root.style.setProperty("--primary", "#000000");
      root.style.setProperty("--primary-foreground", "#f5f5f5");
      root.style.setProperty("--card", "#ffffff");
      root.style.setProperty("--secondary", "#e5e5e5");
    } else {
      root.style.setProperty("--background", "#000000");
      root.style.setProperty("--foreground", "#00ff00");
      root.style.setProperty("--primary", "#00ff00");
      root.style.setProperty("--primary-foreground", "#000000");
      root.style.setProperty("--card", "#000000");
      root.style.setProperty("--secondary", "#003300");
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    applyTheme(newTheme);
  };

  if (!mounted) return <>{children}</>;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
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
