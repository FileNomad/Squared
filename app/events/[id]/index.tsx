import {
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../../context/AuthContext";
import {
  Transaction,
  useEvents,
} from "../../../context/EventContext";
import { calculatePairwiseBalances } from "../../../lib/balances";

export default function EventDetailsScreen() {
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
      <View
        style={styles.container}
      >
        <Text
          style={
            styles.notFoundText
          }
        >
          Event not found.
        </Text>
      </View>
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
        style={
          styles.resolveContainer
        }
      >
        <Text
          style={
            styles.resolveHint
          }
        >
          This member&apos;s account
          was deleted, so this
          can&apos;t be confirmed
          normally. As the event
          creator, you can resolve
          it manually.
        </Text>

        <Pressable
          style={
            styles.resolveButton
          }
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

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={styles.titleRow}
        >
          <View
            style={
              styles.titleContainer
            }
          >
            <Text
              style={styles.title}
            >
              {event.name}
            </Text>

            {event.description ? (
              <Text
                style={
                  styles.description
                }
              >
                {event.description}
              </Text>
            ) : null}
          </View>

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
          style={
            styles.signedInText
          }
        >
          Signed in as{" "}
          {profile?.display_name}
        </Text>

        <Text
          style={
            styles.sectionTitle
          }
        >
          Members
        </Text>

        {event.members.map(
          (member) => (
            <View
              key={member.id}
              style={
                styles.memberCard
              }
            >
              <View
                style={
                  styles.memberHeaderRow
                }
              >
                <Text
                  style={
                    styles.memberName
                  }
                >
                  {
                    member.displayName
                  }

                  {member.id ===
                  currentUserId
                    ? " (You)"
                    : ""}
                </Text>

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
                  >
                    <Text
                      style={
                        styles.removeMemberText
                      }
                    >
                      Remove
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {removeConfirmingId ===
              member.id ? (
                <View
                  style={
                    styles.inlineConfirmBox
                  }
                >
                  <Text
                    style={
                      styles.inlineConfirmText
                    }
                  >
                    Remove{" "}
                    {
                      member.displayName
                    }{" "}
                    from this event?
                  </Text>

                  {removeError ? (
                    <Text
                      style={
                        styles.errorText
                      }
                    >
                      {removeError}
                    </Text>
                  ) : null}

                  <View
                    style={
                      styles.inlineConfirmActions
                    }
                  >
                    <Pressable
                      style={
                        styles.cancelButton
                      }
                      onPress={
                        handleRemoveDismiss
                      }
                      disabled={
                        removingId ===
                        member.id
                      }
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
                        removingId ===
                          member.id &&
                          styles.disabledButton,
                      ]}
                      onPress={() =>
                        handleRemoveConfirm(
                          member.id
                        )
                      }
                      disabled={
                        removingId ===
                        member.id
                      }
                    >
                      {removingId ===
                      member.id ? (
                        <ActivityIndicator
                          color="white"
                        />
                      ) : (
                        <Text
                          style={
                            styles.confirmDeleteButtonText
                          }
                        >
                          Remove
                        </Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
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
                style={
                  styles.memberInput
                }
                placeholder="Registered user's display name"
                placeholderTextColor="#9CA3AF"
                value={memberName}
                onChangeText={
                  setMemberName
                }
              />

              <Pressable
                style={
                  styles.addMemberButton
                }
                onPress={
                  handleAddMember
                }
                disabled={
                  addingMember
                }
              >
                <Text
                  style={
                    styles.addMemberButtonText
                  }
                >
                  {addingMember
                    ? "..."
                    : "Add"}
                </Text>
              </Pressable>
            </View>

            {memberError ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {memberError}
              </Text>
            ) : null}
          </>
        ) : null}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Pending
        </Text>

        {pendingTransactions.length ===
        0 ? (
          <Text
            style={styles.emptyText}
          >
            No pending transactions.
          </Text>
        ) : (
          pendingTransactions.map(
            (transaction) => (
              <View
                key={
                  transaction.id
                }
                style={
                  styles.transactionCard
                }
              >
                <Text
                  style={
                    styles.transactionSummary
                  }
                >
                  {
                    transaction.debtorName
                  }{" "}
                  owes{" "}
                  {
                    transaction.creditorName
                  }{" "}
                  £
                  {(
                    transaction.amountInPence /
                    100
                  ).toFixed(2)}
                </Text>

                <Text
                  style={
                    styles.transactionDescription
                  }
                >
                  {
                    transaction.description
                  }
                </Text>

                <Text
                  style={
                    styles.transactionDate
                  }
                >
                  {formatDate(
                    transaction.createdAt
                  )}
                </Text>

                {currentUserId ===
                transaction.creditorId ? (
                  <View
                    style={
                      styles.actionRow
                    }
                  >
                    <Pressable
                      style={
                        styles.primaryButton
                      }
                      onPress={() =>
                        confirmTransaction(
                          event.id,
                          transaction.id
                        )
                      }
                    >
                      <Text
                        style={
                          styles.primaryButtonText
                        }
                      >
                        Confirm
                      </Text>
                    </Pressable>

                    <Pressable
                      style={
                        styles.rejectButton
                      }
                      onPress={() =>
                        rejectTransaction(
                          event.id,
                          transaction.id
                        )
                      }
                    >
                      <Text
                        style={
                          styles.rejectButtonText
                        }
                      >
                        Reject
                      </Text>
                    </Pressable>
                  </View>
                ) : currentUserId ===
                  transaction.debtorId ? (
                  cancelConfirmingId ===
                  transaction.id ? (
                    <View
                      style={
                        styles.inlineConfirmBox
                      }
                    >
                      <Text
                        style={
                          styles.inlineConfirmText
                        }
                      >
                        Cancel this
                        transaction?
                      </Text>

                      {cancelError ? (
                        <Text
                          style={
                            styles.errorText
                          }
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
                        <Pressable
                          style={
                            styles.cancelButton
                          }
                          onPress={
                            handleCancelDismiss
                          }
                          disabled={
                            cancellingId ===
                            transaction.id
                          }
                        >
                          <Text
                            style={
                              styles.cancelButtonText
                            }
                          >
                            Keep It
                          </Text>
                        </Pressable>

                        <Pressable
                          style={[
                            styles.confirmDeleteButton,
                            cancellingId ===
                              transaction.id &&
                              styles.disabledButton,
                          ]}
                          onPress={() =>
                            handleCancelConfirm(
                              transaction.id
                            )
                          }
                          disabled={
                            cancellingId ===
                            transaction.id
                          }
                        >
                          {cancellingId ===
                          transaction.id ? (
                            <ActivityIndicator
                              color="white"
                            />
                          ) : (
                            <Text
                              style={
                                styles.confirmDeleteButtonText
                              }
                            >
                              Cancel
                              Transaction
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View
                      style={
                        styles.actionRow
                      }
                    >
                      <Pressable
                        style={
                          styles.primaryButton
                        }
                        onPress={() =>
                          handleEditPress(
                            transaction
                          )
                        }
                      >
                        <Text
                          style={
                            styles.primaryButtonText
                          }
                        >
                          Edit
                        </Text>
                      </Pressable>

                      <Pressable
                        style={
                          styles.rejectButton
                        }
                        onPress={() =>
                          handleCancelPress(
                            transaction.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.rejectButtonText
                          }
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  )
                ) : (
                  <Text
                    style={
                      styles.statusText
                    }
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
              </View>
            )
          )
        )}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Transactions
        </Text>

        {activeTransactions.length ===
        0 ? (
          <Text
            style={styles.emptyText}
          >
            No confirmed transactions
            yet.
          </Text>
        ) : (
          activeTransactions.map(
            (transaction) => (
              <View
                key={
                  transaction.id
                }
                style={
                  styles.transactionCard
                }
              >
                <Text
                  style={
                    styles.transactionSummary
                  }
                >
                  {
                    transaction.debtorName
                  }{" "}
                  owes{" "}
                  {
                    transaction.creditorName
                  }{" "}
                  £
                  {(
                    transaction.amountInPence /
                    100
                  ).toFixed(2)}
                </Text>

                <Text
                  style={
                    styles.transactionDescription
                  }
                >
                  {
                    transaction.description
                  }
                </Text>

                <Text
                  style={
                    styles.transactionDate
                  }
                >
                  {formatDate(
                    transaction.createdAt
                  )}
                </Text>

                {transaction.status ===
                  "confirmed" &&
                currentUserId ===
                  transaction.debtorId ? (
                  <Pressable
                    style={
                      styles.markPaidButton
                    }
                    onPress={() =>
                      markTransactionPaid(
                        event.id,
                        transaction.id
                      )
                    }
                  >
                    <Text
                      style={
                        styles.markPaidButtonText
                      }
                    >
                      Mark as Paid
                    </Text>
                  </Pressable>
                ) : null}

                {transaction.status ===
                  "payment_pending" &&
                currentUserId ===
                  transaction.debtorId ? (
                  <Text
                    style={
                      styles.statusText
                    }
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
                      style={
                        styles.paymentNotice
                      }
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
                      <Pressable
                        style={
                          styles.primaryButton
                        }
                        onPress={() =>
                          confirmSettlement(
                            event.id,
                            transaction.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.primaryButtonText
                          }
                        >
                          Confirm Payment
                        </Text>
                      </Pressable>

                      <Pressable
                        style={
                          styles.rejectButton
                        }
                        onPress={() =>
                          rejectSettlement(
                            event.id,
                            transaction.id
                          )
                        }
                      >
                        <Text
                          style={
                            styles.rejectButtonText
                          }
                        >
                          Not Received
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : null}

                {renderResolveIfStuck(
                  transaction
                )}
              </View>
            )
          )
        )}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Net Balance
        </Text>

        {outstandingBalances.length ===
        0 ? (
          <Text
            style={styles.emptyText}
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
                  style={
                    styles.balanceText
                  }
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
          style={
            styles.sectionTitle
          }
        >
          Settled
        </Text>

        {settledTransactions.length ===
        0 ? (
          <Text
            style={styles.emptyText}
          >
            No settled transactions
            yet.
          </Text>
        ) : (
          settledTransactions.map(
            (transaction) => (
              <View
                key={
                  transaction.id
                }
                style={
                  styles.settledCard
                }
              >
                <Text
                  style={
                    styles.transactionSummary
                  }
                >
                  {
                    transaction.debtorName
                  }{" "}
                  paid{" "}
                  {
                    transaction.creditorName
                  }{" "}
                  £
                  {(
                    transaction.amountInPence /
                    100
                  ).toFixed(2)}
                </Text>

                <Text
                  style={
                    styles.transactionDescription
                  }
                >
                  {
                    transaction.description
                  }
                </Text>

                <Text
                  style={
                    styles.transactionDate
                  }
                >
                  {formatDate(
                    transaction.createdAt
                  )}
                </Text>

                <Text
                  style={
                    styles.settledText
                  }
                >
                  Settled
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
          Declined
        </Text>

        {declinedTransactions.length ===
        0 ? (
          <Text
            style={styles.emptyText}
          >
            No declined transactions.
          </Text>
        ) : (
          declinedTransactions.map(
            (transaction) => (
              <View
                key={
                  transaction.id
                }
                style={
                  styles.settledCard
                }
              >
                <Text
                  style={
                    styles.transactionSummary
                  }
                >
                  {
                    transaction.debtorName
                  }{" "}
                  owes{" "}
                  {
                    transaction.creditorName
                  }{" "}
                  £
                  {(
                    transaction.amountInPence /
                    100
                  ).toFixed(2)}
                </Text>

                <Text
                  style={
                    styles.transactionDescription
                  }
                >
                  {
                    transaction.description
                  }
                </Text>

                <Text
                  style={
                    styles.transactionDate
                  }
                >
                  {formatDate(
                    transaction.createdAt
                  )}
                </Text>

                <Text
                  style={
                    styles.settledText
                  }
                >
                  {transaction.status ===
                  "cancelled"
                    ? `Cancelled by ${transaction.debtorName}`
                    : `Rejected by ${transaction.creditorName}`}
                </Text>
              </View>
            )
          )
        )}

        {event.members.length >= 2 ? (
          <Pressable
            style={
              styles.transactionButton
            }
            onPress={() =>
              router.push({
                pathname:
                  "/events/[id]/add-transaction",

                params: {
                  id: event.id,
                },
              })
            }
          >
            <Text
              style={
                styles.transactionButtonText
              }
            >
              + Add Transaction
            </Text>
          </Pressable>
        ) : null}

        {isCreator &&
        !showDeleteConfirmation ? (
          <Pressable
            style={
              styles.deleteButton
            }
            onPress={
              handleDeleteEventPress
            }
          >
            <Text
              style={
                styles.deleteButtonText
              }
            >
              Delete Event
            </Text>
          </Pressable>
        ) : null}

        {isCreator &&
        showDeleteConfirmation ? (
          <View
            style={
              styles.deleteConfirmationBox
            }
          >
            <Text
              style={
                styles.deleteConfirmationTitle
              }
            >
              Delete &quot;
              {event.name}&quot;?
            </Text>

            <Text
              style={
                styles.deleteConfirmationText
              }
            >
              This permanently deletes
              the event and all of its
              transactions for every
              member. This cannot be
              undone.
            </Text>

            {deleteError ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {deleteError}
              </Text>
            ) : null}

            <View
              style={
                styles.deleteConfirmationActions
              }
            >
              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={
                  handleCancelDelete
                }
                disabled={
                  deletingEvent
                }
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
                  deletingEvent &&
                    styles.disabledButton,
                ]}
                onPress={
                  handleConfirmDelete
                }
                disabled={
                  deletingEvent
                }
              >
                {deletingEvent ? (
                  <ActivityIndicator
                    color="white"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmDeleteButtonText
                    }
                  >
                    Yes, Delete Event
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}

        {!isCreator &&
        !showLeaveConfirmation ? (
          <Pressable
            style={
              styles.deleteButton
            }
            onPress={
              handleLeavePress
            }
          >
            <Text
              style={
                styles.deleteButtonText
              }
            >
              Leave Event
            </Text>
          </Pressable>
        ) : null}

        {!isCreator &&
        showLeaveConfirmation ? (
          <View
            style={
              styles.deleteConfirmationBox
            }
          >
            <Text
              style={
                styles.deleteConfirmationTitle
              }
            >
              Leave &quot;
              {event.name}&quot;?
            </Text>

            <Text
              style={
                styles.deleteConfirmationText
              }
            >
              You&apos;ll lose access
              to this event and its
              transaction history. The
              event stays intact for
              everyone else.
            </Text>

            {leaveError ? (
              <Text
                style={
                  styles.errorText
                }
              >
                {leaveError}
              </Text>
            ) : null}

            <View
              style={
                styles.deleteConfirmationActions
              }
            >
              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={
                  handleLeaveDismiss
                }
                disabled={
                  leavingEvent
                }
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
                  leavingEvent &&
                    styles.disabledButton,
                ]}
                onPress={
                  handleLeaveConfirm
                }
                disabled={
                  leavingEvent
                }
              >
                {leavingEvent ? (
                  <ActivityIndicator
                    color="white"
                  />
                ) : (
                  <Text
                    style={
                      styles.confirmDeleteButtonText
                    }
                  >
                    Yes, Leave Event
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
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

    titleRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-start",
      gap: 16,
    },

    titleContainer: {
      flex: 1,
    },

    title: {
      fontSize: 30,
      fontWeight: "700",
      color: "#111827",
    },

    description: {
      fontSize: 16,
      color: "#6B7280",
      marginTop: 10,
      lineHeight: 23,
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

    signedInText: {
      fontSize: 14,
      color: "#6B7280",
      marginTop: 14,
    },

    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: "#111827",
      marginTop: 32,
      marginBottom: 12,
    },

    emptyText: {
      fontSize: 15,
      color: "#9CA3AF",
    },

    errorText: {
      color: "#DC2626",
      fontSize: 14,
      marginTop: 8,
    },

    memberCard: {
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },

    memberName: {
      fontSize: 16,
      fontWeight: "500",
      color: "#111827",
    },

    memberHeaderRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      gap: 10,
    },

    removeMemberText: {
      fontSize: 13,
      fontWeight: "600",
      color: "#DC2626",
    },

    inlineConfirmBox: {
      marginTop: 12,
      borderWidth: 1,
      borderColor: "#FCA5A5",
      borderRadius: 10,
      padding: 12,
      backgroundColor: "#FEF2F2",
    },

    inlineConfirmText: {
      fontSize: 14,
      color: "#7F1D1D",
      lineHeight: 20,
    },

    inlineConfirmActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 12,
    },

    memberRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    memberInput: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      padding: 14,
    },

    addMemberButton: {
      backgroundColor: "#111827",
      paddingHorizontal: 20,
      justifyContent: "center",
      borderRadius: 12,
    },

    addMemberButtonText: {
      color: "white",
      fontWeight: "600",
    },

    transactionCard: {
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#E5E7EB",
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
    },

    settledCard: {
      backgroundColor: "#F9FAFB",
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      padding: 16,
      marginBottom: 10,
      opacity: 0.75,
    },

    transactionSummary: {
      fontSize: 16,
      fontWeight: "700",
      color: "#111827",
    },

    transactionDescription: {
      fontSize: 14,
      color: "#6B7280",
      marginTop: 6,
    },

    transactionDate: {
      fontSize: 13,
      color: "#9CA3AF",
      marginTop: 4,
    },

    statusText: {
      fontSize: 13,
      color: "#6B7280",
      marginTop: 12,
    },

    paymentNotice: {
      fontSize: 14,
      color: "#374151",
      fontWeight: "600",
      marginTop: 12,
    },

    settledText: {
      fontSize: 13,
      color: "#6B7280",
      fontWeight: "600",
      marginTop: 10,
    },

    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },

    primaryButton: {
      flex: 1,
      backgroundColor: "#111827",
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    primaryButtonText: {
      color: "white",
      fontWeight: "600",
    },

    rejectButton: {
      flex: 1,
      borderWidth: 1,
      borderColor: "#DC2626",
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
    },

    rejectButtonText: {
      color: "#DC2626",
      fontWeight: "600",
    },

    resolveContainer: {
      marginTop: 14,
      borderWidth: 1,
      borderColor: "#FCD34D",
      backgroundColor: "#FFFBEB",
      borderRadius: 10,
      padding: 12,
    },

    resolveHint: {
      fontSize: 13,
      color: "#92400E",
      lineHeight: 18,
    },

    resolveButton: {
      backgroundColor: "#92400E",
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 10,
    },

    resolveButtonText: {
      color: "white",
      fontWeight: "600",
    },

    markPaidButton: {
      backgroundColor: "#111827",
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      marginTop: 14,
    },

    markPaidButtonText: {
      color: "white",
      fontWeight: "600",
    },

    balanceText: {
      fontSize: 18,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 8,
    },

    transactionButton: {
      backgroundColor: "#111827",
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 24,
    },

    transactionButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },

    deleteButton: {
      marginTop: 40,
      paddingVertical: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#DC2626",
      alignItems: "center",
    },

    deleteButtonText: {
      color: "#DC2626",
      fontSize: 16,
      fontWeight: "600",
    },

    deleteConfirmationBox: {
      marginTop: 40,
      borderWidth: 1,
      borderColor: "#FCA5A5",
      borderRadius: 12,
      padding: 16,
      backgroundColor: "#FEF2F2",
    },

    deleteConfirmationTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: "#991B1B",
    },

    deleteConfirmationText: {
      fontSize: 14,
      color: "#7F1D1D",
      lineHeight: 20,
      marginTop: 8,
    },

    deleteConfirmationActions: {
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

    disabledButton: {
      opacity: 0.45,
    },

    notFoundText: {
      fontSize: 16,
      color: "#6B7280",
    },
  });