import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type Friend = {
  id: string;
  displayName: string;
};

export type FriendRequest = {
  id: string;
  userId: string;
  displayName: string;
};

type FriendLookupResult = {
  profile: Friend | null;
  error: string | null;
};

type FriendsContextType = {
  friends: Friend[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  loading: boolean;
  refreshing: boolean;

  refreshFriends: (
    showIndicator?: boolean
  ) => Promise<void>;

  findByCode: (
    code: string
  ) => Promise<FriendLookupResult>;

  sendRequest: (
    userId: string
  ) => Promise<string | null>;

  respondToRequest: (
    requestId: string,
    accept: boolean
  ) => Promise<string | null>;

  cancelRequest: (
    requestId: string
  ) => Promise<string | null>;

  removeFriend: (
    friendId: string
  ) => Promise<string | null>;
};

const FriendsContext =
  createContext<FriendsContextType | undefined>(
    undefined
  );

export function FriendsProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();

  const [friends, setFriends] =
    useState<Friend[]>([]);

  const [
    incomingRequests,
    setIncomingRequests,
  ] = useState<FriendRequest[]>(
    []
  );

  const [
    outgoingRequests,
    setOutgoingRequests,
  ] = useState<FriendRequest[]>(
    []
  );

  const [loading, setLoading] =
    useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const loadFriendsFromDatabase =
    useCallback(async () => {
      if (!session) {
        setFriends([]);
        setIncomingRequests([]);
        setOutgoingRequests([]);
        return;
      }

      const currentUserId =
        session.user.id;

      const {
        data: friendshipRows,
        error: friendshipError,
      } = await supabase
        .from("friendships")
        .select(
          "id, requester_id, addressee_id, status"
        );

      if (friendshipError) {
        console.error(
          "Failed to load friendships:",
          friendshipError.message
        );

        return;
      }

      const otherPartyIds = new Set<string>();

      (friendshipRows ?? []).forEach(
        (row) => {
          const otherId =
            row.requester_id ===
            currentUserId
              ? row.addressee_id
              : row.requester_id;

          otherPartyIds.add(
            otherId
          );
        }
      );

      let nameById = new Map<
        string,
        string
      >();

      if (otherPartyIds.size > 0) {
        const {
          data: profileRows,
          error: profileError,
        } = await supabase
          .from("profiles")
          .select(
            "id, display_name"
          )
          .in(
            "id",
            Array.from(
              otherPartyIds
            )
          );

        if (profileError) {
          console.error(
            "Failed to load friend profiles:",
            profileError.message
          );
        } else {
          nameById = new Map(
            (
              profileRows ?? []
            ).map((profile) => [
              profile.id,
              profile.display_name,
            ])
          );
        }
      }

      const nextFriends: Friend[] =
        [];

      const nextIncoming: FriendRequest[] =
        [];

      const nextOutgoing: FriendRequest[] =
        [];

      (friendshipRows ?? []).forEach(
        (row) => {
          const otherId =
            row.requester_id ===
            currentUserId
              ? row.addressee_id
              : row.requester_id;

          const displayName =
            nameById.get(
              otherId
            ) ?? "Unknown";

          if (
            row.status ===
            "accepted"
          ) {
            nextFriends.push({
              id: otherId,
              displayName,
            });
          } else if (
            row.status ===
            "pending"
          ) {
            if (
              row.addressee_id ===
              currentUserId
            ) {
              nextIncoming.push({
                id: row.id,
                userId: otherId,
                displayName,
              });
            } else {
              nextOutgoing.push({
                id: row.id,
                userId: otherId,
                displayName,
              });
            }
          }
        }
      );

      nextFriends.sort((a, b) =>
        a.displayName.localeCompare(
          b.displayName
        )
      );

      setFriends(nextFriends);
      setIncomingRequests(
        nextIncoming
      );
      setOutgoingRequests(
        nextOutgoing
      );
    }, [session]);

  const refreshFriends =
    useCallback(
      async (
        showIndicator = false
      ) => {
        if (showIndicator) {
          setRefreshing(true);
        }

        try {
          await loadFriendsFromDatabase();
        } finally {
          if (showIndicator) {
            setRefreshing(false);
          }
        }
      },
      [loadFriendsFromDatabase]
    );

  useEffect(() => {
    if (!session) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setLoading(false);
      return;
    }

    async function initialLoad() {
      setLoading(true);

      await refreshFriends();

      setLoading(false);
    }

    initialLoad();
  }, [session, refreshFriends]);

  async function findByCode(
    code: string
  ): Promise<FriendLookupResult> {
    const {
      data,
      error,
    } = await supabase.rpc(
      "find_profile_by_friend_code",
      { p_code: code }
    );

    if (error) {
      return {
        profile: null,
        error: error.message,
      };
    }

    const row = data?.[0];

    if (!row) {
      return {
        profile: null,
        error: null,
      };
    }

    return {
      profile: {
        id: row.id,
        displayName:
          row.display_name,
      },
      error: null,
    };
  }

  async function sendRequest(
    userId: string
  ) {
    const { error } =
      await supabase.rpc(
        "send_friend_request",
        { p_addressee_id: userId }
      );

    if (error) {
      return error.message;
    }

    await refreshFriends();

    return null;
  }

  async function respondToRequest(
    requestId: string,
    accept: boolean
  ) {
    const { error } =
      await supabase.rpc(
        "respond_to_friend_request",
        {
          p_request_id: requestId,
          p_accept: accept,
        }
      );

    if (error) {
      return error.message;
    }

    await refreshFriends();

    return null;
  }

  async function cancelRequest(
    requestId: string
  ) {
    const { error } =
      await supabase.rpc(
        "cancel_friend_request",
        {
          p_request_id: requestId,
        }
      );

    if (error) {
      return error.message;
    }

    await refreshFriends();

    return null;
  }

  async function removeFriend(
    friendId: string
  ) {
    const { error } =
      await supabase.rpc(
        "remove_friend",
        { p_friend_id: friendId }
      );

    if (error) {
      return error.message;
    }

    await refreshFriends();

    return null;
  }

  return (
    <FriendsContext.Provider
      value={{
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
      }}
    >
      {children}
    </FriendsContext.Provider>
  );
}

export function useFriends() {
  const context = useContext(
    FriendsContext
  );

  if (!context) {
    throw new Error(
      "useFriends must be used within a FriendsProvider"
    );
  }

  return context;
}
