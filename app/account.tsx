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

import {
    FunctionsFetchError,
    FunctionsHttpError,
    FunctionsRelayError,
} from "@supabase/supabase-js";

import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";

export default function AccountScreen() {
  const { profile } = useAuth();

  const [password, setPassword] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const [
    showConfirmation,
    setShowConfirmation,
  ] = useState(false);

  const [error, setError] =
    useState("");

  async function performDeletion() {
    if (!password) {
      setError(
        "Enter your password first."
      );
      return;
    }

    setDeleting(true);
    setError("");

    const {
      data,
      error: functionError,
    } = await supabase.functions.invoke(
      "delete-account",
      {
        body: {
          password,
        },
      }
    );

    if (functionError) {
      if (
        functionError instanceof
        FunctionsHttpError
      ) {
        try {
          const errorBody =
            await functionError.context.json();

          console.error(
            "Edge Function error body:",
            errorBody
          );

          setError(
            errorBody?.error ??
              "Could not delete your account."
          );
        } catch (parseError) {
          console.error(
            "Could not parse Edge Function error:",
            parseError
          );

          setError(
            "The server returned an error."
          );
        }
      } else if (
        functionError instanceof
        FunctionsRelayError
      ) {
        console.error(
          "Edge Function relay error:",
          functionError
        );

        setError(
          "There was a problem communicating with the server."
        );
      } else if (
        functionError instanceof
        FunctionsFetchError
      ) {
        console.error(
          "Edge Function fetch error:",
          functionError
        );

        setError(
          "Could not reach the server."
        );
      } else {
        console.error(
          "Delete account function failed:",
          functionError
        );

        setError(
          "Could not delete your account."
        );
      }

      setDeleting(false);
      setShowConfirmation(false);
      return;
    }

    if (data?.error) {
      console.error(
        "Delete account returned an error:",
        data.error
      );

      setError(data.error);
      setDeleting(false);
      setShowConfirmation(false);
      return;
    }

    await supabase.auth.signOut();

    router.replace("/login");
  }

  function handleDeleteAccount() {
    if (!password) {
      setError(
        "Enter your password first."
      );
      return;
    }

    setError("");
    setShowConfirmation(true);
  }

  function handleCancelDeletion() {
    setShowConfirmation(false);
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>
          Account
        </Text>

        <Text
          style={styles.displayName}
        >
          {profile?.display_name}
        </Text>

        <View
          style={styles.dangerSection}
        >
          <Text
            style={styles.dangerTitle}
          >
            Delete Account
          </Text>

          <Text
            style={styles.description}
          >
            Permanently delete your
            GroupFinance account and
            remove your access to all
            events.
          </Text>

          <Text
            style={styles.warning}
          >
            Existing shared transaction
            history may remain in an
            anonymised form so other
            members&apos; records are not
            destroyed.
          </Text>

          <Text
            style={styles.label}
          >
            Confirm your password
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!deleting}
          />

          {error ? (
            <Text
              style={styles.errorText}
            >
              {error}
            </Text>
          ) : null}

          {!showConfirmation ? (
            <Pressable
              style={[
                styles.deleteButton,
                (!password ||
                  deleting) &&
                  styles.disabledButton,
              ]}
              onPress={
                handleDeleteAccount
              }
              disabled={
                !password ||
                deleting
              }
            >
              <Text
                style={
                  styles.deleteButtonText
                }
              >
                Delete My Account
              </Text>
            </Pressable>
          ) : (
            <View
              style={
                styles.confirmationBox
              }
            >
              <Text
                style={
                  styles.confirmationTitle
                }
              >
                Are you sure?
              </Text>

              <Text
                style={
                  styles.confirmationText
                }
              >
                This permanently deletes
                your GroupFinance account.
                This action cannot be
                undone.
              </Text>

              <View
                style={
                  styles.confirmationActions
                }
              >
                <Pressable
                  style={
                    styles.cancelButton
                  }
                  onPress={
                    handleCancelDeletion
                  }
                  disabled={deleting}
                >
                  <Text
                    style={
                      styles.cancelButtonText
                    }
                  >
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.confirmDeleteButton,
                    deleting &&
                      styles.disabledButton,
                  ]}
                  onPress={
                    performDeletion
                  }
                  disabled={deleting}
                >
                  {deleting ? (
                    <ActivityIndicator
                      color="white"
                    />
                  ) : (
                    <Text
                      style={
                        styles.confirmDeleteButtonText
                      }
                    >
                      Yes, Delete Account
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>
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
    },

    content: {
      padding: 24,
    },

    title: {
      fontSize: 30,
      fontWeight: "700",
      color: "#111827",
    },

    displayName: {
      fontSize: 16,
      color: "#6B7280",
      marginTop: 8,
    },

    dangerSection: {
      marginTop: 36,
      backgroundColor: "white",
      borderWidth: 1,
      borderColor: "#FCA5A5",
      borderRadius: 16,
      padding: 20,
    },

    dangerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#DC2626",
    },

    description: {
      fontSize: 15,
      color: "#374151",
      lineHeight: 22,
      marginTop: 10,
    },

    warning: {
      fontSize: 14,
      color: "#6B7280",
      lineHeight: 20,
      marginTop: 12,
    },

    label: {
      fontSize: 14,
      fontWeight: "600",
      color: "#374151",
      marginTop: 24,
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
    },

    errorText: {
      color: "#DC2626",
      fontSize: 14,
      marginTop: 12,
    },

    deleteButton: {
      backgroundColor: "#DC2626",
      borderRadius: 12,
      paddingVertical: 15,
      alignItems: "center",
      marginTop: 20,
      minHeight: 50,
      justifyContent: "center",
    },

    deleteButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },

    disabledButton: {
      opacity: 0.45,
    },

    confirmationBox: {
      marginTop: 20,
      borderWidth: 1,
      borderColor: "#FCA5A5",
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FEF2F2",
    },

    confirmationTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: "#991B1B",
    },

    confirmationText: {
      fontSize: 14,
      color: "#7F1D1D",
      lineHeight: 20,
      marginTop: 8,
    },

    confirmationActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    cancelButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      backgroundColor: "white",
    },

    cancelButtonText: {
      color: "#374151",
      fontWeight: "600",
    },

    confirmDeleteButton: {
      flex: 1,
      backgroundColor: "#DC2626",
      borderRadius: 10,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    confirmDeleteButtonText: {
      color: "white",
      fontWeight: "600",
    },
  });