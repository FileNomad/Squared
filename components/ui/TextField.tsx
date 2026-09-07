import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  useRef,
  useState,
} from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from "react-native";

import { useTheme } from "../../context/ThemeContext";
import {
  FontSize,
  Radius,
  Spacing,
} from "../../constants/theme";
import { useScrollIntoView } from "./ScreenContainer";

type TextFieldProps = TextInputProps & {
  label?: string;
  error?: string;
  secureToggle?: boolean;
};

export const TextField = forwardRef<
  TextInput,
  TextFieldProps
>(function TextField(
  {
    label,
    error,
    secureToggle = false,
    secureTextEntry,
    style,
    onFocus,
    ...inputProps
  },
  forwardedRef
) {
  const { colors, colorScheme } =
    useTheme();

  const scrollIntoView =
    useScrollIntoView();

  const inputRef =
    useRef<TextInput>(null);

  function setRefs(
    node: TextInput | null
  ) {
    inputRef.current = node;

    if (
      typeof forwardedRef ===
      "function"
    ) {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }

  const [
    revealed,
    setRevealed,
  ] = useState(false);

  const isSecure =
    secureToggle && !revealed
      ? true
      : secureToggle
        ? false
        : secureTextEntry;

  return (
    <View
      style={styles.container}
    >
      {label ? (
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
      ) : null}

      <View
        style={[
          styles.inputRow,
          {
            borderColor: error
              ? colors.dangerBorder
              : colors.border,
            backgroundColor:
              colors.surface,
          },
        ]}
      >
        <TextInput
          ref={setRefs}
          style={[
            styles.input,
            {
              color:
                colors.textPrimary,
            },
            style,
          ]}
          placeholderTextColor={
            colors.textTertiary
          }
          secureTextEntry={
            isSecure
          }
          keyboardAppearance={
            colorScheme
          }
          onFocus={(event) => {
            scrollIntoView?.scrollToInput(
              inputRef
            );

            onFocus?.(event);
          }}
          {...inputProps}
        />

        {secureToggle ? (
          <Pressable
            onPress={() =>
              setRevealed(
                (current) =>
                  !current
              )
            }
            style={
              styles.toggleButton
            }
          >
            <Ionicons
              name={
                revealed
                  ? "eye-off-outline"
                  : "eye-outline"
              }
              size={20}
              color={
                colors.textSecondary
              }
            />
          </Pressable>
        ) : null}
      </View>

      {error ? (
        <Text
          style={[
            styles.error,
            {
              color:
                colors.dangerText,
            },
          ]}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },

  label: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
  },

  input: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    fontSize: FontSize.md,
  },

  toggleButton: {
    paddingHorizontal: Spacing.md,
  },

  error: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
});
