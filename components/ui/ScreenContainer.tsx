import { ReactNode } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "../../context/ThemeContext";
import { Spacing } from "../../constants/theme";

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  centered?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export function ScreenContainer({
  children,
  scroll = true,
  centered = false,
  refreshing,
  onRefresh,
}: ScreenContainerProps) {
  const { colors } = useTheme();

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
      {scroll ? (
        <ScrollView
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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

  centered: {
    justifyContent: "center",
  },
});
