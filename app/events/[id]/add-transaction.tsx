import { Ionicons } from "@expo/vector-icons";
import {
  router,
  useLocalSearchParams,
} from "expo-router";
import {
  useEffect,
  useRef,
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
import { CurrencyPicker } from "../../../components/ui/CurrencyPicker";
import {
  ScreenContainer,
  useScrollIntoView,
} from "../../../components/ui/ScreenContainer";
import { TextField } from "../../../components/ui/TextField";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import { useEvents } from "../../../context/EventContext";
import { useTheme } from "../../../context/ThemeContext";
import {
  fetchExchangeRate,
  formatCurrencyFromPence,
  getCurrencySymbol,
} from "../../../lib/currency";

export default function AddTransactionScreen() {
  const { colors, colorScheme } =
    useTheme();

  const scrollIntoView =
    useScrollIntoView();

  const amountInputRef =
    useRef<TextInput>(null);

  const descriptionInputRef =
    useRef<TextInput>(null);

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

  const [currency, setCurrency] =
    useState("");

  const [
    previewAmountInPence,
    setPreviewAmountInPence,
  ] = useState<number | null>(
    null
  );

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [
    previewError,
    setPreviewError,
  ] = useState("");

  const previewRequestIdRef =
    useRef(0);

  const previewTimerRef =
    useRef<ReturnType<
      typeof setTimeout
    > | null>(null);

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

      setDescription(
        editingTransaction.description
      );

      if (
        editingTransaction.originalCurrency &&
        editingTransaction.originalAmountInPence !=
          null
      ) {
        setCurrency(
          editingTransaction.originalCurrency
        );

        setAmount(
          (
            editingTransaction.originalAmountInPence /
            100
          ).toFixed(2)
        );
      } else {
        setCurrency(
          event?.primaryCurrency ??
            "GBP"
        );

        setAmount(
          (
            editingTransaction.amountInPence /
            100
          ).toFixed(2)
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction?.id]);

  useEffect(() => {
    if (
      !isEditing &&
      event &&
      !currency
    ) {
      setCurrency(
        event.primaryCurrency
      );
    }
  }, [isEditing, event, currency]);

  useEffect(() => {
    if (
      !event ||
      !currency ||
      currency ===
        event.primaryCurrency
    ) {
      setPreviewAmountInPence(
        null
      );
      setPreviewError("");
      setPreviewLoading(false);

      return;
    }

    const numericAmount =
      Number(amount);

    if (
      !amount ||
      numericAmount <= 0
    ) {
      setPreviewAmountInPence(
        null
      );
      setPreviewError("");
      setPreviewLoading(false);

      return;
    }

    if (previewTimerRef.current) {
      clearTimeout(
        previewTimerRef.current
      );
    }

    const requestId =
      ++previewRequestIdRef.current;

    setPreviewLoading(true);
    setPreviewError("");

    previewTimerRef.current =
      setTimeout(async () => {
        try {
          const rate =
            await fetchExchangeRate(
              currency,
              event.primaryCurrency
            );

          if (
            previewRequestIdRef.current !==
            requestId
          ) {
            return;
          }

          setPreviewAmountInPence(
            Math.round(
              numericAmount *
                rate *
                100
            )
          );

          setPreviewLoading(false);
        } catch (
          conversionError
        ) {
          if (
            previewRequestIdRef.current !==
            requestId
          ) {
            return;
          }

          setPreviewError(
            conversionError instanceof
              Error
              ? conversionError.message
              : "Could not fetch the exchange rate."
          );

          setPreviewAmountInPence(
            null
          );

          setPreviewLoading(false);
        }
      }, 400);

    return () => {
      if (
        previewTimerRef.current
      ) {
        clearTimeout(
          previewTimerRef.current
        );
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    amount,
    currency,
    event?.primaryCurrency,
  ]);

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
            numericAmount,
            currency,
            description.trim()
          )
        : await createTransaction(
            event.id,
            creditorId,
            numericAmount,
            currency,
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
    !loading &&
    !previewLoading;

  const quickCurrencies = Array.from(
    new Set([
      event.primaryCurrency,
      ...event.additionalCurrencies,
    ])
  );

  return (
    <ScreenContainer
      footer={
        <Button
          label={
            isEditing
              ? "Save Changes"
              : "Add Transaction"
          }
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={loading}
        />
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
        Converting
      </Text>

      <View
        style={
          styles.currencyPickerRow
        }
      >
        <CurrencyPicker
          label="From"
          value={
            currency ||
            event.primaryCurrency
          }
          onChange={setCurrency}
          quickCodes={
            quickCurrencies
          }
        />

        <Ionicons
          name="arrow-forward"
          size={18}
          color={
            colors.textTertiary
          }
          style={
            styles.currencyArrow
          }
        />

        <CurrencyPicker
          label="To"
          value={
            event.primaryCurrency
          }
          disabled
          helperText="This event's currency"
        />
      </View>

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
          {getCurrencySymbol(
            currency
          )}
        </Text>

        <TextInput
          ref={amountInputRef}
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
          returnKeyType="next"
          keyboardAppearance={
            colorScheme
          }
          value={amount}
          onChangeText={setAmount}
          onFocus={() =>
            scrollIntoView?.scrollToInput(
              amountInputRef
            )
          }
          onSubmitEditing={() =>
            descriptionInputRef.current?.focus()
          }
        />
      </View>

      {currency &&
      currency !==
        event.primaryCurrency ? (
        <Text
          style={[
            styles.conversionPreview,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          {previewLoading
            ? "Fetching exchange rate…"
            : previewError
              ? previewError
              : previewAmountInPence !==
                  null
                ? `≈ ${formatCurrencyFromPence(
                    previewAmountInPence,
                    event.primaryCurrency
                  )} in ${
                    event.primaryCurrency
                  }`
                : `Enter an amount to see it in ${event.primaryCurrency}`}
        </Text>
      ) : null}

      <TextField
        ref={descriptionInputRef}
        label="Description"
        placeholder="e.g. Taxi from airport"
        value={description}
        onChangeText={
          setDescription
        }
        maxLength={100}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSubmit) {
            handleSubmit();
          }
        }}
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

  currencyPickerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },

  currencyArrow: {
    marginTop: 34,
    marginHorizontal: Spacing.sm,
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

  conversionPreview: {
    fontSize: FontSize.sm,
    marginTop: -Spacing.md,
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
