import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  StyleSheet,
  View,
} from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  AuthProvider,
  useAuth,
} from "../context/AuthContext";
import { EventProvider } from "../context/EventContext";

function AppNavigator() {
  const {
    session,
    profile,
    loading,
  } = useAuth();

  const colorScheme =
    useColorScheme();

  if (loading) {
    return (
      <View
        style={styles.loadingContainer}
      >
        <ActivityIndicator
          size="large"
        />
      </View>
    );
  }

  return (
    <ThemeProvider
      value={
        colorScheme === "dark"
          ? DarkTheme
          : DefaultTheme
      }
    >
      <Stack>
        <Stack.Protected
          guard={!session}
        >
          <Stack.Screen
            name="login"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="email-confirmed"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="forgot-password"
            options={{
              headerShown: false,
            }}
          />
        </Stack.Protected>

        {/*
          Not wrapped in a Stack.Protected guard: the
          recovery link authenticates the user (session
          becomes truthy) before they've actually set a new
          password, so this screen has to stay reachable
          through that transition rather than being hidden
          by the signed-in/signed-out guards above/below.
        */}
        <Stack.Screen
          name="reset-password"
          options={{
            headerShown: false,
          }}
        />

        <Stack.Protected
          guard={
            !!session &&
            !profile
          }
        >
          <Stack.Screen
            name="create-profile"
            options={{
              headerShown: false,
            }}
          />
        </Stack.Protected>

        <Stack.Protected
          guard={
            !!session &&
            !!profile
          }
        >
          <Stack.Screen
            name="index"
            options={{
              headerShown: false,
            }}
          />

          <Stack.Screen
            name="account"
            options={{
              title: "Account",
            }}
          />

          <Stack.Screen
            name="create-event"
            options={{
              title:
                "Create Event",
            }}
          />

          <Stack.Screen
            name="events/[id]/index"
            options={{
              title: "Event",
            }}
          />

          <Stack.Screen
            name="events/[id]/add-transaction"
            options={{
              title:
                "Add Transaction",
            }}
          />
        </Stack.Protected>
      </Stack>

      <StatusBar
        style="auto"
      />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <EventProvider>
        <AppNavigator />
      </EventProvider>
    </AuthProvider>
  );
}

const styles =
  StyleSheet.create({
    loadingContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },
  });