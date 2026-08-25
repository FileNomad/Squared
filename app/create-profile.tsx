import { useState } from "react";
import { StyleSheet, Text } from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Spacing,
} from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export default function CreateProfileScreen() {
  const { colors } = useTheme();

  const {
    session,
    refreshProfile,
  } = useAuth();

  const [
    displayName,
    setDisplayName,
  ] = useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleContinue() {
    const trimmedName =
      displayName.trim();

    if (!trimmedName) {
      setError(
        "Enter a display name."
      );
      return;
    }

    if (!session) {
      setError(
        "Your session could not be found. Please sign in again."
      );
      return;
    }

    setLoading(true);
    setError("");

    const {
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .upsert(
          {
            id:
              session.user.id,

            display_name:
              trimmedName,
          },
          {
            onConflict: "id",
          }
        );

    if (profileError) {
      console.error(
        "Failed to save profile:",
        profileError.message
      );

      if (
        profileError.code ===
        "23505"
      ) {
        setError(
          "That display name is already in use. Please choose another."
        );
      } else {
        setError(
          "Could not save your profile. Please try again."
        );
      }

      setLoading(false);
      return;
    }

    await refreshProfile();

    setLoading(false);

    /*
     * No router.replace() is necessary.
     *
     * Once AuthContext receives the profile,
     * _layout.tsx changes from:
     *
     * session + no profile
     *
     * to:
     *
     * session + profile
     *
     * and Expo Router exposes the main app.
     */
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
        Choose your name
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
        This is how other people
        will see you in GroupFinance.
      </Text>

      <Card>
        <TextField
          label="Display name"
          placeholder="John Doe"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setError("");
          }}
          maxLength={40}
          editable={!loading}
          autoCapitalize="words"
          error={error}
        />

        <Button
          label="Continue"
          onPress={handleContinue}
          disabled={
            !displayName.trim()
          }
          loading={loading}
        />
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
    fontSize: FontSize.md,
    lineHeight: 23,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
});
