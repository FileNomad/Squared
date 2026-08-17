import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

export default function ForgotPasswordScreen() {
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
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Reset your password
        </Text>

        <Text style={styles.subtitle}>
          Enter the email you signed
          up with and we&apos;ll send
          you a link to set a new
          password.
        </Text>

        {sent ? (
          <>
            <Text
              style={
                styles.messageText
              }
            >
              If an account exists
              for that email,
              we&apos;ve sent a
              password reset link.
              Check your inbox.
            </Text>

            <Pressable
              style={
                styles.primaryButton
              }
              onPress={() =>
                router.replace(
                  "/login"
                )
              }
            >
              <Text
                style={
                  styles.primaryButtonText
                }
              >
                Back to Sign In
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text
              style={styles.label}
            >
              Email
            </Text>

            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
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
              editable={!loading}
            />

            {error ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {error}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                loading &&
                  styles.buttonDisabled,
              ]}
              onPress={
                handleSendResetLink
              }
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator
                  color="white"
                />
              ) : (
                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Send Reset Link
                </Text>
              )}
            </Pressable>

            <Pressable
              style={
                styles.secondaryButton
              }
              onPress={() =>
                router.back()
              }
              disabled={loading}
            >
              <Text
                style={
                  styles.secondaryButtonText
                }
              >
                Back to Sign In
              </Text>
            </Pressable>
          </>
        )}
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
    },

    subtitle: {
      fontSize: 15,
      color: "#6B7280",
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 24,
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
      marginBottom: 10,
    },

    errorText: {
      fontSize: 14,
      color: "#DC2626",
      lineHeight: 20,
      marginBottom: 14,
    },

    messageText: {
      fontSize: 14,
      color: "#374151",
      lineHeight: 20,
      marginBottom: 20,
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

    secondaryButton: {
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 6,
    },

    secondaryButtonText: {
      color: "#111827",
      fontSize: 15,
      fontWeight: "600",
    },
  });
