import {
  router,
  useLocalSearchParams,
} from "expo-router";
import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
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

export default function ResetPasswordScreen() {
  const { colors } = useTheme();

  const { code } =
    useLocalSearchParams<{
      code?: string;
    }>();

  const [exchanging, setExchanging] =
    useState(true);

  const [
    exchangeError,
    setExchangeError,
  ] = useState("");

  const [
    sessionReady,
    setSessionReady,
  ] = useState(false);

  const [password, setPassword] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");

  const [saving, setSaving] =
    useState(false);

  const [saveError, setSaveError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    async function exchangeCode() {
      if (!code) {
        setExchangeError(
          "This reset link is invalid or incomplete. Request a new one."
        );
        setExchanging(false);
        return;
      }

      const { error } =
        await supabase.auth.exchangeCodeForSession(
          code
        );

      if (!mounted) {
        return;
      }

      if (error) {
        setExchangeError(
          "This reset link has expired or already been used. Request a new one."
        );
        setExchanging(false);
        return;
      }

      setSessionReady(true);
      setExchanging(false);
    }

    exchangeCode();

    return () => {
      mounted = false;
    };
  }, [code]);

  async function handleSetPassword() {
    if (password.length < 6) {
      setSaveError(
        "Password must be at least 6 characters."
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setSaveError(
        "Passwords don't match."
      );
      return;
    }

    setSaving(true);
    setSaveError("");

    const { error } =
      await supabase.auth.updateUser(
        {
          password,
        }
      );

    setSaving(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    router.replace("/");
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
        Set a new password
      </Text>

      <Card>
        {exchanging ? (
          <View
            style={
              styles.loadingRow
            }
          >
            <ActivityIndicator
              color={
                colors.primary
              }
            />

            <Text
              style={[
                styles.loadingText,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Verifying your reset
              link...
            </Text>
          </View>
        ) : exchangeError ? (
          <>
            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.dangerText,
                },
              ]}
            >
              {exchangeError}
            </Text>

            <Button
              label="Request New Link"
              onPress={() =>
                router.replace(
                  "/forgot-password"
                )
              }
            />
          </>
        ) : sessionReady ? (
          <>
            <Text
              style={[
                styles.subtitle,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Choose a new password
              for your account.
            </Text>

            <TextField
              label="New password"
              placeholder="At least 6 characters"
              secureToggle
              value={password}
              onChangeText={(
                value
              ) => {
                setPassword(
                  value
                );
                setSaveError("");
              }}
              editable={!saving}
            />

            <TextField
              label="Confirm password"
              placeholder="Re-enter your new password"
              secureToggle
              value={
                confirmPassword
              }
              onChangeText={(
                value
              ) => {
                setConfirmPassword(
                  value
                );
                setSaveError("");
              }}
              error={saveError}
              editable={!saving}
            />

            <Button
              label="Update Password"
              onPress={
                handleSetPassword
              }
              loading={saving}
            />
          </>
        ) : null}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.lg,
  },

  subtitle: {
    fontSize: FontSize.base,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },

  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  loadingText: {
    fontSize: FontSize.base,
  },

  errorText: {
    fontSize: FontSize.base,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
});
