import {
  Pressable,
  StyleSheet,
  Text,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../constants/theme";

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

export function Chip({
  label,
  selected,
  onPress,
}: ChipProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      style={[
        styles.chip,
        {
          borderColor: selected
            ? colors.primary
            : colors.border,
          backgroundColor: selected
            ? colors.surfaceSubtle
            : colors.surface,
        },
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.label,
          {
            color: selected
              ? colors.textPrimary
              : colors.textSecondary,
            fontWeight: selected
              ? "700"
              : "500",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },

  label: {
    fontSize: FontSize.sm,
  },
});
