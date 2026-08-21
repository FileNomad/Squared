import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
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
import { calculatePersonalBalances } from "../lib/balances";

export default function BalancesScreen() {
  const { session } = useAuth();

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

  async function handleRefresh() {
    await refreshEvents(true);
  }

  const currentUserId =
    session?.user.id ?? "";

  /*
   * Any counterparty must be a member of at least one
   * event shared with the current user (that's what the
   * transactions insert policy requires), so the union of
   * every loaded event's member list is enough to resolve
   * display names globally - no extra query needed.
   */
  const nameMap = new Map<
    string,
    string
  >();

  events.forEach((event) => {
    event.members.forEach(
      (member) => {
        nameMap.set(
          member.id,
          member.displayName
        );
      }
    );
  });

  function getName(id: string) {
    return (
      nameMap.get(id) ?? "Unknown"
    );
  }

  const allTransactions =
    events.flatMap(
      (event) => event.transactions
    );

  const balances =
    calculatePersonalBalances(
      allTransactions,
      currentUserId
    );

  const entries = Object.entries(
    balances
  ).filter(
    ([, amount]) => amount !== 0
  );

  const totalNet = entries.reduce(
    (sum, [, amount]) =>
      sum + amount,
    0
  );

  const owedToYou = entries
    .filter(
      ([, amount]) => amount > 0
    )
    .sort(
      (a, b) => b[1] - a[1]
    );

  const youOwe = entries
    .filter(
      ([, amount]) => amount < 0
    )
    .sort(
      (a, b) => a[1] - b[1]
    );

  function formatAmount(
    pence: number
  ) {
    return (
      Math.abs(pence) / 100
    ).toFixed(2);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={styles.headerRow}
        >
          <Text style={styles.title}>
            Balances
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

        <Text
          style={styles.subtitle}
        >
          Across all of your events.
        </Text>

        {loading ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator />
          </View>
        ) : (
          <>
            <View
              style={
                styles.summaryCard
              }
            >
              {totalNet === 0 ? (
                <Text
                  style={
                    styles.summaryText
                  }
                >
                  You&apos;re all
                  settled up overall.
                </Text>
              ) : totalNet > 0 ? (
                <Text
                  style={
                    styles.summaryText
                  }
                >
                  Overall, you&apos;re
                  owed{" "}
                  <Text
                    style={
                      styles.summaryAmountPositive
                    }
                  >
                    £
                    {formatAmount(
                      totalNet
                    )}
                  </Text>
                </Text>
              ) : (
                <Text
                  style={
                    styles.summaryText
                  }
                >
                  Overall, you owe
                  {" "}
                  <Text
                    style={
                      styles.summaryAmountNegative
                    }
                  >
                    £
                    {formatAmount(
                      totalNet
                    )}
                  </Text>
                </Text>
              )}
            </View>

            <Text
              style={
                styles.sectionTitle
              }
            >
              You&apos;re Owed
            </Text>

            {owedToYou.length ===
            0 ? (
              <Text
                style={
                  styles.emptyText
                }
              >
                Nobody owes you
                anything right now.
              </Text>
            ) : (
              owedToYou.map(
                ([id, amount]) => (
                  <View
                    key={id}
                    style={
                      styles.balanceRow
                    }
                  >
                    <Text
                      style={
                        styles.balanceName
                      }
                    >
                      {getName(id)}
                    </Text>

                    <Text
                      style={
                        styles.balanceAmountPositive
                      }
                    >
                      £
                      {formatAmount(
                        amount
                      )}
                    </Text>
                  </View>
                )
              )
            )}

            <Text
              style={
                styles.sectionTitle
              }
            >
              You Owe
            </Text>

            {youOwe.length === 0 ? (
              <Text
                style={
                  styles.emptyText
                }
              >
                You don&apos;t owe
                anyone right now.
              </Text>
            ) : (
              youOwe.map(
                ([id, amount]) => (
                  <View
                    key={id}
                    style={
                      styles.balanceRow
                    }
                  >
                    <Text
                      style={
                        styles.balanceName
                      }
                    >
                      {getName(id)}
                    </Text>

                    <Text
                      style={
                        styles.balanceAmountNegative
                      }
                    >
                      £
                      {formatAmount(
                        amount
                      )}
                    </Text>
                  </View>
                )
              )
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "white",
    },

    content: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 50,
    },

    headerRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    title: {
      fontSize: 30,
      fontWeight: "700",
      color: "#111827",
    },

    subtitle: {
      fontSize: 15,
      color: "#6B7280",
      marginTop: 8,
      marginBottom: 24,
    },

    refreshButton: {
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 8,
      backgroundColor: "#F9FAFB",
    },

    refreshButtonText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#374151",
    },

    loadingContainer: {
      paddingVertical: 40,
    },

    summaryCard: {
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 14,
      padding: 18,
      marginBottom: 8,
    },

    summaryText: {
      fontSize: 16,
      color: "#374151",
      lineHeight: 24,
    },

    summaryAmountPositive: {
      fontWeight: "700",
      color: "#059669",
    },

    summaryAmountNegative: {
      fontWeight: "700",
      color: "#DC2626",
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#111827",
      marginTop: 28,
      marginBottom: 12,
    },

    emptyText: {
      fontSize: 15,
      color: "#9CA3AF",
    },

    balanceRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginBottom: 8,
    },

    balanceName: {
      fontSize: 16,
      fontWeight: "500",
      color: "#111827",
    },

    balanceAmountPositive: {
      fontSize: 16,
      fontWeight: "700",
      color: "#059669",
    },

    balanceAmountNegative: {
      fontSize: 16,
      fontWeight: "700",
      color: "#DC2626",
    },
  });
