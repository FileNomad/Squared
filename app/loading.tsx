import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";

import { useTheme } from "../context/ThemeContext";

/*
 * Shown only for the brief window right after sign-in
 * where we know there's a session but haven't yet checked
 * whether a profile exists for it. See AuthContext's
 * `profile: Profile | null | undefined` - undefined means
 * "not checked yet" specifically so this can be told apart
 * from "checked, no profile found" (which goes to
 * create-profile instead).
 */
export default function LoadingScreen() {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor:
            colors.background,
        },
      ]}
    >
      <ActivityIndicator
        size="large"
        color={colors.primary}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
