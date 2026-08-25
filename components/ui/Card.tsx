import { ReactNode } from "react";
import {
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";
import { Radius, Spacing } from "../../constants/theme";

type CardProps = {
  children: ReactNode;
  variant?: "default" | "success" | "danger" | "warning";
  style?: ViewStyle;
};

export function Card({
  children,
  variant = "default",
  style,
}: CardProps) {
  const { colors } = useTheme();

  const palette = {
    default: {
      background: colors.surface,
      border: colors.border,
    },
    success: {
      background: colors.successBg,
      border: colors.successBorder,
    },
    danger: {
      background: colors.dangerBg,
      border: colors.dangerBorder,
    },
    warning: {
      background: colors.warningBg,
      border: colors.warningBorder,
    },
  }[variant];

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor:
            palette.background,
          borderColor:
            palette.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
  },
});
