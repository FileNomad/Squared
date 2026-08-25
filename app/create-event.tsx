import { router } from "expo-router";
import { useState } from "react";
import {
  StyleSheet,
  Text,
} from "react-native";

import { Button } from "../components/ui/Button";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Spacing,
} from "../constants/theme";
import { useTheme } from "../context/ThemeContext";
import { useEvents } from "../context/EventContext";

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

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function handleCreateEvent() {
    if (!name.trim()) {
      return;
    }

    setLoading(true);
    setError("");

    const newEvent =
      await createEvent(
        name.trim(),
        description.trim()
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

  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.lg,
  },
});
