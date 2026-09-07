import {
  createContext,
  ReactNode,
  RefObject,
  useContext,
  useRef,
} from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/theme";

type ScrollIntoViewContextValue = {
  scrollToInput: (
    inputRef: RefObject<TextInput | null>
  ) => void;
};

const ScrollIntoViewContext =
  createContext<ScrollIntoViewContextValue | null>(
    null
  );

/**
 * Lets a focused TextInput ask the nearest ScreenContainer's
 * ScrollView to bring it above the keyboard. KeyboardAvoidingView
 * alone only resizes the container - it doesn't scroll a
 * specific field into view, so a field lower on a tall form
 * still ends up hidden behind the keyboard without this.
 */
export function useScrollIntoView() {
  return useContext(
    ScrollIntoViewContext
  );
}

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /**
   * Rendered outside the ScrollView, pinned to the bottom of
   * the keyboard-avoided area - use for a primary action
   * button on a form so it's never left hidden behind the
   * keyboard or scrolled out of view, regardless of which
   * field is focused.
   */
  footer?: ReactNode;
};

export function ScreenContainer({
  children,
  scroll = true,
  centered = false,
  refreshing,
  onRefresh,
  footer,
}: ScreenContainerProps) {
  const { colors } = useTheme();

  const scrollViewRef =
    useRef<ScrollView>(null);

  function scrollToInput(
    inputRef: RefObject<TextInput | null>
  ) {
    const scrollNode =
      scrollViewRef.current;

    if (
      !scrollNode ||
      !inputRef.current
    ) {
      return;
    }

    // Let the keyboard's show animation start first, so the
    // ScrollView's visible area already reflects the space
    // KeyboardAvoidingView is about to reclaim.
    requestAnimationFrame(() => {
      inputRef.current?.measureLayout(
        scrollNode.getInnerViewNode(),
        (
          _x: number,
          y: number
        ) => {
          scrollNode.scrollTo({
            y: Math.max(
              y - Spacing.xl,
              0
            ),
            animated: true,
          });
        },
        () => {}
      );
    });
  }

  const content = (
    <View
      style={[
        styles.content,
        centered &&
          styles.centered,
      ]}
    >
      {children}
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        {
          backgroundColor:
            colors.background,
        },
      ]}
      edges={["top"]}
    >
      <KeyboardAvoidingView
        style={styles.flexFill}
        behavior={
          Platform.OS === "ios"
            ? "padding"
            : undefined
        }
      >
        <ScrollIntoViewContext.Provider
          value={{
            scrollToInput,
          }}
        >
          {scroll ? (
            <ScrollView
              ref={scrollViewRef}
              style={
                styles.flexFill
              }
              contentContainerStyle={[
                styles.scrollContent,
                centered &&
                  styles.centered,
              ]}
              keyboardShouldPersistTaps="handled"
              refreshControl={
                onRefresh ? (
                  <RefreshControl
                    refreshing={
                      refreshing ??
                      false
                    }
                    onRefresh={
                      onRefresh
                    }
                    tintColor={
                      colors.primary
                    }
                    colors={[
                      colors.primary,
                    ]}
                  />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          ) : (
            content
          )}
        </ScrollIntoViewContext.Provider>

        {footer ? (
          <View
            style={[
              styles.footer,
              {
                backgroundColor:
                  colors.background,
                borderTopColor:
                  colors.border,
              },
            ]}
          >
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  flexFill: {
    flex: 1,
  },

  content: {
    flex: 1,
    padding: Spacing.xl,
  },

  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl * 2,
    flexGrow: 1,
  },

  footer: {
    padding: Spacing.xl,
    borderTopWidth: 1,
  },

  centered: {
    justifyContent: "center",
  },
});
