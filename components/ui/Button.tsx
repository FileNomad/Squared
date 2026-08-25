import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../constants/theme";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "ghost";

type ButtonProps = {
  label: string;
  onPress: PressableProps["onPress"];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  fullWidth?: boolean;
};

export function Button({
  label,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
}: ButtonProps) {
  const { colors } = useTheme();

  const isDisabled =
    disabled || loading;

  const backgroundColor = {
    primary: colors.primary,
    secondary: "transparent",
    danger: colors.danger,
    ghost: "transparent",
  }[variant];

  const borderColor = {
    primary: colors.primary,
    secondary: colors.borderStrong,
    danger: colors.danger,
    ghost: "transparent",
  }[variant];

  const textColor = {
    primary: colors.onPrimary,
    secondary: colors.textPrimary,
    danger: "#FFFFFF",
    ghost: colors.textSecondary,
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor,
          borderColor,
          borderWidth:
            variant === "ghost"
              ? 0
              : 1,
          opacity: isDisabled
            ? 0.5
            : pressed
              ? 0.85
              : 1,
          alignSelf: fullWidth
            ? "stretch"
            : "flex-start",
          paddingHorizontal:
            variant === "ghost"
              ? 0
              : Spacing.lg,
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={textColor}
        />
      ) : (
        <View
          style={styles.content}
        >
          {icon ? (
            <Ionicons
              name={icon}
              size={18}
              color={textColor}
            />
          ) : null}

          <Text
            style={[
              styles.label,
              { color: textColor },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 50,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  content: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  label: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },
});
