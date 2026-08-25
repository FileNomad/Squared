import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  ReactNode,
  useCallback,
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

import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ScreenContainer } from "../../../components/ui/ScreenContainer";
import { StatusBadge } from "../../../components/ui/StatusBadge";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import {
  Transaction,
  useEvents,
} from "../../../context/EventContext";
import { useTheme } from "../../../context/ThemeContext";
import { calculatePairwiseBalances } from "../../../lib/balances";

export default function EventDetailsScreen() {
  const { colors } = useTheme();

  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const {
    session,
    profile,
  } = useAuth();

  const {
    events,
    refreshing,
    refreshEvents,
    addMember,
    confirmTransaction,
    rejectTransaction,
    markTransactionPaid,
    confirmSettlement,
    rejectSettlement,
    forceResolveTransaction,
    cancelTransaction,
    deleteEvent,
    leaveEvent,
    removeMember,
  } = useEvents();

  const [
    memberName,
    setMemberName,
  ] = useState("");

  const [
    memberError,
    setMemberError,
  ] = useState("");

  const [
    addingMember,
    setAddingMember,
  ] = useState(false);

  const [
    showDeleteConfirmation,
    setShowDeleteConfirmation,
  ] = useState(false);

  const [
    deletingEvent,
    setDeletingEvent,
  ] = useState(false);

  const [
    deleteError,
    setDeleteError,
  ] = useState("");

  const [
    cancelConfirmingId,
    setCancelConfirmingId,
  ] = useState<string | null>(
    null
  );

  const [
    cancellingId,
    setCancellingId,
  ] = useState<string | null>(
    null
  );

  const [
    cancelError,
    setCancelError,
  ] = useState("");

  const [
    showLeaveConfirmation,
    setShowLeaveConfirmation,
  ] = useState(false);

  const [
    leavingEvent,
    setLeavingEvent,
  ] = useState(false);

  const [
    leaveError,
    setLeaveError,
  ] = useState("");

  const [
    removeConfirmingId,
    setRemoveConfirmingId,
  ] = useState<string | null>(
    null
  );

  const [
    removingId,
    setRemovingId,
  ] = useState<string | null>(
    null
  );

  const [
    removeError,
    setRemoveError,
  ] = useState("");

  useFocusEffect(
    useCallback(() => {
      refreshEvents();

      return undefined;
    }, [refreshEvents])
  );

  const event =
    events.find(
      (item) => item.id === id
    );

  async function handleRefresh() {
    await refreshEvents(true);
  }

  async function handleAddMember() {
    if (!event) {
      return;
    }

    const trimmedName =
      memberName.trim();

    if (!trimmedName) {
      return;
    }

    setAddingMember(true);
    setMemberError("");

    const error =
      await addMember(
        event.id,
        trimmedName
      );

    setAddingMember(false);

    if (error) {
      setMemberError(error);
      return;
    }

    setMemberName("");
  }

  function handleDeleteEventPress() {
    setDeleteError("");
    setShowDeleteConfirmation(true);
  }

  function handleCancelDelete() {
    setShowDeleteConfirmation(false);
    setDeleteError("");
  }

  async function handleConfirmDelete() {
    if (!event) {
      return;
    }

    setDeletingEvent(true);
    setDeleteError("");

    const deleteErrorMessage =
      await deleteEvent(event.id);

    if (deleteErrorMessage) {
      setDeletingEvent(false);
      setDeleteError(
        deleteErrorMessage
      );
      return;
    }

    router.replace("/");
  }

  function handleCancelPress(
    transactionId: string
  ) {
    setCancelError("");
    setCancelConfirmingId(
      transactionId
    );
  }

  function handleCancelDismiss() {
    setCancelConfirmingId(null);
    setCancelError("");
  }

  async function handleCancelConfirm(
    transactionId: string
  ) {
    if (!event) {
      return;
    }

    setCancellingId(
      transactionId
    );
    setCancelError("");

    const error =
      await cancelTransaction(
        event.id,
        transactionId
      );

    setCancellingId(null);

    if (error) {
      setCancelError(error);
      return;
    }

    setCancelConfirmingId(null);
  }

  function handleEditPress(
    transaction: Transaction
  ) {
    if (!event) {
      return;
    }

    router.push({
      pathname:
        "/events/[id]/add-transaction",

      params: {
        id: event.id,
        transactionId:
          transaction.id,
      },
    });
  }

  function handleLeavePress() {
    setLeaveError("");
    setShowLeaveConfirmation(
      true
    );
  }

  function handleLeaveDismiss() {
    setShowLeaveConfirmation(
      false
    );
    setLeaveError("");
  }

  async function handleLeaveConfirm() {
    if (!event) {
      return;
    }

    setLeavingEvent(true);
    setLeaveError("");

    const error =
      await leaveEvent(event.id);

    if (error) {
      setLeavingEvent(false);
      setLeaveError(error);
      return;
    }

    router.replace("/");
  }

  function handleRemovePress(
    memberId: string
  ) {
    setRemoveError("");
    setRemoveConfirmingId(
      memberId
    );
  }

  function handleRemoveDismiss() {
    setRemoveConfirmingId(null);
    setRemoveError("");
  }

  async function handleRemoveConfirm(
    memberId: string
  ) {
    if (!event) {
      return;
    }

    setRemovingId(memberId);
    setRemoveError("");

    const error =
      await removeMember(
        event.id,
        memberId
      );

    setRemovingId(null);

    if (error) {
      setRemoveError(error);
      return;
    }

    setRemoveConfirmingId(null);
  }

  if (!event) {
    return (
      <ScreenContainer centered>
        <Text
          style={{
            color:
              colors.textSecondary,
            fontSize: FontSize.md,
          }}
        >
          Event not found.
        </Text>
      </ScreenContainer>
    );
  }

  const currentUserId =
    session?.user.id ?? "";

  const isCreator =
    event.createdBy ===
    currentUserId;

  const pendingTransactions =
    event.transactions.filter(
      (transaction) =>
        transaction.status ===
        "pending"
    );

  const activeTransactions =
    event.transactions.filter(
      (transaction) =>
        transaction.status ===
          "confirmed" ||
        transaction.status ===
          "payment_pending"
    );

  const settledTransactions =
    event.transactions.filter(
      (transaction) =>
        transaction.status ===
        "settled"
    );

  const declinedTransactions =
    event.transactions.filter(
      (transaction) =>
        transaction.status ===
          "rejected" ||
        transaction.status ===
          "cancelled"
    );

  function formatDate(
    dateString: string
  ) {
    return new Date(
      dateString
    ).toLocaleDateString(
      "en-GB",
      {
        day: "numeric",
        month: "short",
        year: "numeric",
      }
    );
  }

  function getMemberName(
    memberId: string
  ) {
    if (!event) {
      return "Unknown";
    }

    return (
      event.members.find(
        (member) =>
          member.id === memberId
      )?.displayName ??
      "Unknown"
    );
  }

  function initials(name: string) {
    return (
      name.trim().charAt(0) || "?"
    ).toUpperCase();
  }

  function isMemberActive(
    memberId: string
  ) {
    if (!event) {
      return false;
    }

    return event.members.some(
      (member) =>
        member.id === memberId
    );
  }

  function getBlockingMemberId(
    transaction: Transaction
  ) {
    if (
      transaction.status ===
      "pending"
    ) {
      return transaction.creditorId;
    }

    if (
      transaction.status ===
      "confirmed"
    ) {
      return transaction.debtorId;
    }

    if (
      transaction.status ===
      "payment_pending"
    ) {
      return transaction.creditorId;
    }

    return null;
  }

  function renderResolveIfStuck(
    transaction: Transaction
  ) {
    if (!isCreator) {
      return null;
    }

    const blockingId =
      getBlockingMemberId(
        transaction
      );

    if (
      !blockingId ||
      isMemberActive(blockingId)
    ) {
      return null;
    }

    return (
      <View
        style={[
          styles.resolveContainer,
          {
            backgroundColor:
              colors.warningBg,
            borderColor:
              colors.warningBorder,
          },
        ]}
      >
        <Text
          style={[
            styles.resolveHint,
            {
              color:
                colors.warningText,
            },
          ]}
        >
          This member&apos;s account
          was deleted, so this
          can&apos;t be confirmed
          normally. As the event
          creator, you can resolve
          it manually.
        </Text>

        <Pressable
          style={[
            styles.resolveButton,
            {
              backgroundColor:
                colors.warningText,
            },
          ]}
          onPress={() => {
            if (!event) {
              return;
            }

            forceResolveTransaction(
              event.id,
              transaction.id
            );
          }}
        >
          <Text
            style={
              styles.resolveButtonText
            }
          >
            Resolve
          </Text>
        </Pressable>
      </View>
    );
  }

  const balances =
    calculatePairwiseBalances(
      event.transactions
    );

  const outstandingBalances =
    Object.entries(
      balances
    ).filter(
      ([, balance]) =>
        balance !== 0
    );

  function TransactionCardShell({
    transaction,
    verb,
    children,
  }: {
    transaction: Transaction;
    verb: string;
    children?: ReactNode;
  }) {
    return (
      <Card
        style={
          styles.transactionCard
        }
      >
        <View
          style={
            styles.transactionHeaderRow
          }
        >
          <Text
            style={[
              styles.transactionSummary,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {transaction.debtorName}{" "}
            {verb}{" "}
            {transaction.creditorName}{" "}
            £
            {(
              transaction.amountInPence /
              100
            ).toFixed(2)}
          </Text>

          <StatusBadge
            status={
              transaction.status
            }
          />
        </View>

        <Text
          style={[
            styles.transactionDescription,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          {transaction.description}
        </Text>

        <Text
          style={[
            styles.transactionDate,
            {
              color:
                colors.textTertiary,
            },
          ]}
        >
          {formatDate(
            transaction.createdAt
          )}
        </Text>

        {children}
      </Card>
    );
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      <View style={styles.titleRow}>
        <View
          style={
            styles.titleContainer
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
            {event.name}
          </Text>

          {event.description ? (
            <Text
              style={[
                styles.description,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {event.description}
            </Text>
          ) : null}
        </View>
      </View>

      <Text
        style={[
          styles.signedInText,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Signed in as{" "}
        {profile?.display_name}
      </Text>

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Members
      </Text>

      {event.members.map(
        (member) => (
          <Card
            key={member.id}
            style={styles.memberCard}
          >
            <View
              style={
                styles.memberHeaderRow
              }
            >
              <View
                style={
                  styles.memberIdentity
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
                    {initials(
                      member.displayName
                    )}
                  </Text>
                </View>

                <Text
                  style={[
                    styles.memberName,
                    {
                      color:
                        colors.textPrimary,
                    },
                  ]}
                >
                  {
                    member.displayName
                  }

                  {member.id ===
                  currentUserId
                    ? " (You)"
                    : ""}
                </Text>
              </View>

              {isCreator &&
              member.id !==
                currentUserId &&
              removeConfirmingId !==
                member.id ? (
                <Pressable
                  onPress={() =>
                    handleRemovePress(
                      member.id
                    )
                  }
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={
                      colors.dangerText
                    }
                  />
                </Pressable>
              ) : null}
            </View>

            {removeConfirmingId ===
            member.id ? (
              <View
                style={[
                  styles.inlineConfirmBox,
                  {
                    backgroundColor:
                      colors.dangerBg,
                    borderColor:
                      colors.dangerBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.inlineConfirmText,
                    {
                      color:
                        colors.dangerTextStrong,
                    },
                  ]}
                >
                  Remove{" "}
                  {
                    member.displayName
                  }{" "}
                  from this event?
                </Text>

                {removeError ? (
                  <Text
                    style={[
                      styles.errorText,
                      {
                        color:
                          colors.dangerText,
                      },
                    ]}
                  >
                    {removeError}
                  </Text>
                ) : null}

                <View
                  style={
                    styles.inlineConfirmActions
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
                        handleRemoveDismiss
                      }
                      disabled={
                        removingId ===
                        member.id
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <Button
                      label="Remove"
                      variant="danger"
                      onPress={() =>
                        handleRemoveConfirm(
                          member.id
                        )
                      }
                      loading={
                        removingId ===
                        member.id
                      }
                    />
                  </View>
                </View>
              </View>
            ) : null}
          </Card>
        )
      )}

      {isCreator ? (
        <>
          <View
            style={
              styles.memberRow
            }
          >
            <TextInput
              style={[
                styles.memberInput,
                {
                  borderColor:
                    colors.border,
                  backgroundColor:
                    colors.surface,
                  color:
                    colors.textPrimary,
                },
              ]}
              placeholder="Registered user's display name"
              placeholderTextColor={
                colors.textTertiary
              }
              value={memberName}
              onChangeText={
                setMemberName
              }
            />

            <Pressable
              style={[
                styles.addMemberButton,
                {
                  backgroundColor:
                    colors.primary,
                },
                addingMember && {
                  opacity: 0.6,
                },
              ]}
              onPress={
                handleAddMember
              }
              disabled={
                addingMember
              }
            >
              {addingMember ? (
                <ActivityIndicator
                  color={
                    colors.onPrimary
                  }
                />
              ) : (
                <Ionicons
                  name="person-add-outline"
                  size={18}
                  color={
                    colors.onPrimary
                  }
                />
              )}
            </Pressable>
          </View>

          {memberError ? (
            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.dangerText,
                },
              ]}
            >
              {memberError}
            </Text>
          ) : null}
        </>
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
        Pending
      </Text>

      {pendingTransactions.length ===
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
          No pending transactions.
        </Text>
      ) : (
        pendingTransactions.map(
          (transaction) => (
            <TransactionCardShell
              key={transaction.id}
              transaction={
                transaction
              }
              verb="owes"
            >
              {currentUserId ===
              transaction.creditorId ? (
                <View
                  style={
                    styles.actionRow
                  }
                >
                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <Button
                      label="Confirm"
                      icon="checkmark"
                      onPress={() =>
                        confirmTransaction(
                          event.id,
                          transaction.id
                        )
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <Button
                      label="Reject"
                      variant="secondary"
                      icon="close"
                      onPress={() =>
                        rejectTransaction(
                          event.id,
                          transaction.id
                        )
                      }
                    />
                  </View>
                </View>
              ) : currentUserId ===
                transaction.debtorId ? (
                cancelConfirmingId ===
                transaction.id ? (
                  <View
                    style={[
                      styles.inlineConfirmBox,
                      {
                        backgroundColor:
                          colors.dangerBg,
                        borderColor:
                          colors.dangerBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.inlineConfirmText,
                        {
                          color:
                            colors.dangerTextStrong,
                        },
                      ]}
                    >
                      Cancel this
                      transaction?
                    </Text>

                    {cancelError ? (
                      <Text
                        style={[
                          styles.errorText,
                          {
                            color:
                              colors.dangerText,
                          },
                        ]}
                      >
                        {
                          cancelError
                        }
                      </Text>
                    ) : null}

                    <View
                      style={
                        styles.inlineConfirmActions
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
                          onPress={
                            handleCancelDismiss
                          }
                          disabled={
                            cancellingId ===
                            transaction.id
                          }
                        />
                      </View>

                      <View
                        style={
                          styles.actionButton
                        }
                      >
                        <Button
                          label="Cancel It"
                          variant="danger"
                          onPress={() =>
                            handleCancelConfirm(
                              transaction.id
                            )
                          }
                          loading={
                            cancellingId ===
                            transaction.id
                          }
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <View
                    style={
                      styles.actionRow
                    }
                  >
                    <View
                      style={
                        styles.actionButton
                      }
                    >
                      <Button
                        label="Edit"
                        variant="secondary"
                        icon="create-outline"
                        onPress={() =>
                          handleEditPress(
                            transaction
                          )
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.actionButton
                      }
                    >
                      <Button
                        label="Cancel"
                        variant="secondary"
                        icon="close"
                        onPress={() =>
                          handleCancelPress(
                            transaction.id
                          )
                        }
                      />
                    </View>
                  </View>
                )
              ) : (
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Waiting for{" "}
                  {
                    transaction.creditorName
                  }
                </Text>
              )}

              {renderResolveIfStuck(
                transaction
              )}
            </TransactionCardShell>
          )
        )
      )}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Transactions
      </Text>

      {activeTransactions.length ===
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
          No confirmed transactions
          yet.
        </Text>
      ) : (
        activeTransactions.map(
          (transaction) => (
            <TransactionCardShell
              key={transaction.id}
              transaction={
                transaction
              }
              verb="owes"
            >
              {transaction.status ===
                "confirmed" &&
              currentUserId ===
                transaction.debtorId ? (
                <Button
                  label="Mark as Paid"
                  icon="cash-outline"
                  onPress={() =>
                    markTransactionPaid(
                      event.id,
                      transaction.id
                    )
                  }
                />
              ) : null}

              {transaction.status ===
                "payment_pending" &&
              currentUserId ===
                transaction.debtorId ? (
                <Text
                  style={[
                    styles.statusText,
                    {
                      color:
                        colors.textSecondary,
                    },
                  ]}
                >
                  Waiting for{" "}
                  {
                    transaction.creditorName
                  }{" "}
                  to confirm payment
                </Text>
              ) : null}

              {transaction.status ===
                "payment_pending" &&
              currentUserId ===
                transaction.creditorId ? (
                <>
                  <Text
                    style={[
                      styles.paymentNotice,
                      {
                        color:
                          colors.textPrimary,
                      },
                    ]}
                  >
                    {
                      transaction.debtorName
                    }{" "}
                    says this has been
                    paid.
                  </Text>

                  <View
                    style={
                      styles.actionRow
                    }
                  >
                    <View
                      style={
                        styles.actionButton
                      }
                    >
                      <Button
                        label="Confirm"
                        icon="checkmark-done"
                        onPress={() =>
                          confirmSettlement(
                            event.id,
                            transaction.id
                          )
                        }
                      />
                    </View>

                    <View
                      style={
                        styles.actionButton
                      }
                    >
                      <Button
                        label="Not Received"
                        variant="secondary"
                        icon="close"
                        onPress={() =>
                          rejectSettlement(
                            event.id,
                            transaction.id
                          )
                        }
                      />
                    </View>
                  </View>
                </>
              ) : null}

              {renderResolveIfStuck(
                transaction
              )}
            </TransactionCardShell>
          )
        )
      )}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Net Balance
      </Text>

      {outstandingBalances.length ===
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
          No outstanding balance.
        </Text>
      ) : (
        outstandingBalances.map(
          ([pair, balance]) => {
            const [
              firstId,
              secondId,
            ] = pair.split("|");

            const debtorId =
              balance > 0
                ? firstId
                : secondId;

            const creditorId =
              balance > 0
                ? secondId
                : firstId;

            return (
              <Text
                key={pair}
                style={[
                  styles.balanceText,
                  {
                    color:
                      colors.textPrimary,
                  },
                ]}
              >
                {getMemberName(
                  debtorId
                )}{" "}
                owes{" "}
                {getMemberName(
                  creditorId
                )}{" "}
                £
                {(
                  Math.abs(
                    balance
                  ) / 100
                ).toFixed(2)}
              </Text>
            );
          }
        )
      )}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Settled
      </Text>

      {settledTransactions.length ===
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
          No settled transactions
          yet.
        </Text>
      ) : (
        settledTransactions.map(
          (transaction) => (
            <TransactionCardShell
              key={transaction.id}
              transaction={
                transaction
              }
              verb="paid"
            />
          )
        )
      )}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Declined
      </Text>

      {declinedTransactions.length ===
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
          No declined transactions.
        </Text>
      ) : (
        declinedTransactions.map(
          (transaction) => (
            <TransactionCardShell
              key={transaction.id}
              transaction={
                transaction
              }
              verb="owes"
            >
              <Text
                style={[
                  styles.declinedByText,
                  {
                    color:
                      colors.textTertiary,
                  },
                ]}
              >
                {transaction.status ===
                "cancelled"
                  ? `Cancelled by ${transaction.debtorName}`
                  : `Rejected by ${transaction.creditorName}`}
              </Text>
            </TransactionCardShell>
          )
        )
      )}

      {event.members.length >= 2 ? (
        <View
          style={
            styles.addTransactionSpacing
          }
        >
          <Button
            label="Add Transaction"
            icon="add"
            onPress={() =>
              router.push({
                pathname:
                  "/events/[id]/add-transaction",

                params: {
                  id: event.id,
                },
              })
            }
          />
        </View>
      ) : null}

      {isCreator &&
      !showDeleteConfirmation ? (
        <Pressable
          style={[
            styles.dangerButton,
            {
              borderColor:
                colors.dangerBorder,
            },
          ]}
          onPress={
            handleDeleteEventPress
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
            Delete Event
          </Text>
        </Pressable>
      ) : null}

      {isCreator &&
      showDeleteConfirmation ? (
        <Card
          variant="danger"
          style={
            styles.confirmationCard
          }
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
            Delete &quot;
            {event.name}&quot;?
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
            the event and all of its
            transactions for every
            member. This cannot be
            undone.
          </Text>

          {deleteError ? (
            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.dangerText,
                },
              ]}
            >
              {deleteError}
            </Text>
          ) : null}

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
                  handleCancelDelete
                }
                disabled={
                  deletingEvent
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
                  handleConfirmDelete
                }
                loading={
                  deletingEvent
                }
              />
            </View>
          </View>
        </Card>
      ) : null}

      {!isCreator &&
      !showLeaveConfirmation ? (
        <Pressable
          style={[
            styles.dangerButton,
            {
              borderColor:
                colors.dangerBorder,
            },
          ]}
          onPress={
            handleLeavePress
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
            Leave Event
          </Text>
        </Pressable>
      ) : null}

      {!isCreator &&
      showLeaveConfirmation ? (
        <Card
          variant="danger"
          style={
            styles.confirmationCard
          }
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
            Leave &quot;
            {event.name}&quot;?
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
            You&apos;ll lose access
            to this event and its
            transaction history. The
            event stays intact for
            everyone else.
          </Text>

          {leaveError ? (
            <Text
              style={[
                styles.errorText,
                {
                  color:
                    colors.dangerText,
                },
              ]}
            >
              {leaveError}
            </Text>
          ) : null}

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
                  handleLeaveDismiss
                }
                disabled={
                  leavingEvent
                }
              />
            </View>

            <View
              style={
                styles.actionButton
              }
            >
              <Button
                label="Yes, Leave"
                variant="danger"
                onPress={
                  handleLeaveConfirm
                }
                loading={
                  leavingEvent
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
  titleRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
    gap: Spacing.lg,
  },

  titleContainer: {
    flex: 1,
  },

  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  description: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
    lineHeight: 23,
  },

  signedInText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  emptyText: {
    fontSize: FontSize.base,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  memberCard: {
    marginBottom: Spacing.sm,
  },

  memberHeaderRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },

  memberIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  avatar: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: "700",
  },

  memberName: {
    fontSize: FontSize.md,
    fontWeight: "500",
  },

  inlineConfirmBox: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },

  inlineConfirmText: {
    fontSize: FontSize.base,
    lineHeight: 20,
  },

  inlineConfirmActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  actionButton: {
    flex: 1,
  },

  memberRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  memberInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    fontSize: FontSize.base,
  },

  addMemberButton: {
    width: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg,
  },

  transactionCard: {
    marginBottom: Spacing.sm,
  },

  transactionHeaderRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },

  transactionSummary: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  transactionDescription: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  transactionDate: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },

  statusText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.md,
  },

  paymentNotice: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginTop: Spacing.md,
  },

  declinedByText: {
    fontSize: FontSize.xs,
    fontWeight: "600",
    marginTop: Spacing.md,
  },

  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },

  resolveContainer: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },

  resolveHint: {
    fontSize: FontSize.sm,
    lineHeight: 18,
  },

  resolveButton: {
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
    marginTop: Spacing.sm,
  },

  resolveButtonText: {
    color: "white",
    fontWeight: "600",
  },

  balanceText: {
    fontSize: FontSize.lg,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },

  addTransactionSpacing: {
    marginTop: Spacing.xl,
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
