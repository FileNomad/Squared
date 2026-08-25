import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Radius,
  Spacing,
} from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import {
  ThemePreference,
  useTheme,
} from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

const APPEARANCE_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    value: "system",
    label: "System",
    icon: "phone-portrait-outline",
  },
  {
    value: "light",
    label: "Light",
    icon: "sunny-outline",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "moon-outline",
  },
];

export default function AccountScreen() {
  const {
    colors,
    preference,
    setPreference,
  } = useTheme();

  const {
    profile,
    refreshProfile,
  } = useAuth();

  const [
    editingName,
    setEditingName,
  ] = useState(false);

  const [
    displayNameInput,
    setDisplayNameInput,
  ] = useState(
    profile?.display_name ?? ""
  );

  const [
    savingName,
    setSavingName,
  ] = useState(false);

  const [
    nameError,
    setNameError,
  ] = useState("");

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

  function handleEditNamePress() {
    setDisplayNameInput(
      profile?.display_name ?? ""
    );
    setNameError("");
    setEditingName(true);
  }

  function handleCancelEditName() {
    setEditingName(false);
    setNameError("");
  }

  async function handleSaveName() {
    const trimmedName =
      displayNameInput.trim();

    if (!trimmedName) {
      setNameError(
        "Enter a display name."
      );
      return;
    }

    if (
      trimmedName ===
      profile?.display_name
    ) {
      setEditingName(false);
      return;
    }

    if (!profile) {
      return;
    }

    setSavingName(true);
    setNameError("");

    const { error } =
      await supabase
        .from("profiles")
        .update({
          display_name:
            trimmedName,
        })
        .eq("id", profile.id);

    setSavingName(false);

    if (error) {
      if (
        error.code === "23505"
      ) {
        setNameError(
          "That display name is already in use. Please choose another."
        );
      } else {
        setNameError(
          "Could not update your display name. Please try again."
        );
      }
      return;
    }

    await refreshProfile();

    setEditingName(false);
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
    <ScreenContainer>
      <Text
        style={[
          styles.title,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Account
      </Text>

      {!editingName ? (
        <View
          style={styles.nameRow}
        >
          <Text
            style={[
              styles.displayName,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {profile?.display_name}
          </Text>

          <Pressable
            onPress={
              handleEditNamePress
            }
          >
            <Text
              style={[
                styles.editNameLink,
                {
                  color:
                    colors.primary,
                },
              ]}
            >
              Edit
            </Text>
          </Pressable>
        </View>
      ) : (
        <View
          style={
            styles.nameEditBox
          }
        >
          <TextField
            label="Display name"
            placeholder="Your name"
            value={
              displayNameInput
            }
            onChangeText={(
              value
            ) => {
              setDisplayNameInput(
                value
              );
              setNameError("");
            }}
            maxLength={40}
            autoCapitalize="words"
            editable={
              !savingName
            }
            error={nameError}
          />

          <View
            style={
              styles.nameEditActions
            }
          >
            <View
              style={
                styles.actionButton
              }
            >
              <Button
                label="Cancel"
                variant="secondary"
                onPress={
                  handleCancelEditName
                }
                disabled={
                  savingName
                }
              />
            </View>

            <View
              style={
                styles.actionButton
              }
            >
              <Button
                label="Save"
                onPress={
                  handleSaveName
                }
                loading={
                  savingName
                }
              />
            </View>
          </View>
        </View>
      )}

      <Text
        style={[
          styles.sectionLabel,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Appearance
      </Text>

      <View
        style={[
          styles.appearanceRow,
          {
            backgroundColor:
              colors.surfaceSubtle,
          },
        ]}
      >
        {APPEARANCE_OPTIONS.map(
          (option) => {
            const active =
              preference ===
              option.value;

            return (
              <Pressable
                key={option.value}
                style={[
                  styles.appearanceOption,
                  active && {
                    backgroundColor:
                      colors.surface,
                  },
                ]}
                onPress={() =>
                  setPreference(
                    option.value
                  )
                }
              >
                <Ionicons
                  name={
                    option.icon
                  }
                  size={16}
                  color={
                    active
                      ? colors.primary
                      : colors.textSecondary
                  }
                />

                <Text
                  style={[
                    styles.appearanceLabel,
                    {
                      color: active
                        ? colors.primary
                        : colors.textSecondary,
                    },
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          }
        )}
      </View>

      <Card
        variant="danger"
        style={styles.dangerSection}
      >
        <Text
          style={[
            styles.dangerTitle,
            {
              color:
                colors.dangerText,
            },
          ]}
        >
          Delete Account
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
          Permanently delete your
          GroupFinance account and
          remove your access to all
          events.
        </Text>

        <Text
          style={[
            styles.warning,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          Existing shared transaction
          history may remain in an
          anonymised form so other
          members&apos; records are not
          destroyed.
        </Text>

        <TextField
          label="Confirm your password"
          placeholder="Enter your password"
          secureToggle
          value={password}
          onChangeText={setPassword}
          editable={!deleting}
        />

        {error ? (
          <Text
            style={[
              styles.errorText,
              {
                color:
                  colors.dangerText,
              },
            ]}
          >
            {error}
          </Text>
        ) : null}

        {!showConfirmation ? (
          <Button
            label="Delete My Account"
            variant="danger"
            onPress={
              handleDeleteAccount
            }
            disabled={!password}
          />
        ) : (
          <View
            style={[
              styles.confirmationBox,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.dangerBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.confirmationTitle,
                {
                  color:
                    colors.dangerTextStrong,
                },
              ]}
            >
              Are you sure?
            </Text>

            <Text
              style={[
                styles.confirmationText,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
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
              <View
                style={
                  styles.actionButton
                }
              >
                <Button
                  label="Cancel"
                  variant="secondary"
                  onPress={
                    handleCancelDeletion
                  }
                  disabled={
                    deleting
                  }
                />
              </View>

              <View
                style={
                  styles.actionButton
                }
              >
                <Button
                  label="Yes, Delete"
                  variant="danger"
                  onPress={
                    performDeletion
                  }
                  loading={deleting}
                />
              </View>
            </View>
          </View>
        )}
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  displayName: {
    fontSize: FontSize.md,
  },

  nameRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },

  editNameLink: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  nameEditBox: {
    marginTop: Spacing.lg,
  },

  nameEditActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  actionButton: {
    flex: 1,
  },

  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  appearanceRow: {
    flexDirection: "row",
    borderRadius: Radius.lg,
    padding: 4,
    gap: 4,
  },

  appearanceOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },

  appearanceLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  dangerSection: {
    marginTop: Spacing.xxl,
  },

  dangerTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },

  description: {
    fontSize: FontSize.base,
    lineHeight: 22,
    marginTop: Spacing.sm,
  },

  warning: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },

  confirmationBox: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },

  confirmationTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },

  confirmationText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },

  confirmationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
