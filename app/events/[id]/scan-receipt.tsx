import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  router,
  useLocalSearchParams,
} from "expo-router";
import { useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../../../components/ui/Button";
import { Chip } from "../../../components/ui/Chip";
import { CurrencyPicker } from "../../../components/ui/CurrencyPicker";
import { ScreenContainer } from "../../../components/ui/ScreenContainer";
import { TextField } from "../../../components/ui/TextField";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../../constants/theme";
import { useAuth } from "../../../context/AuthContext";
import { useEvents } from "../../../context/EventContext";
import { useReceipt } from "../../../context/ReceiptContext";
import { useTheme } from "../../../context/ThemeContext";
import {
  TRANSACTION_CATEGORIES,
  TransactionCategory,
} from "../../../lib/categories";

export default function ScanReceiptScreen() {
  const { colors } = useTheme();

  const { id } =
    useLocalSearchParams<{
      id: string;
    }>();

  const { session } = useAuth();

  const { events } = useEvents();

  const { scanReceipt, scanning } =
    useReceipt();

  const event = events.find(
    (item) => item.id === id
  );

  const [currency, setCurrency] =
    useState(
      event?.primaryCurrency ??
        "GBP"
    );

  const [category, setCategory] =
    useState<
      TransactionCategory | ""
    >("");

  const [
    categoryCustomLabel,
    setCategoryCustomLabel,
  ] = useState("");

  const [
    selectedAttendeeIds,
    setSelectedAttendeeIds,
  ] = useState<Set<string>>(
    new Set(
      session
        ? [session.user.id]
        : []
    )
  );

  const [photo, setPhoto] =
    useState<{
      uri: string;
      base64: string;
    } | null>(null);

  const [error, setError] =
    useState("");

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

  const quickCurrencies = Array.from(
    new Set([
      event.primaryCurrency,
      ...event.additionalCurrencies,
    ])
  );

  function toggleAttendee(
    memberId: string
  ) {
    if (
      memberId === session?.user.id
    ) {
      return;
    }

    setSelectedAttendeeIds(
      (current) => {
        const next = new Set(
          current
        );

        if (next.has(memberId)) {
          next.delete(memberId);
        } else {
          next.add(memberId);
        }

        return next;
      }
    );
  }

  async function pickImage(
    source: "camera" | "library"
  ) {
    setError("");

    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setError(
        source === "camera"
          ? "Camera access is needed to scan a receipt."
          : "Photo library access is needed to pick a receipt photo."
      );

      return;
    }

    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(
            {
              base64: true,
              quality: 0.7,
            }
          )
        : await ImagePicker.launchImageLibraryAsync(
            {
              base64: true,
              quality: 0.7,
              mediaTypes: [
                "images",
              ],
            }
          );

    if (
      result.canceled ||
      !result.assets?.[0]?.base64
    ) {
      return;
    }

    setPhoto({
      uri: result.assets[0].uri,
      base64:
        result.assets[0].base64,
    });
  }

  async function handleSubmit() {
    if (
      !event ||
      !photo ||
      !category
    ) {
      return;
    }

    if (
      category === "other" &&
      !categoryCustomLabel.trim()
    ) {
      return;
    }

    setError("");

    const {
      receiptId,
      error: scanError,
    } = await scanReceipt({
      eventId: event.id,
      currency,
      category,

      categoryCustomLabel:
        category === "other"
          ? categoryCustomLabel.trim()
          : null,

      attendeeIds: Array.from(
        selectedAttendeeIds
      ),

      imageBase64: photo.base64,
      imageMediaType: "image/jpeg",
    });

    if (scanError || !receiptId) {
      setError(
        scanError ??
          "Could not scan that receipt."
      );

      return;
    }

    router.replace({
      pathname:
        "/events/[id]/receipts/[receiptId]",

      params: {
        id: event.id,
        receiptId,
      },
    });
  }

  const canSubmit =
    !!photo &&
    category !== "" &&
    (category !== "other" ||
      categoryCustomLabel.trim() !==
        "") &&
    selectedAttendeeIds.size > 0 &&
    !scanning;

  return (
    <ScreenContainer
      footer={
        <Button
          label="Scan Receipt"
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={scanning}
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
        Scan a Receipt
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
        A photo of the receipt gets
        broken into items so
        everyone can pick what they
        ordered.
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
        Currency
      </Text>

      <CurrencyPicker
        label="Receipt currency"
        value={currency}
        onChange={setCurrency}
        quickCodes={
          quickCurrencies
        }
      />

      <Text
        style={[
          styles.label,
          styles.sectionSpacing,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Category
      </Text>

      <View style={styles.chipRow}>
        {TRANSACTION_CATEGORIES.map(
          (item) => (
            <Chip
              key={item.value}
              label={item.label}
              selected={
                category ===
                item.value
              }
              onPress={() =>
                setCategory(
                  item.value
                )
              }
            />
          )
        )}
      </View>

      {category === "other" ? (
        <TextField
          label="What's it for?"
          placeholder="e.g. Museum tickets"
          value={
            categoryCustomLabel
          }
          onChangeText={
            setCategoryCustomLabel
          }
          maxLength={40}
        />
      ) : null}

      <Text
        style={[
          styles.label,
          styles.sectionSpacing,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Who was there?
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
        Only the people you pick can
        select what they ordered.
      </Text>

      {event.members.map(
        (member) => {
          const isSelf =
            member.id ===
            session?.user.id;

          const selected =
            selectedAttendeeIds.has(
              member.id
            );

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
                  opacity: isSelf
                    ? 0.7
                    : 1,
                },
              ]}
              onPress={() =>
                toggleAttendee(
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
                {isSelf
                  ? " (You)"
                  : ""}
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
      )}

      <Text
        style={[
          styles.label,
          styles.sectionSpacing,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Photo
      </Text>

      {photo ? (
        <Image
          source={{
            uri: photo.uri,
          }}
          style={styles.preview}
          resizeMode="cover"
        />
      ) : null}

      <View
        style={styles.photoButtonRow}
      >
        <View
          style={
            styles.photoButton
          }
        >
          <Button
            label={
              photo
                ? "Retake Photo"
                : "Take Photo"
            }
            variant="secondary"
            icon="camera-outline"
            onPress={() =>
              pickImage("camera")
            }
          />
        </View>

        <View
          style={
            styles.photoButton
          }
        >
          <Button
            label="Choose Photo"
            variant="secondary"
            icon="image-outline"
            onPress={() =>
              pickImage("library")
            }
          />
        </View>
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

  sectionSpacing: {
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
    marginBottom: Spacing.lg,
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

  preview: {
    width: "100%",
    height: 220,
    borderRadius: Radius.lg,
    marginBottom: Spacing.md,
  },

  photoButtonRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  photoButton: {
    flex: 1,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
  },
});
