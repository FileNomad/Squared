import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
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
  Radius,
  Spacing,
} from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const { colors } = useTheme();

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [loading, setLoading] =
    useState(false);

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
    <ScreenContainer centered>
      <View
        style={styles.badgeRow}
      >
        <View
          style={[
            styles.badge,
            {
              backgroundColor:
                colors.primary,
            },
          ]}
        >
          <Ionicons
            name="wallet-outline"
            size={28}
            color={
              colors.onPrimary
            }
          />
        </View>
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
        Group Finance
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
        Sign in to continue
      </Text>

      <Card>
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
          editable={!loading}
        />

        <TextField
          label="Password"
          placeholder="Enter your password"
          secureToggle
          value={password}
          onChangeText={(
            value
          ) => {
            setPassword(value);
            setError("");
          }}
          editable={!loading}
        />

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
            style={[
              styles.forgotPasswordText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            Forgot password?
          </Text>
        </Pressable>

        {error ? (
          <Text
            style={[
              styles.messageText,
              {
                color:
                  colors.dangerText,
              },
            ]}
          >
            {error}
          </Text>
        ) : null}

        {message ? (
          <Text
            style={[
              styles.messageText,
              {
                color:
                  colors.successText,
              },
            ]}
          >
            {message}
          </Text>
        ) : null}

        <View
          style={
            styles.buttonSpacing
          }
        >
          <Button
            label={
              loading
                ? "Signing In..."
                : "Sign In"
            }
            onPress={
              handleSignIn
            }
            loading={loading}
          />
        </View>

        <View
          style={
            styles.buttonSpacing
          }
        >
          <Button
            label="Create Account"
            variant="ghost"
            onPress={
              handleSignUp
            }
            disabled={loading}
          />
        </View>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },

  badge: {
    width: 56,
    height: 56,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    textAlign: "center",
  },

  subtitle: {
    fontSize: FontSize.md,
    textAlign: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },

  forgotPasswordButton: {
    alignSelf: "flex-end",
    marginBottom: Spacing.md,
  },

  forgotPasswordText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  messageText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },

  buttonSpacing: {
    marginTop: Spacing.sm,
  },
});
