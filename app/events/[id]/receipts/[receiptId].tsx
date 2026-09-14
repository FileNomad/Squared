import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useLocalSearchParams,
} from "expo-router";
import {
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "../../../../components/ui/Button";
import { Card } from "../../../../components/ui/Card";
import { ScreenContainer } from "../../../../components/ui/ScreenContainer";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../../../constants/theme";
import { useAuth } from "../../../../context/AuthContext";
import { useEvents } from "../../../../context/EventContext";
import { useReceipt } from "../../../../context/ReceiptContext";
import { useTheme } from "../../../../context/ThemeContext";
import { getCategoryDisplayLabel } from "../../../../lib/categories";
import {
  fetchExchangeRate,
  formatCurrencyFromPence,
} from "../../../../lib/currency";

export default function ReceiptDetailScreen() {
  const { colors, colorScheme } =
    useTheme();

  const { id, receiptId } =
    useLocalSearchParams<{
      id: string;
      receiptId: string;
    }>();

  const { session } = useAuth();

  const { events } = useEvents();

  const {
    receipt,
    loading,
    loadReceipt,
    clearReceipt,
    subscribeToReceipt,
    claimItem,
    unclaimItem,
    updateTaxTip,
    finalizeReceipt,
    cancelReceipt,
  } = useReceipt();

  const [
    togglingItemId,
    setTogglingItemId,
  ] = useState<string | null>(
    null
  );

  const [
    finalizing,
    setFinalizing,
  ] = useState(false);

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  const [
    showCancelConfirm,
    setShowCancelConfirm,
  ] = useState(false);

  const [actionError, setActionError] =
    useState("");

  const [taxInput, setTaxInput] =
    useState("");

  const [tipInput, setTipInput] =
    useState("");

  const [
    savingTaxTip,
    setSavingTaxTip,
  ] = useState(false);

  useEffect(() => {
    if (!receiptId) {
      return;
    }

    loadReceipt(receiptId);

    const unsubscribe =
      subscribeToReceipt(receiptId);

    return () => {
      unsubscribe();
      clearReceipt();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptId]);

  useEffect(() => {
    if (receipt) {
      setTaxInput(
        (
          receipt.taxInPence / 100
        ).toFixed(2)
      );

      setTipInput(
        (
          receipt.tipInPence / 100
        ).toFixed(2)
      );
    }
  }, [
    receipt?.taxInPence,
    receipt?.tipInPence,
  ]);

  const event = events.find(
    (item) => item.id === id
  );

  if (loading && !receipt) {
    return (
      <ScreenContainer centered>
        <ActivityIndicator
          color={colors.primary}
        />
      </ScreenContainer>
    );
  }

  if (!receipt || !event) {
    return (
      <ScreenContainer centered>
        <Text
          style={{
            color:
              colors.textSecondary,
            fontSize: FontSize.md,
          }}
        >
          Receipt not found.
        </Text>
      </ScreenContainer>
    );
  }

  const currentUserId =
    session?.user.id ?? "";

  const isPurchaser =
    receipt.purchaserId ===
    currentUserId;

  const isAttendee =
    receipt.attendeeIds.includes(
      currentUserId
    );

  const canInteract =
    isAttendee &&
    receipt.status === "claiming";

  function getMemberName(
    userId: string
  ) {
    return (
      event?.members.find(
        (member) =>
          member.id === userId
      )?.displayName ?? "Unknown"
    );
  }

  function initials(
    name: string
  ) {
    return (
      name.trim().charAt(0) || "?"
    ).toUpperCase();
  }

  async function handleToggleClaim(
    itemId: string,
    alreadyClaimed: boolean
  ) {
    if (!canInteract) {
      return;
    }

    setTogglingItemId(itemId);
    setActionError("");

    const error = alreadyClaimed
      ? await unclaimItem(itemId)
      : await claimItem(itemId);

    setTogglingItemId(null);

    if (error) {
      setActionError(error);
    }
  }

  async function handleSaveTaxTip() {
    if (!receipt) {
      return;
    }

    const taxInPence = Math.round(
      Math.max(
        0,
        Number(taxInput) || 0
      ) * 100
    );

    const tipInPence = Math.round(
      Math.max(
        0,
        Number(tipInput) || 0
      ) * 100
    );

    setSavingTaxTip(true);
    setActionError("");

    const error = await updateTaxTip(
      receipt.id,
      taxInPence,
      tipInPence
    );

    setSavingTaxTip(false);

    if (error) {
      setActionError(error);
    }
  }

  async function handleFinalize() {
    if (!receipt || !event) {
      return;
    }

    setFinalizing(true);
    setActionError("");

    let originalCurrency: string | null =
      null;
    let exchangeRate: number | null =
      null;

    if (
      receipt.currency !==
      event.primaryCurrency
    ) {
      try {
        exchangeRate =
          await fetchExchangeRate(
            receipt.currency,
            event.primaryCurrency
          );

        originalCurrency =
          receipt.currency;
      } catch (
        conversionError
      ) {
        setFinalizing(false);

        setActionError(
          conversionError instanceof
            Error
            ? conversionError.message
            : "Could not convert that currency."
        );

        return;
      }
    }

    const error =
      await finalizeReceipt(
        receipt.id,
        originalCurrency,
        exchangeRate
      );

    setFinalizing(false);

    if (error) {
      setActionError(error);
    }
  }

  async function handleCancel() {
    if (!receipt) {
      return;
    }

    setCancelling(true);
    setActionError("");

    const error = await cancelReceipt(
      receipt.id
    );

    setCancelling(false);

    if (error) {
      setActionError(error);
      return;
    }

    router.back();
  }

  const unclaimedCount =
    receipt.items.filter(
      (item) =>
        item.claimantIds.length ===
        0
    ).length;

  const itemSubtotal =
    receipt.items.reduce(
      (sum, item) =>
        sum + item.priceInPence,
      0
    );

  return (
    <ScreenContainer
      footer={
        isPurchaser &&
        receipt.status ===
          "claiming" ? (
          <Button
            label={
              unclaimedCount > 0
                ? `Finalize (${unclaimedCount} unclaimed)`
                : "Finalize"
            }
            onPress={handleFinalize}
            disabled={
              unclaimedCount > 0 ||
              finalizing
            }
            loading={finalizing}
          />
        ) : undefined
      }
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
        {getCategoryDisplayLabel(
          receipt.category,
          receipt.categoryCustomLabel
        )}
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
        Scanned by{" "}
        {getMemberName(
          receipt.purchaserId
        )}
        {" · "}
        {receipt.currency}
        {receipt.status !==
        "claiming"
          ? ` · ${receipt.status}`
          : ""}
      </Text>

      {!isAttendee ? (
        <View
          style={[
            styles.readOnlyNote,
            {
              backgroundColor:
                colors.surfaceSubtle,
            },
          ]}
        >
          <Ionicons
            name="eye-outline"
            size={14}
            color={
              colors.textSecondary
            }
          />

          <Text
            style={[
              styles.readOnlyNoteText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            You weren&apos;t marked
            as present at this one -
            you can watch, but only
            attendees can claim
            items.
          </Text>
        </View>
      ) : null}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Items
      </Text>

      {receipt.items.map((item) => {
        const claimedByMe =
          item.claimantIds.includes(
            currentUserId
          );

        const perPersonPence =
          item.claimantIds.length >
          0
            ? Math.round(
                item.priceInPence /
                  item.claimantIds
                    .length
              )
            : item.priceInPence;

        return (
          <Pressable
            key={item.id}
            onPress={() =>
              handleToggleClaim(
                item.id,
                claimedByMe
              )
            }
            disabled={
              !canInteract ||
              togglingItemId ===
                item.id
            }
          >
            <Card
              style={
                styles.itemCard
              }
              variant={
                claimedByMe
                  ? "success"
                  : "default"
              }
            >
              <View
                style={
                  styles.itemHeaderRow
                }
              >
                <Text
                  style={[
                    styles.itemName,
                    {
                      color:
                        colors.textPrimary,
                    },
                  ]}
                >
                  {item.quantity >
                  1
                    ? `${item.quantity}x `
                    : ""}
                  {item.name}
                </Text>

                {togglingItemId ===
                item.id ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      colors.primary
                    }
                  />
                ) : (
                  <Text
                    style={[
                      styles.itemPrice,
                      {
                        color:
                          colors.textPrimary,
                      },
                    ]}
                  >
                    {formatCurrencyFromPence(
                      item.priceInPence,
                      receipt.currency
                    )}
                  </Text>
                )}
              </View>

              {item.claimantIds
                .length > 0 ? (
                <Text
                  style={[
                    styles.itemClaimants,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  {item.claimantIds
                    .map(
                      (claimantId) =>
                        getMemberName(
                          claimantId
                        )
                    )
                    .join(", ")}
                  {item.claimantIds
                    .length > 1
                    ? ` (${formatCurrencyFromPence(
                        perPersonPence,
                        receipt.currency
                      )} each)`
                    : ""}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.itemClaimants,
                    {
                      color:
                        colors.textTertiary,
                    },
                  ]}
                >
                  {canInteract
                    ? "Tap if you had this"
                    : "Nobody's claimed this yet"}
                </Text>
              )}
            </Card>
          </Pressable>
        );
      })}

      <View
        style={[
          styles.summaryRow,
          {
            borderTopColor:
              colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.summaryLabel,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          Items subtotal
        </Text>

        <Text
          style={[
            styles.summaryValue,
            {
              color:
                colors.textPrimary,
            },
          ]}
        >
          {formatCurrencyFromPence(
            itemSubtotal,
            receipt.currency
          )}
        </Text>
      </View>

      {isPurchaser &&
      receipt.status ===
        "claiming" ? (
        <View
          style={
            styles.taxTipRow
          }
        >
          <View
            style={
              styles.taxTipField
            }
          >
            <Text
              style={[
                styles.taxTipLabel,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Tax
            </Text>

            <TextInput
              style={[
                styles.taxTipInput,
                {
                  borderColor:
                    colors.border,
                  backgroundColor:
                    colors.surface,
                  color:
                    colors.textPrimary,
                },
              ]}
              keyboardType="decimal-pad"
              keyboardAppearance={
                colorScheme
              }
              value={taxInput}
              onChangeText={
                setTaxInput
              }
              onBlur={
                handleSaveTaxTip
              }
            />
          </View>

          <View
            style={
              styles.taxTipField
            }
          >
            <Text
              style={[
                styles.taxTipLabel,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              Tip
            </Text>

            <TextInput
              style={[
                styles.taxTipInput,
                {
                  borderColor:
                    colors.border,
                  backgroundColor:
                    colors.surface,
                  color:
                    colors.textPrimary,
                },
              ]}
              keyboardType="decimal-pad"
              keyboardAppearance={
                colorScheme
              }
              value={tipInput}
              onChangeText={
                setTipInput
              }
              onBlur={
                handleSaveTaxTip
              }
            />
          </View>

          {savingTaxTip ? (
            <ActivityIndicator
              color={
                colors.primary
              }
            />
          ) : null}
        </View>
      ) : (
        <View
          style={styles.summaryRow}
        >
          <Text
            style={[
              styles.summaryLabel,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            Tax + tip
          </Text>

          <Text
            style={[
              styles.summaryValue,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {formatCurrencyFromPence(
              receipt.taxInPence +
                receipt.tipInPence,
              receipt.currency
            )}
          </Text>
        </View>
      )}

      {actionError ? (
        <Text
          style={[
            styles.errorText,
            {
              color:
                colors.dangerText,
            },
          ]}
        >
          {actionError}
        </Text>
      ) : null}

      {isPurchaser &&
      receipt.status ===
        "claiming" &&
      !showCancelConfirm ? (
        <Pressable
          style={[
            styles.dangerButton,
            {
              borderColor:
                colors.dangerBorder,
            },
          ]}
          onPress={() =>
            setShowCancelConfirm(
              true
            )
          }
        >
          <Text
            style={[
              styles.dangerButtonText,
              {
                color:
                  colors.dangerText,
              },
            ]}
          >
            Cancel This Receipt
          </Text>
        </Pressable>
      ) : null}

      {isPurchaser &&
      showCancelConfirm ? (
        <Card
          variant="danger"
          style={
            styles.confirmationCard
          }
        >
          <Text
            style={[
              styles.confirmationText,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            This throws away the
            scanned items and any
            claims so far. You can
            rescan afterwards.
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
                label="Keep It"
                variant="secondary"
                onPress={() =>
                  setShowCancelConfirm(
                    false
                  )
                }
                disabled={
                  cancelling
                }
              />
            </View>

            <View
              style={
                styles.actionButton
              }
            >
              <Button
                label="Cancel Receipt"
                variant="danger"
                onPress={
                  handleCancel
                }
                loading={
                  cancelling
                }
              />
            </View>
          </View>
        </Card>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

  readOnlyNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },

  readOnlyNoteText: {
    fontSize: FontSize.xs,
    flex: 1,
    lineHeight: 16,
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },

  itemCard: {
    marginBottom: Spacing.sm,
  },

  itemHeaderRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },

  itemName: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "600",
  },

  itemPrice: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  itemClaimants: {
    fontSize: FontSize.sm,
    marginTop: Spacing.xs,
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },

  summaryLabel: {
    fontSize: FontSize.base,
  },

  summaryValue: {
    fontSize: FontSize.base,
    fontWeight: "600",
  },

  taxTipRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },

  taxTipField: {
    flex: 1,
  },

  taxTipLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  taxTipInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.base,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },

  dangerButton: {
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
  },

  dangerButtonText: {
    fontSize: FontSize.md,
    fontWeight: "600",
  },

  confirmationCard: {
    marginTop: Spacing.xxl,
  },

  confirmationText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },

  confirmationActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  actionButton: {
    flex: 1,
  },
});
