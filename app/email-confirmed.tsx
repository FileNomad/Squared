import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import {
  FontSize,
  Radius,
  Spacing,
} from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

export default function EmailConfirmedScreen() {
  const { colors } = useTheme();

  function handleContinue() {
    router.replace("/login");
  }

  return (
    <ScreenContainer centered>
      <Card style={styles.card}>
        <View
          style={[
            styles.successCircle,
            {
              backgroundColor:
                colors.successBg,
            },
          ]}
        >
          <Ionicons
            name="checkmark"
            size={36}
            color={
              colors.successText
            }
          />
        </View>

        <Text
          style={[
            styles.title,
            {
              color:
                colors.textPrimary,
            },
          ]}
        >
          Email confirmed
        </Text>

        <Text
          style={[
            styles.description,
            {
              color:
                colors.textPrimary,
            },
          ]}
        >
          Your GroupFinance account has been
          successfully confirmed.
        </Text>

        <Text
          style={[
            styles.secondaryText,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          You can now sign in and start using
          GroupFinance.
        </Text>

        <View
          style={
            styles.buttonSpacing
          }
        >
          <Button
            label="Continue to Sign In"
            onPress={
              handleContinue
            }
          />
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
  },

  successCircle: {
    width: 68,
    height: 68,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    textAlign: "center",
  },

  description: {
    fontSize: FontSize.md,
    lineHeight: 23,
    textAlign: "center",
    marginTop: Spacing.md,
  },

  secondaryText: {
    fontSize: FontSize.base,
    lineHeight: 22,
    textAlign: "center",
    marginTop: Spacing.sm,
  },

  buttonSpacing: {
    width: "100%",
    marginTop: Spacing.xl,
  },
});
