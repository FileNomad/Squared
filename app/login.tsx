import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [
    passwordVisible,
    setPasswordVisible,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  async function handleSignIn() {
    if (
      !email.trim() ||
      !password
    ) {
      setError(
        "Enter your email and password."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const {
      error: signInError,
    } =
      await supabase.auth
        .signInWithPassword({
          email: email.trim(),
          password,
        });

    setLoading(false);

    if (signInError) {
      setError(
        "Could not sign in with those credentials. Please check your email and password, or create an account."
      );
    }
  }

  async function handleSignUp() {
    if (
      !email.trim() ||
      !password
    ) {
      setError(
        "Enter an email and password first."
      );
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    const {
      error: signUpError,
    } =
      await supabase.auth.signUp({
        email: email.trim(),
        password,

        options: {
          emailRedirectTo:
            "groupfinance://email-confirmed",
        },
      });

    setLoading(false);

    if (signUpError) {
      setError(
        signUpError.message
      );
      return;
    }

    setMessage(
      "Account created. Check your email to confirm your account."
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>
          Group Finance
        </Text>

        <Text style={styles.subtitle}>
          Sign in to continue
        </Text>

        <Text style={styles.label}>
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
          onChangeText={(value) => {
            setEmail(value);
            setError("");
          }}
          editable={!loading}
        />

        <Text style={styles.label}>
          Password
        </Text>

        <View
          style={
            styles.passwordContainer
          }
        >
          <TextInput
            style={
              styles.passwordInput
            }
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry={
              !passwordVisible
            }
            value={password}
            onChangeText={(value) => {
              setPassword(value);
              setError("");
            }}
            editable={!loading}
          />

          <Pressable
            style={
              styles.showButton
            }
            onPress={() =>
              setPasswordVisible(
                (current) =>
                  !current
              )
            }
          >
            <Text
              style={
                styles.showButtonText
              }
            >
              {passwordVisible
                ? "Hide"
                : "Show"}
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={
            styles.forgotPasswordButton
          }
          onPress={() =>
            router.push(
              "/forgot-password"
            )
          }
        >
          <Text
            style={
              styles.forgotPasswordText
            }
          >
            Forgot password?
          </Text>
        </Pressable>

        {error ? (
          <Text
            style={
              styles.errorText
            }
          >
            {error}
          </Text>
        ) : null}

        {message ? (
          <Text
            style={
              styles.messageText
            }
          >
            {message}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.primaryButton,
            loading &&
              styles.buttonDisabled,
          ]}
          onPress={
            handleSignIn
          }
          disabled={loading}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            {loading
              ? "Signing In..."
              : "Sign In"}
          </Text>
        </Pressable>

        <Pressable
          style={
            styles.secondaryButton
          }
          onPress={
            handleSignUp
          }
          disabled={loading}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Create Account
          </Text>
        </Pressable>
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
      fontSize: 32,
      fontWeight: "700",
      color: "#111827",
    },

    subtitle: {
      fontSize: 16,
      color: "#6B7280",
      marginTop: 8,
      marginBottom: 28,
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

    passwordContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      backgroundColor: "white",
      marginBottom: 10,
    },

    passwordInput: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 16,
      color: "#111827",
    },

    showButton: {
      paddingHorizontal: 14,
      paddingVertical: 14,
    },

    showButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#374151",
    },

    forgotPasswordButton: {
      alignSelf: "flex-end",
      marginBottom: 14,
    },

    forgotPasswordText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#374151",
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
      marginBottom: 14,
    },

    primaryButton: {
      backgroundColor: "#111827",
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 4,
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