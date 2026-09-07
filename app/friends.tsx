import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import {
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { ScreenContainer } from "../components/ui/ScreenContainer";
import { TextField } from "../components/ui/TextField";
import {
  FontSize,
  Radius,
  Spacing,
} from "../constants/theme";
import { useAuth } from "../context/AuthContext";
import {
  Friend,
  useFriends,
} from "../context/FriendsContext";
import { useTheme } from "../context/ThemeContext";

export default function FriendsScreen() {
  const { colors } = useTheme();

  const { profile } = useAuth();

  const {
    friends,
    incomingRequests,
    outgoingRequests,
    loading,
    refreshing,
    refreshFriends,
    findByCode,
    sendRequest,
    respondToRequest,
    cancelRequest,
    removeFriend,
  } = useFriends();

  const [
    codeInput,
    setCodeInput,
  ] = useState("");

  const [
    searching,
    setSearching,
  ] = useState(false);

  const [
    searchError,
    setSearchError,
  ] = useState("");

  const [
    foundProfile,
    setFoundProfile,
  ] =
    useState<Friend | null>(
      null
    );

  const [
    sendingRequestTo,
    setSendingRequestTo,
  ] = useState<string | null>(
    null
  );

  const [
    respondingId,
    setRespondingId,
  ] = useState<string | null>(
    null
  );

  const [
    removingId,
    setRemovingId,
  ] = useState<string | null>(
    null
  );

  useFocusEffect(
    useCallback(() => {
      refreshFriends();

      return undefined;
    }, [refreshFriends])
  );

  async function handleRefresh() {
    await refreshFriends(true);
  }

  async function handleSearch() {
    const trimmed =
      codeInput.trim();

    if (!trimmed) {
      return;
    }

    setSearching(true);
    setSearchError("");
    setFoundProfile(null);

    const { profile: found, error } =
      await findByCode(trimmed);

    setSearching(false);

    if (error) {
      setSearchError(error);
      return;
    }

    if (!found) {
      setSearchError(
        "No one found with that code."
      );
      return;
    }

    setFoundProfile(found);
  }

  async function handleSendRequest(
    userId: string
  ) {
    setSendingRequestTo(userId);
    setSearchError("");

    const error = await sendRequest(
      userId
    );

    setSendingRequestTo(null);

    if (error) {
      setSearchError(error);
      return;
    }

    setFoundProfile(null);
    setCodeInput("");
  }

  async function handleRespond(
    requestId: string,
    accept: boolean
  ) {
    setRespondingId(requestId);

    await respondToRequest(
      requestId,
      accept
    );

    setRespondingId(null);
  }

  async function handleCancel(
    requestId: string
  ) {
    setRespondingId(requestId);

    await cancelRequest(
      requestId
    );

    setRespondingId(null);
  }

  async function handleRemove(
    friendId: string
  ) {
    setRemovingId(friendId);

    await removeFriend(friendId);

    setRemovingId(null);
  }

  async function handleShareCode() {
    if (!profile) {
      return;
    }

    try {
      await Share.share({
        message: `Add me on GroupFinance - my friend code is ${profile.friend_code}`,
      });
    } catch {
      // User dismissed the share sheet - nothing to do.
    }
  }

  function initials(name: string) {
    return (
      name.trim().charAt(0) || "?"
    ).toUpperCase();
  }

  function FriendRow({
    name,
    onRemove,
    removing,
  }: {
    name: string;
    onRemove: () => void;
    removing: boolean;
  }) {
    return (
      <View
        style={[
          styles.friendRow,
          {
            backgroundColor:
              colors.surface,
            borderColor:
              colors.border,
          },
        ]}
      >
        <View
          style={
            styles.friendIdentity
          }
        >
          <View
            style={[
              styles.avatar,
              {
                backgroundColor:
                  colors.surfaceSubtle,
              },
            ]}
          >
            <Text
              style={[
                styles.avatarText,
                {
                  color:
                    colors.textSecondary,
                },
              ]}
            >
              {initials(name)}
            </Text>
          </View>

          <Text
            style={[
              styles.friendName,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {name}
          </Text>
        </View>

        <Pressable
          onPress={onRemove}
          disabled={removing}
          hitSlop={8}
        >
          {removing ? (
            <ActivityIndicator
              size="small"
              color={
                colors.dangerText
              }
            />
          ) : (
            <Ionicons
              name="close-circle-outline"
              size={20}
              color={
                colors.dangerText
              }
            />
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <ScreenContainer
      refreshing={refreshing}
      onRefresh={handleRefresh}
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
        Friends
      </Text>

      <Text
        style={[
          styles.subtitle,
          {
            color:
              colors.textSecondary,
          },
        ]}
      >
        Add people once, then
        quick-add them to any
        event.
      </Text>

      <Card>
        <Text
          style={[
            styles.codeLabel,
            {
              color:
                colors.textSecondary,
            },
          ]}
        >
          Your Friend Code
        </Text>

        <View
          style={
            styles.codeRow
          }
        >
          <Text
            style={[
              styles.codeText,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            {profile?.friend_code ??
              "········"}
          </Text>

          <Pressable
            style={[
              styles.shareButton,
              {
                backgroundColor:
                  colors.primary,
              },
            ]}
            onPress={
              handleShareCode
            }
          >
            <Ionicons
              name="share-outline"
              size={16}
              color={
                colors.onPrimary
              }
            />
          </Pressable>
        </View>
      </Card>

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Add a Friend
      </Text>

      <TextField
        label="Their friend code"
        placeholder="e.g. JX7K9QZ2"
        value={codeInput}
        onChangeText={(text) => {
          setCodeInput(text);
          setFoundProfile(null);
          setSearchError("");
        }}
        autoCapitalize="characters"
        maxLength={8}
        returnKeyType="search"
        onSubmitEditing={
          handleSearch
        }
      />

      <Button
        label="Search"
        variant="secondary"
        icon="search"
        onPress={handleSearch}
        loading={searching}
        disabled={
          !codeInput.trim()
        }
      />

      {searchError ? (
        <Text
          style={[
            styles.errorText,
            {
              color:
                colors.dangerText,
            },
          ]}
        >
          {searchError}
        </Text>
      ) : null}

      {foundProfile ? (
        <Card
          variant="default"
          style={
            styles.foundCard
          }
        >
          <View
            style={
              styles.friendIdentity
            }
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor:
                    colors.surfaceSubtle,
                },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  {
                    color:
                      colors.textSecondary,
                  },
                ]}
              >
                {initials(
                  foundProfile.displayName
                )}
              </Text>
            </View>

            <Text
              style={[
                styles.friendName,
                {
                  color:
                    colors.textPrimary,
                },
              ]}
            >
              {
                foundProfile.displayName
              }
            </Text>
          </View>

          <Button
            label="Send Friend Request"
            icon="person-add-outline"
            onPress={() =>
              handleSendRequest(
                foundProfile.id
              )
            }
            loading={
              sendingRequestTo ===
              foundProfile.id
            }
          />
        </Card>
      ) : null}

      {incomingRequests.length >
      0 ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            Friend Requests
          </Text>

          {incomingRequests.map(
            (request) => (
              <Card
                key={request.id}
                style={
                  styles.requestCard
                }
              >
                <View
                  style={
                    styles.friendIdentity
                  }
                >
                  <View
                    style={[
                      styles.avatar,
                      {
                        backgroundColor:
                          colors.surfaceSubtle,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color:
                            colors.textSecondary,
                        },
                      ]}
                    >
                      {initials(
                        request.displayName
                      )}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.friendName,
                      {
                        color:
                          colors.textPrimary,
                      },
                    ]}
                  >
                    {
                      request.displayName
                    }
                  </Text>
                </View>

                <View
                  style={
                    styles.actionRow
                  }
                >
                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <Button
                      label="Accept"
                      icon="checkmark"
                      onPress={() =>
                        handleRespond(
                          request.id,
                          true
                        )
                      }
                      loading={
                        respondingId ===
                        request.id
                      }
                    />
                  </View>

                  <View
                    style={
                      styles.actionButton
                    }
                  >
                    <Button
                      label="Decline"
                      variant="secondary"
                      icon="close"
                      onPress={() =>
                        handleRespond(
                          request.id,
                          false
                        )
                      }
                      disabled={
                        respondingId ===
                        request.id
                      }
                    />
                  </View>
                </View>
              </Card>
            )
          )}
        </>
      ) : null}

      {outgoingRequests.length >
      0 ? (
        <>
          <Text
            style={[
              styles.sectionTitle,
              {
                color:
                  colors.textPrimary,
              },
            ]}
          >
            Sent Requests
          </Text>

          {outgoingRequests.map(
            (request) => (
              <View
                key={request.id}
                style={[
                  styles.friendRow,
                  {
                    backgroundColor:
                      colors.surface,
                    borderColor:
                      colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.friendName,
                    {
                      color:
                        colors.textPrimary,
                    },
                  ]}
                >
                  {
                    request.displayName
                  }
                </Text>

                <Pressable
                  onPress={() =>
                    handleCancel(
                      request.id
                    )
                  }
                  disabled={
                    respondingId ===
                    request.id
                  }
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.cancelText,
                      {
                        color:
                          colors.textSecondary,
                      },
                    ]}
                  >
                    Cancel
                  </Text>
                </Pressable>
              </View>
            )
          )}
        </>
      ) : null}

      <Text
        style={[
          styles.sectionTitle,
          {
            color:
              colors.textPrimary,
          },
        ]}
      >
        Your Friends
      </Text>

      {loading ? (
        <View
          style={
            styles.loadingContainer
          }
        >
          <ActivityIndicator
            color={colors.primary}
          />
        </View>
      ) : friends.length === 0 ? (
        <Text
          style={[
            styles.emptyText,
            {
              color:
                colors.textTertiary,
            },
          ]}
        >
          No friends yet - search
          for a friend code above
          to add your first one.
        </Text>
      ) : (
        friends.map((friend) => (
          <FriendRow
            key={friend.id}
            name={
              friend.displayName
            }
            onRemove={() =>
              handleRemove(
                friend.id
              )
            }
            removing={
              removingId ===
              friend.id
            }
          />
        ))
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontWeight: "700",
  },

  subtitle: {
    fontSize: FontSize.base,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },

  codeLabel: {
    fontSize: FontSize.sm,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },

  codeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  codeText: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    letterSpacing: 2,
  },

  shareButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: "700",
    marginTop: Spacing.xxl,
    marginBottom: Spacing.md,
  },

  errorText: {
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },

  foundCard: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },

  requestCard: {
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },

  friendIdentity: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },

  avatar: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarText: {
    fontSize: FontSize.base,
    fontWeight: "700",
  },

  friendName: {
    fontSize: FontSize.md,
    fontWeight: "500",
  },

  friendRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },

  actionRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },

  actionButton: {
    flex: 1,
  },

  cancelText: {
    fontSize: FontSize.sm,
    fontWeight: "600",
  },

  loadingContainer: {
    paddingVertical: Spacing.xl,
  },

  emptyText: {
    fontSize: FontSize.base,
  },
});
