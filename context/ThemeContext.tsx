import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  Colors,
  ColorScheme,
  ThemeColors,
} from "../constants/theme";
import { useColorScheme as useSystemColorScheme } from "../hooks/use-color-scheme";

export type ThemePreference =
  | "system"
  | "light"
  | "dark";

const STORAGE_KEY =
  "groupfinance.themePreference";

type ThemeContextType = {
  preference: ThemePreference;
  colorScheme: ColorScheme;
  colors: ThemeColors;
  setPreference: (
    preference: ThemePreference
  ) => void;
};

const ThemeContext =
  createContext<ThemeContextType | undefined>(
    undefined
  );

export function ThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const systemScheme =
    useSystemColorScheme();

  const [preference, setPreferenceState] =
    useState<ThemePreference>("system");

  useEffect(() => {
    let mounted = true;

    async function loadPreference() {
      const stored =
        await AsyncStorage.getItem(
          STORAGE_KEY
        );

      if (
        mounted &&
        (stored === "light" ||
          stored === "dark" ||
          stored === "system")
      ) {
        setPreferenceState(stored);
      }
    }

    loadPreference();

    return () => {
      mounted = false;
    };
  }, []);

  function setPreference(
    next: ThemePreference
  ) {
    setPreferenceState(next);

    AsyncStorage.setItem(
      STORAGE_KEY,
      next
    );
  }

  const colorScheme: ColorScheme =
    preference === "system"
      ? systemScheme === "dark"
        ? "dark"
        : "light"
      : preference;

  const colors =
    Colors[colorScheme];

  return (
    <ThemeContext.Provider
      value={{
        preference,
        colorScheme,
        colors,
        setPreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context =
    useContext(ThemeContext);

  if (!context) {
    throw new Error(
      "useTheme must be used inside ThemeProvider"
    );
  }

  return context;
}
