import { router } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Chip } from "../components/ui/Chip";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Spacing,
} from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useEvents } from "../context/EventContext";
import { COMMON_CURRENCIES } from "../lib/currency";

export default function CreateEventScreen() {
  const { colors } = useTheme();

  const { createEvent } =
    useEvents();

  const [name, setName] =
    useState("");

  const [
    description,
    setDescription,
  ] = useState("");

  const [
    primaryCurrency,
    setPrimaryCurrency,
  ] = useState("GBP");

  const [
    additionalCurrencies,
    setAdditionalCurrencies,
  ] = useState<string[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  function handleSelectPrimary(
    code: string
  ) {
    setPrimaryCurrency(code);

    setAdditionalCurrencies(
      (current) =>
        current.filter(
          (existing) =>
            existing !== code
        )
    );
  }

  function handleToggleAdditional(
    code: string
  ) {
    setAdditionalCurrencies(
      (current) =>
        current.includes(code)
          ? current.filter(
              (existing) =>
                existing !== code
            )
          : [...current, code]
    );
  }

  async function handleCreateEvent() {
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    const newEvent =
      await createEvent(
        name.trim(),
        description.trim(),
        primaryCurrency,
        additionalCurrencies
      );

    setLoading(false);

    if (!newEvent) {
      setError(
        "Could not create the event."
      );

      return;
    }

    router.replace({
      pathname:
        "/events/[id]",
      params: {
        id: newEvent.id,
      },
    });
  }

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
        Create Event
      </Text>

      <TextField
        label="Event name"
        placeholder="e.g. Barcelona Holiday"
        value={name}
        onChangeText={setName}
      />

      <TextField
        label="Description"
        placeholder="What's the event for?"
        value={description}
        onChangeText={
          setDescription
        }
        multiline
        maxLength={200}
        style={
          styles.descriptionInput
        }
      />

      <Text
        style={[
          styles.characterCount,
          {
            color:
              colors.textTertiary,
          },
        ]}
      >
        {description.length}/200
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
        Primary currency
      </Text>

      <Text
        style={[
          styles.hint,
          {
            color:
              colors.textTertiary,
          },
        ]}
      >
        Enter the currency
        you&apos;d like everything
        converted to, usually
        whatever you use back home.
        This can&apos;t be changed
        once the event is created.
      </Text>

      <View style={styles.chipRow}>
        {COMMON_CURRENCIES.map(
          (currency) => (
            <Chip
              key={currency.code}
              label={currency.code}
              selected={
                primaryCurrency ===
                currency.code
              }
              onPress={() =>
                handleSelectPrimary(
                  currency.code
                )
              }
            />
          )
        )}
      </View>

      <Text
        style={[
          styles.label,
          styles.additionalLabel,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Additional currencies
        (optional)
      </Text>

      <Text
        style={[
          styles.hint,
          {
            color:
              colors.textTertiary,
          },
        ]}
      >
        These show up as quick
        options when adding a
        transaction, useful for a
        trip spanning more than one
        country.
      </Text>

      <View style={styles.chipRow}>
        {COMMON_CURRENCIES.filter(
          (currency) =>
            currency.code !==
            primaryCurrency
        ).map((currency) => (
          <Chip
            key={currency.code}
            label={currency.code}
            selected={additionalCurrencies.includes(
              currency.code
            )}
            onPress={() =>
              handleToggleAdditional(
                currency.code
              )
            }
          />
        ))}
      </View>

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
        label="Create Event"
        onPress={
          handleCreateEvent
        }
        disabled={!name.trim()}
        loading={loading}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
    marginBottom: Spacing.xl,
  },

  descriptionInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  characterCount: {
    fontSize: FontSize.xs,
    textAlign: "right",
    marginTop: -Spacing.sm,
    marginBottom: Spacing.xl,
  },

  label: {
    fontSize: FontSize.base,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  additionalLabel: {
    marginTop: Spacing.lg,
  },

  hint: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
});
