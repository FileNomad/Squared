import { router } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Spacing,
} from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export default function ForgotPasswordScreen() {
  const { colors } = useTheme();

  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [sent, setSent] =
    useState(false);

  async function handleSendResetLink() {
    if (!email.trim()) {
      setError(
        "Enter your email address."
      );
      return;
    }

    setLoading(true);
    setError("");

    await supabase.auth
      .resetPasswordForEmail(
        email.trim(),
        {
          redirectTo:
            "groupfinance://reset-password",
        }
      );

    setLoading(false);
    setSent(true);
  }

  return (
    <ScreenContainer centered>
      <Text
        style={[
          styles.title,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Reset your password
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Enter the email you signed
        up with and we&apos;ll send
        you a link to set a new
        password.
      </Text>

      <Card>
        {sent ? (
          <>
            <Text
              style={[
                styles.messageText,
                {
                  color:
                    colors.textPrimary,
                },
              ]}
            >
              If an account exists
              for that email,
              we&apos;ve sent a
              password reset link.
              Check your inbox.
            </Text>

            <Button
              label="Back to Sign In"
              onPress={() =>
                router.replace(
                  "/login"
                )
              }
            />
          </>
        ) : (
          <>
            <TextField
              label="Email"
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={(
                value
              ) => {
                setEmail(value);
                setError("");
              }}
              error={error}
              editable={!loading}
            />

            <Button
              label="Send Reset Link"
              onPress={
                handleSendResetLink
              }
              loading={loading}
            />

            <Text
              onPress={() =>
                router.back()
              }
              style={[
                styles.backLink,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Back to Sign In
            </Text>
          </>
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    fontSize: FontSize.base,
    lineHeight: 22,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },

  messageText: {
    fontSize: FontSize.base,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },

  backLink: {
    fontSize: FontSize.base,
    fontWeight: "600",
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
