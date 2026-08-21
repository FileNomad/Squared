import {
  router,
  useFocusEffect,
} from "expo-router";
import {
  useCallback,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventContext";
import { supabase } from "../lib/supabase";

export default function HomeScreen() {
  const {
    profile,
  } = useAuth();

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
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>
              Group Finance
            </Text>

            <Text
              style={styles.subtitle}
            >
              Keep group spending simple.
            </Text>
          </View>

          <View
            style={
              styles.accountActions
            }
          >
            <Pressable
              onPress={() =>
                router.push(
                  "/balances"
                )
              }
            >
              <Text
                style={
                  styles.accountText
                }
              >
                Balances
              </Text>
            </Pressable>

            <Pressable
              onPress={() =>
                router.push(
                  "/account"
                )
              }
            >
              <Text
                style={
                  styles.accountText
                }
              >
                Account
              </Text>
            </Pressable>

            <Pressable
              onPress={
                handleSignOut
              }
            >
              <Text
                style={
                  styles.signOutText
                }
              >
                Sign Out
              </Text>
            </Pressable>
          </View>
        </View>

        {profile ? (
          <Text
            style={
              styles.welcomeText
            }
          >
            Signed in as{" "}
            {profile.display_name}
          </Text>
        ) : null}

        <Pressable
          style={
            styles.createButton
          }
          onPress={() =>
            router.push(
              "/create-event"
            )
          }
        >
          <Text
            style={
              styles.createButtonText
            }
          >
            + Create Event
          </Text>
        </Pressable>

        <View
          style={
            styles.sectionHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Your Events
          </Text>

          <Pressable
            style={
              styles.refreshButton
            }
            onPress={
              handleRefresh
            }
            disabled={refreshing}
          >
            <Text
              style={
                styles.refreshButtonText
              }
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator />
          </View>
        ) : events.length === 0 ? (
          <Text
            style={
              styles.emptyText
            }
          >
            You haven&apos;t created or
            joined any events yet.
          </Text>
        ) : (
          events.map((event) => (
            <Pressable
              key={event.id}
              style={
                styles.eventCard
              }
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
              <Text
                style={
                  styles.eventName
                }
              >
                {event.name}
              </Text>

              {event.description ? (
                <Text
                  style={
                    styles.eventDescription
                  }
                >
                  {
                    event.description
                  }
                </Text>
              ) : null}

              <Text
                style={
                  styles.memberCount
                }
              >
                {
                  event.members.length
                }{" "}
                {event.members.length ===
                1
                  ? "member"
                  : "members"}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
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
      paddingHorizontal: 24,
      paddingTop: 70,
      paddingBottom: 40,
    },

    headerRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems:
        "flex-start",
      gap: 20,
    },

    headerText: {
      flex: 1,
    },

    title: {
      fontSize: 32,
      fontWeight: "700",
      color: "#111827",
    },

    subtitle: {
      fontSize: 16,
      color: "#6B7280",
      marginTop: 6,
    },

    accountActions: {
      alignItems:
        "flex-end",
      gap: 12,
    },

    accountText: {
      color: "#111827",
      fontSize: 14,
      fontWeight: "600",
    },

    signOutText: {
      color: "#DC2626",
      fontSize: 14,
      fontWeight: "600",
    },

    welcomeText: {
      fontSize: 14,
      color: "#6B7280",
      marginTop: 18,
    },

    createButton: {
      backgroundColor: "#111827",
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 28,
    },

    createButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },

    sectionHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginTop: 36,
      marginBottom: 14,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#111827",
    },

    refreshButton: {
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      backgroundColor: "white",
    },

    refreshButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
    },

    loadingContainer: {
      paddingVertical: 20,
    },

    emptyText: {
      color: "#6B7280",
      fontSize: 15,
    },

    eventCard: {
      backgroundColor: "white",
      borderRadius: 16,
      padding: 18,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: "#E5E7EB",
    },

    eventName: {
      fontSize: 18,
      fontWeight: "600",
      color: "#111827",
    },

    eventDescription: {
      fontSize: 14,
      color: "#6B7280",
      marginTop: 6,
    },

    memberCount: {
      fontSize: 13,
      color: "#9CA3AF",
      marginTop: 10,
    },
  });