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
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

export default function ResetPasswordScreen() {
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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Set a new password
        </Text>

        {exchanging ? (
          <View
            style={
              styles.loadingRow
            }
          >
            <ActivityIndicator />

            <Text
              style={
                styles.loadingText
              }
            >
              Verifying your reset
              link...
            </Text>
          </View>
        ) : exchangeError ? (
          <>
            <Text
              style={
                styles.errorText
              }
            >
              {exchangeError}
            </Text>

            <Pressable
              style={
                styles.primaryButton
              }
              onPress={() =>
                router.replace(
                  "/forgot-password"
                )
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Request New Link
              </Text>
            </Pressable>
          </>
        ) : sessionReady ? (
          <>
            <Text
              style={
                styles.subtitle
              }
            >
              Choose a new password
              for your account.
            </Text>

            <Text
              style={styles.label}
            >
              New password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="At least 6 characters"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
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

            <Text
              style={styles.label}
            >
              Confirm password
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Re-enter your new password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
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
              editable={!saving}
            />

            {saveError ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {saveError}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                saving &&
                  styles.buttonDisabled,
              ]}
              onPress={
                handleSetPassword
              }
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator
                  color="white"
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Update Password
                </Text>
              )}
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F9FAFB",
      alignItems: "center",
      paddingHorizontal: 24,
      paddingTop: 90,
    },

    card: {
      width: "100%",
      maxWidth: 440,
      backgroundColor: "white",
      borderRadius: 20,
      padding: 28,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    title: {
      fontSize: 28,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 8,
    },

    subtitle: {
      fontSize: 15,
      color: "#6B7280",
      lineHeight: 22,
      marginBottom: 24,
    },

    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 16,
    },

    loadingText: {
      fontSize: 15,
      color: "#6B7280",
    },

    label: {
      fontSize: 14,
      fontWeight: "600",
      color: "#374151",
      marginBottom: 8,
    },

    input: {
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: "#111827",
      backgroundColor: "white",
      marginBottom: 18,
    },

    errorText: {
      fontSize: 14,
      color: "#DC2626",
      lineHeight: 20,
      marginBottom: 14,
      marginTop: 8,
    },

    primaryButton: {
      backgroundColor: "#111827",
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      marginTop: 8,
    },

    buttonDisabled: {
      opacity: 0.5,
    },

    primaryButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },
  });
