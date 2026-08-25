import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useFocusEffect,
} from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import {
  FontSize,
  Radius,
  Spacing,
} from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventContext";
import { useTheme } from "../context/ThemeContext";
import { supabase } from "../lib/supabase";

export default function HomeScreen() {
  const { colors } = useTheme();

  const { profile } = useAuth();

  const {
    events,
    loading,
    refreshing,
    refreshEvents,
  } = useEvents();

  useFocusEffect(
    useCallback(() => {
      refreshEvents();

      return undefined;
    }, [refreshEvents])
  );

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  async function handleRefresh() {
    await refreshEvents(true);
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
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
            Keep group spending simple.
          </Text>
        </View>

        <View
          style={
            styles.headerActions
          }
        >
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.border,
              },
            ]}
            onPress={() =>
              router.push(
                "/balances"
              )
            }
          >
            <Ionicons
              name="stats-chart-outline"
              size={18}
              color={
                colors.textPrimary
              }
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.border,
              },
            ]}
            onPress={() =>
              router.push(
                "/account"
              )
            }
          >
            <Ionicons
              name="person-outline"
              size={18}
              color={
                colors.textPrimary
              }
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.border,
              },
            ]}
            onPress={
              handleSignOut
            }
          >
            <Ionicons
              name="log-out-outline"
              size={18}
              color={
                colors.dangerText
              }
            />
          </Pressable>
        </View>
      </View>

      {profile ? (
        <Text
          style={[
            styles.welcomeText,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          Signed in as{" "}
          {profile.display_name}
        </Text>
      ) : null}

      <View
        style={
          styles.createButtonSpacing
        }
      >
        <Button
          label="Create Event"
          icon="add"
          onPress={() =>
            router.push(
              "/create-event"
            )
          }
        />
      </View>

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Your Events
      </Text>

      {loading ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            color={colors.primary}
          />
        </View>
      ) : events.length === 0 ? (
        <View
          style={
            styles.emptyState
          }
        >
          <Ionicons
            name="folder-open-outline"
            size={32}
            color={
              colors.textTertiary
            }
          />

          <Text
            style={[
              styles.emptyText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            You haven&apos;t created or
            joined any events yet.
          </Text>
        </View>
      ) : (
        events.map((event) => (
          <Pressable
            key={event.id}
            style={[
              styles.eventCard,
              {
                backgroundColor:
                  colors.surface,
                borderColor:
                  colors.border,
              },
            ]}
            onPress={() =>
              router.push({
                pathname:
                  "/events/[id]",
                params: {
                  id: event.id,
                },
              })
            }
          >
            <View
              style={
                styles.eventCardText
              }
            >
              <Text
                style={[
                  styles.eventName,
                  {
                    color:
                      colors.textPrimary,
                  },
                ]}
              >
                {event.name}
              </Text>

              {event.description ? (
                <Text
                  style={[
                    styles.eventDescription,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {
                    event.description
                  }
                </Text>
              ) : null}

              <View
                style={
                  styles.memberRow
                }
              >
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={
                    colors.textTertiary
                  }
                />

                <Text
                  style={[
                    styles.memberCount,
                    {
                      color:
                        colors.textTertiary,
                    },
                  ]}
                >
                  {
                    event.members.length
                  }{" "}
                  {event.members.length ===
                  1
                    ? "member"
                    : "members"}
                </Text>
              </View>
            </View>

            <Ionicons
              name="chevron-forward"
              size={20}
              color={
                colors.textTertiary
              }
            />
          </Pressable>
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
    gap: Spacing.md,
  },

  headerText: {
    flex: 1,
  },

  title: {
    fontSize: FontSize.display,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: FontSize.md,
    marginTop: Spacing.xs,
  },

  headerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  iconButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  welcomeText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.lg,
  },

  createButtonSpacing: {
    marginTop: Spacing.xl,
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  loadingContainer: {
    paddingVertical: Spacing.xl,
  },

  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },

  emptyText: {
    fontSize: FontSize.base,
    textAlign: "center",
  },

  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },

  eventCardText: {
    flex: 1,
    marginRight: Spacing.md,
  },

  eventName: {
    fontSize: FontSize.lg,
    fontWeight: "600",
  },

  eventDescription: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },

  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
  },

  memberCount: {
    fontSize: FontSize.xs,
  },
});
