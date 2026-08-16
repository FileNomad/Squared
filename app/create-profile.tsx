import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function CreateProfileScreen() {
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

            is_deleted:
              false,
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
    <View
      style={styles.container}
    >
      <View style={styles.card}>
        <Text style={styles.title}>
          Choose your name
        </Text>

        <Text
          style={
            styles.subtitle
          }
        >
          This is how other people
          will see you in GroupFinance.
        </Text>

        <Text style={styles.label}>
          Display name
        </Text>

        <TextInput
          style={styles.input}
          placeholder="John Doe"
          placeholderTextColor="#9CA3AF"
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setError("");
          }}
          maxLength={40}
          editable={!loading}
          autoCapitalize="words"
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
            styles.button,
            (!displayName.trim() ||
              loading) &&
              styles.buttonDisabled,
          ]}
          onPress={
            handleContinue
          }
          disabled={
            !displayName.trim() ||
            loading
          }
        >
          {loading ? (
            <ActivityIndicator
              color="white"
            />
          ) : (
            <Text
              style={
                styles.buttonText
              }
            >
              Continue
            </Text>
          )}
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
      fontSize: 30,
      fontWeight: "700",
      color: "#111827",
    },

    subtitle: {
      fontSize: 16,
      color: "#6B7280",
      lineHeight: 23,
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
    },

    errorText: {
      fontSize: 14,
      color: "#DC2626",
      lineHeight: 20,
      marginTop: 12,
    },

    button: {
      backgroundColor: "#111827",
      paddingVertical: 15,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
      marginTop: 24,
    },

    buttonDisabled: {
      opacity: 0.45,
    },

    buttonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },
  });