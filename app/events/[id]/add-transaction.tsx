import {
  router,
  useLocalSearchParams,
} from "expo-router";
import {
  useEffect,
  useState,
} from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useAuth } from "../../../context/AuthContext";
import { useEvents } from "../../../context/EventContext";

export default function AddTransactionScreen() {
  const { id, transactionId } =
    useLocalSearchParams<{
      id: string;
      transactionId?: string;
    }>();

  const {
    session,
    profile,
  } = useAuth();

  const {
    events,
    createTransaction,
    editTransaction,
  } = useEvents();

  const event =
    events.find(
      (item) => item.id === id
    );

  const editingTransaction =
    transactionId
      ? event?.transactions.find(
          (transaction) =>
            transaction.id ===
            transactionId
        )
      : undefined;

  const isEditing = Boolean(
    transactionId
  );

  const [
    creditorId,
    setCreditorId,
  ] = useState("");

  const [amount, setAmount] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  useEffect(() => {
    if (editingTransaction) {
      setCreditorId(
        editingTransaction.creditorId
      );

      setAmount(
        (
          editingTransaction.amountInPence /
          100
        ).toFixed(2)
      );

      setDescription(
        editingTransaction.description
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction?.id]);

  async function handleSubmit() {
    if (
      !event ||
      !session ||
      !creditorId
    ) {
      return;
    }

    const numericAmount =
      Number(amount);

    if (
      numericAmount <= 0 ||
      !description.trim()
    ) {
      return;
    }

    setLoading(true);
    setError("");

    const transactionError =
      isEditing && transactionId
        ? await editTransaction(
            event.id,
            transactionId,
            creditorId,
            Math.round(
              numericAmount * 100
            ),
            description.trim()
          )
        : await createTransaction(
            event.id,
            creditorId,
            Math.round(
              numericAmount * 100
            ),
            description.trim()
          );

    setLoading(false);

    if (transactionError) {
      setError(
        transactionError
      );

      return;
    }

    router.back();
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

  const availableCreditors =
    event.members.filter(
      (member) =>
        member.id !==
        session?.user.id
    );

  const canSubmit =
    creditorId !== "" &&
    Number(amount) > 0 &&
    description.trim() !== "" &&
    !loading;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.content
        }
      >
        <Text style={styles.title}>
          {isEditing
            ? "Edit Transaction"
            : "Add Transaction"}
        </Text>

        <Text style={styles.intro}>
          You are{" "}
          {profile?.display_name}
        </Text>

        <Text style={styles.label}>
          Who do you owe?
        </Text>

        {availableCreditors.length ===
        0 ? (
          <Text
            style={styles.emptyText}
          >
            Add another registered
            member before creating a
            transaction.
          </Text>
        ) : (
          availableCreditors.map(
            (member) => (
              <Pressable
                key={member.id}
                style={[
                  styles.memberOption,
                  creditorId ===
                    member.id &&
                    styles.memberOptionSelected,
                ]}
                onPress={() =>
                  setCreditorId(
                    member.id
                  )
                }
              >
                <Text
                  style={[
                    styles.memberOptionText,
                    creditorId ===
                      member.id &&
                      styles.memberOptionTextSelected,
                  ]}
                >
                  {
                    member.displayName
                  }
                </Text>
              </Pressable>
            )
          )
        )}

        <Text style={styles.label}>
          Amount
        </Text>

        <View
          style={
            styles.amountContainer
          }
        >
          <Text
            style={
              styles.currencySymbol
            }
          >
            £
          </Text>

          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />
        </View>

        <Text style={styles.label}>
          Description
        </Text>

        <TextInput
          style={
            styles.descriptionInput
          }
          placeholder="e.g. Taxi from airport"
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={
            setDescription
          }
          maxLength={100}
        />

        {error ? (
          <Text
            style={styles.errorText}
          >
            {error}
          </Text>
        ) : null}

        <Pressable
          style={[
            styles.submitButton,
            !canSubmit &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          <Text
            style={
              styles.submitButtonText
            }
          >
            {loading
              ? "Saving..."
              : isEditing
                ? "Save Changes"
                : "Send for Confirmation"}
          </Text>
        </Pressable>
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
      padding: 24,
      paddingBottom: 50,
    },

    title: {
      fontSize: 30,
      fontWeight: "700",
      color: "#111827",
      marginBottom: 8,
    },

    intro: {
      fontSize: 15,
      color: "#6B7280",
      marginBottom: 22,
    },

    label: {
      fontSize: 15,
      fontWeight: "600",
      color: "#374151",
      marginTop: 18,
      marginBottom: 8,
    },

    emptyText: {
      fontSize: 15,
      color: "#9CA3AF",
    },

    memberOption: {
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },

    memberOptionSelected: {
      borderColor: "#111827",
      backgroundColor: "#F3F4F6",
    },

    memberOptionText: {
      fontSize: 16,
      color: "#374151",
    },

    memberOptionTextSelected: {
      color: "#111827",
      fontWeight: "600",
    },

    amountContainer: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      paddingHorizontal: 14,
    },

    currencySymbol: {
      fontSize: 20,
      color: "#111827",
      marginRight: 6,
    },

    amountInput: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 20,
      color: "#111827",
    },

    descriptionInput: {
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 12,
      padding: 14,
      fontSize: 16,
      color: "#111827",
    },

    errorText: {
      color: "#DC2626",
      fontSize: 14,
      marginTop: 16,
    },

    submitButton: {
      backgroundColor: "#111827",
      paddingVertical: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 30,
    },

    submitButtonDisabled: {
      opacity: 0.4,
    },

    submitButtonText: {
      color: "white",
      fontSize: 16,
      fontWeight: "600",
    },

    notFoundText: {
      fontSize: 16,
      color: "#6B7280",
    },
  });