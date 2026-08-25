import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import {
  FontSize,
  Radius,
  Spacing,
} from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import { useEvents } from "../context/EventContext";
import { useTheme } from "../context/ThemeContext";
import { calculatePersonalBalances } from "../lib/balances";

export default function BalancesScreen() {
  const { colors } = useTheme();

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

  function initials(name: string) {
    return name
      .trim()
      .charAt(0)
      .toUpperCase();
  }

  function BalanceRow({
    id,
    amount,
    positive,
  }: {
    id: string;
    amount: number;
    positive: boolean;
  }) {
    const name = getName(id);

    return (
      <View
        style={[
          styles.balanceRow,
          {
            backgroundColor:
              colors.surface,
            borderColor:
              colors.border,
          },
        ]}
      >
        <View
          style={
            styles.balanceLeft
          }
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor:
                  colors.surfaceSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {initials(name)}
            </Text>
          </View>

          <Text
            style={[
              styles.balanceName,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {name}
          </Text>
        </View>

        <Text
          style={[
            styles.balanceAmount,
            {
              color: positive
                ? colors.successText
                : colors.dangerText,
            },
          ]}
        >
          £{formatAmount(amount)}
        </Text>
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <Text
        style={[
          styles.title,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Balances
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
        Across all of your events.
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
      ) : (
        <>
          <Card
            variant={
              totalNet === 0
                ? "default"
                : totalNet > 0
                  ? "success"
                  : "danger"
            }
          >
            {totalNet === 0 ? (
              <Text
                style={[
                  styles.summaryText,
                  {
                    color:
                      colors.textPrimary,
                  },
                ]}
              >
                You&apos;re all
                settled up overall.
              </Text>
            ) : (
              <Text
                style={[
                  styles.summaryText,
                  {
                    color:
                      colors.textPrimary,
                  },
                ]}
              >
                Overall, you{" "}
                {totalNet > 0
                  ? "are owed"
                  : "owe"}
                {"\n"}
                <Text
                  style={[
                    styles.summaryAmount,
                    {
                      color:
                        totalNet > 0
                          ? colors.successText
                          : colors.dangerText,
                    },
                  ]}
                >
                  £
                  {formatAmount(
                    totalNet
                  )}
                </Text>
              </Text>
            )}
          </Card>

          <View
            style={
              styles.sectionRow
            }
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={18}
              color={
                colors.successText
              }
            />

            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    colors.textPrimary,
                },
              ]}
            >
              You&apos;re Owed
            </Text>
          </View>

          {owedToYou.length ===
          0 ? (
            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    colors.textTertiary,
                },
              ]}
            >
              Nobody owes you
              anything right now.
            </Text>
          ) : (
            owedToYou.map(
              ([id, amount]) => (
                <BalanceRow
                  key={id}
                  id={id}
                  amount={amount}
                  positive
                />
              )
            )
          )}

          <View
            style={
              styles.sectionRow
            }
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={18}
              color={
                colors.dangerText
              }
            />

            <Text
              style={[
                styles.sectionTitle,
                {
                  color:
                    colors.textPrimary,
                },
              ]}
            >
              You Owe
            </Text>
          </View>

          {youOwe.length === 0 ? (
            <Text
              style={[
                styles.emptyText,
                {
                  color:
                    colors.textTertiary,
                },
              ]}
            >
              You don&apos;t owe
              anyone right now.
            </Text>
          ) : (
            youOwe.map(
              ([id, amount]) => (
                <BalanceRow
                  key={id}
                  id={id}
                  amount={amount}
                  positive={false}
                />
              )
            )
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },

  loadingContainer: {
    paddingVertical: Spacing.xxl,
  },

  summaryText: {
    fontSize: FontSize.md,
    lineHeight: 24,
  },

  summaryAmount: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },

  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
  },

  emptyText: {
    fontSize: FontSize.base,
  },

  balanceRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },

  balanceLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  balanceName: {
    fontSize: FontSize.md,
    fontWeight: "500",
  },

  balanceAmount: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },
});
