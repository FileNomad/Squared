import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../constants/theme";
import {
  COMMON_CURRENCIES,
  getCurrencyName,
} from "../../lib/currency";

type CurrencyPickerProps = {
  label: string;
  value: string;
  onChange?: (code: string) => void;
  quickCodes?: string[];
  disabled?: boolean;
  helperText?: string;
};

export function CurrencyPicker({
  label,
  value,
  onChange,
  quickCodes = [],
  disabled = false,
  helperText,
}: CurrencyPickerProps) {
  const { colors, colorScheme } =
    useTheme();

  const [
    modalVisible,
    setModalVisible,
  ] = useState(false);

  const [query, setQuery] =
    useState("");

  const normalizedQuery = query
    .trim()
    .toLowerCase();

  const filteredCurrencies =
    useMemo(() => {
      if (!normalizedQuery) {
        return COMMON_CURRENCIES;
      }

      return COMMON_CURRENCIES.filter(
        (currency) =>
          currency.code
            .toLowerCase()
            .includes(
              normalizedQuery
            ) ||
          currency.name
            .toLowerCase()
            .includes(
              normalizedQuery
            )
      );
    }, [normalizedQuery]);

  const quickCurrencies =
    COMMON_CURRENCIES.filter(
      (currency) =>
        quickCodes.includes(
          currency.code
        )
    );

  function openPicker() {
    if (disabled) {
      return;
    }

    setQuery("");
    setModalVisible(true);
  }

  function handleSelect(
    code: string
  ) {
    onChange?.(code);
    setModalVisible(false);
  }

  function CurrencyRow({
    code,
  }: {
    code: string;
  }) {
    const selected =
      code === value;

    return (
      <Pressable
        style={[
          styles.row,
          {
            backgroundColor:
              selected
                ? colors.surfaceSubtle
                : "transparent",
          },
        ]}
        onPress={() =>
          handleSelect(code)
        }
      >
        <View
          style={
            styles.rowTextContainer
          }
        >
          <Text
            style={[
              styles.rowCode,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {code}
          </Text>

          <Text
            style={[
              styles.rowName,
              {
                color:
                  colors.textSecondary,
              },
            ]}
          >
            {getCurrencyName(code)}
          </Text>
        </View>

        {selected ? (
          <Ionicons
            name="checkmark"
            size={20}
            color={colors.primary}
          />
        ) : null}
      </Pressable>
    );
  }

  return (
    <View
      style={styles.container}
    >
      <Text
        style={[
          styles.label,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        {label}
      </Text>

      <Pressable
        style={[
          styles.field,
          {
            borderColor:
              colors.border,
            backgroundColor:
              colors.surface,
            opacity: disabled
              ? 0.6
              : 1,
          },
        ]}
        onPress={openPicker}
      >
        <View
          style={
            styles.fieldTextContainer
          }
        >
          <Text
            style={[
              styles.fieldCode,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {value}
          </Text>

          <Text
            style={[
              styles.fieldName,
              {
                color:
                  colors.textTertiary,
              },
            ]}
            numberOfLines={1}
          >
            {getCurrencyName(
              value
            )}
          </Text>
        </View>

        <Ionicons
          name={
            disabled
              ? "lock-closed-outline"
              : "chevron-down"
          }
          size={18}
          color={
            colors.textSecondary
          }
        />
      </Pressable>

      {helperText ? (
        <Text
          style={[
            styles.helperText,
            {
              color:
                colors.textTertiary,
            },
          ]}
        >
          {helperText}
        </Text>
      ) : null}

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalVisible(false)
        }
      >
        <Pressable
          style={[
            styles.backdrop,
            {
              backgroundColor:
                colors.overlay,
            },
          ]}
          onPress={() =>
            setModalVisible(false)
          }
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor:
                  colors.background,
              },
            ]}
            onPress={(event) =>
              event.stopPropagation()
            }
          >
            <View
              style={
                styles.sheetHeader
              }
            >
              <Text
                style={[
                  styles.sheetTitle,
                  {
                    color:
                      colors.textPrimary,
                  },
                ]}
              >
                Select currency
              </Text>

              <Pressable
                onPress={() =>
                  setModalVisible(
                    false
                  )
                }
                hitSlop={8}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color={
                    colors.textSecondary
                  }
                />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.searchInput,
                {
                  borderColor:
                    colors.border,
                  backgroundColor:
                    colors.surface,
                  color:
                    colors.textPrimary,
                },
              ]}
              placeholder="Search by code or name"
              placeholderTextColor={
                colors.textTertiary
              }
              keyboardAppearance={
                colorScheme
              }
              value={query}
              onChangeText={setQuery}
              autoFocus
            />

            <ScrollView
              style={
                styles.list
              }
              keyboardShouldPersistTaps="handled"
            >
              {!normalizedQuery &&
              quickCurrencies.length >
                0 ? (
                <>
                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color:
                          colors.textTertiary,
                      },
                    ]}
                  >
                    This event
                  </Text>

                  {quickCurrencies.map(
                    (currency) => (
                      <CurrencyRow
                        key={
                          currency.code
                        }
                        code={
                          currency.code
                        }
                      />
                    )
                  )}

                  <Text
                    style={[
                      styles.sectionLabel,
                      {
                        color:
                          colors.textTertiary,
                      },
                    ]}
                  >
                    All currencies
                  </Text>
                </>
              ) : null}

              {filteredCurrencies.length ===
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
                  No currencies match
                  that search.
                </Text>
              ) : (
                filteredCurrencies.map(
                  (currency) => (
                    <CurrencyRow
                      key={
                        currency.code
                      }
                      code={
                        currency.code
                      }
                    />
                  )
                )
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  field: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },

  fieldTextContainer: {
    flex: 1,
  },

  fieldCode: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  fieldName: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },

  helperText: {
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },

  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
  },

  sheet: {
    maxHeight: "75%",
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl,
  },

  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    marginBottom: Spacing.lg,
  },

  sheetTitle: {
    fontSize: FontSize.lg,
    fontWeight: "700",
  },

  searchInput: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: FontSize.base,
    marginBottom: Spacing.md,
  },

  list: {
    marginBottom: Spacing.md,
  },

  sectionLabel: {
    fontSize: FontSize.xs,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },

  rowTextContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.sm,
  },

  rowCode: {
    fontSize: FontSize.md,
    fontWeight: "700",
  },

  rowName: {
    fontSize: FontSize.sm,
  },

  emptyText: {
    fontSize: FontSize.base,
    paddingVertical: Spacing.lg,
  },
});
