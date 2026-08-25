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
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "../../../components/ui/Button";
import { ScreenContainer } from "../../../components/ui/ScreenContainer";
import { TextField } from "../../../components/ui/TextField";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import { useEvents } from "../../../context/EventContext";
import { useTheme } from "../../../context/ThemeContext";

export default function AddTransactionScreen() {
  const { colors } = useTheme();

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
        {isEditing
          ? "Edit Transaction"
          : "Add Transaction"}
      </Text>

      <Text
        style={[
          styles.intro,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        You are{" "}
        {profile?.display_name}
      </Text>

      <Text
        style={[
          styles.label,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Who do you owe?
      </Text>

      {availableCreditors.length ===
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
          Add another registered
          member before creating a
          transaction.
        </Text>
      ) : (
        availableCreditors.map(
          (member) => {
            const selected =
              creditorId ===
              member.id;

            return (
              <Pressable
                key={member.id}
                style={[
                  styles.memberOption,
                  {
                    borderColor:
                      selected
                        ? colors.primary
                        : colors.border,
                    backgroundColor:
                      selected
                        ? colors.surfaceSubtle
                        : colors.surface,
                  },
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
                    {
                      color: selected
                        ? colors.textPrimary
                        : colors.textSecondary,
                      fontWeight:
                        selected
                          ? "600"
                          : "400",
                    },
                  ]}
                >
                  {
                    member.displayName
                  }
                </Text>

                <Ionicons
                  name={
                    selected
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={20}
                  color={
                    selected
                      ? colors.primary
                      : colors.textTertiary
                  }
                />
              </Pressable>
            );
          }
        )
      )}

      <Text
        style={[
          styles.label,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Amount
      </Text>

      <View
        style={[
          styles.amountContainer,
          {
            borderColor:
              colors.border,
            backgroundColor:
              colors.surface,
          },
        ]}
      >
        <Text
          style={[
            styles.currencySymbol,
            {
              color:
                colors.textPrimary,
            },
          ]}
        >
          £
        </Text>

        <TextInput
          style={[
            styles.amountInput,
            {
              color:
                colors.textPrimary,
            },
          ]}
          placeholder="0.00"
          placeholderTextColor={
            colors.textTertiary
          }
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
        />
      </View>

      <TextField
        label="Description"
        placeholder="e.g. Taxi from airport"
        value={description}
        onChangeText={
          setDescription
        }
        maxLength={100}
        style={
          styles.descriptionSpacing
        }
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

      <Button
        label={
          isEditing
            ? "Save Changes"
            : "Send for Confirmation"
        }
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={loading}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  intro: {
    fontSize: FontSize.base,
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: FontSize.base,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  emptyText: {
    fontSize: FontSize.base,
  },

  memberOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },

  memberOptionText: {
    fontSize: FontSize.md,
  },

  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },

  currencySymbol: {
    fontSize: FontSize.xl,
    marginRight: Spacing.sm,
  },

  amountInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.xl,
  },

  descriptionSpacing: {
    marginTop: Spacing.md,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
});
