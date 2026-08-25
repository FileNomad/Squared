import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../context/ThemeContext";
import { FontSize, Radius, Spacing } from "../../constants/theme";
import { TransactionStatus } from "../../context/EventContext";

const LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  payment_pending: "Payment Pending",
  settled: "Settled",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export function StatusBadge({
  status,
}: {
  status: TransactionStatus;
}) {
  const { colors } = useTheme();

  const palette: Record<
    TransactionStatus,
    { bg: string; border: string; text: string }
  > = {
    pending: {
      bg: colors.warningBg,
      border: colors.warningBorder,
      text: colors.warningText,
    },
    confirmed: {
      bg: colors.surfaceSubtle,
      border: colors.borderStrong,
      text: colors.textSecondary,
    },
    payment_pending: {
      bg: colors.warningBg,
      border: colors.warningBorder,
      text: colors.warningText,
    },
    settled: {
      bg: colors.successBg,
      border: colors.successBorder,
      text: colors.successText,
    },
    rejected: {
      bg: colors.dangerBg,
      border: colors.dangerBorder,
      text: colors.dangerText,
    },
    cancelled: {
      bg: colors.dangerBg,
      border: colors.dangerBorder,
      text: colors.dangerText,
    },
  };

  const {
    bg,
    border,
    text,
  } = palette[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          borderColor: border,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: text },
        ]}
      >
        {LABELS[status]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },

  text: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
