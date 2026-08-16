import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";

import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type TransactionStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "payment_pending"
  | "settled";

export type Member = {
  id: string;
  displayName: string;
};

export type Transaction = {
  id: string;
  debtorId: string;
  creditorId: string;
  debtorName: string;
  creditorName: string;
  amountInPence: number;
  description: string;
  createdAt: string;
  status: TransactionStatus;
};

export type Event = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  members: Member[];
  transactions: Transaction[];
};

type EventContextType = {
  events: Event[];
  loading: boolean;
  refreshing: boolean;

  refreshEvents: (
    showIndicator?: boolean
  ) => Promise<void>;

  createEvent: (
    name: string,
    description: string
  ) => Promise<Event | null>;

  addMember: (
    eventId: string,
    displayName: string
  ) => Promise<string | null>;

  createTransaction: (
    eventId: string,
    creditorId: string,
    amountInPence: number,
    description: string
  ) => Promise<string | null>;

  confirmTransaction: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  rejectTransaction: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  markTransactionPaid: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  confirmSettlement: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  rejectSettlement: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  forceResolveTransaction: (
    eventId: string,
    transactionId: string
  ) => Promise<void>;

  deleteEvent: (
    eventId: string
  ) => Promise<string | null>;
};

const EventContext =
  createContext<EventContextType | undefined>(
    undefined
  );

export function EventProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();

  const [events, setEvents] =
    useState<Event[]>([]);

  const [loading, setLoading] =
    useState(false);

  const [refreshing, setRefreshing] =
    useState(false);

  const refreshInProgressRef =
    useRef<Promise<void> | null>(null);

  const refreshQueuedRef =
    useRef(false);

  const realtimeTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  const loadEventsFromDatabase =
    useCallback(async () => {
      if (!session) {
        setEvents([]);
        return;
      }

      const {
        data: eventRows,
        error: eventError,
      } = await supabase
        .from("events")
        .select(
          "id, name, description, created_by, created_at"
        )
        .order("created_at", {
          ascending: false,
        });

      if (eventError) {
        console.error(
          "Failed to load events:",
          eventError.message
        );

        return;
      }

      const loadedEvents = await Promise.all(
        (eventRows ?? []).map(
          async (eventRow) => {
            const [
              membershipResult,
              transactionResult,
            ] = await Promise.all([
              supabase
                .from("event_members")
                .select("user_id")
                .eq(
                  "event_id",
                  eventRow.id
                ),

              supabase
                .from("transactions")
                .select(
                  `
                  id,
                  debtor_id,
                  creditor_id,
                  amount_in_pence,
                  description,
                  created_at,
                  status
                  `
                )
                .eq(
                  "event_id",
                  eventRow.id
                )
                .order("created_at", {
                  ascending: false,
                }),
            ]);

            const {
              data: membershipRows,
              error: membershipError,
            } = membershipResult;

            if (membershipError) {
              console.error(
                "Failed to load members:",
                membershipError.message
              );

              return null;
            }

            const memberIds = (
              membershipRows ?? []
            ).map(
              (membership) =>
                membership.user_id
            );

            let members: Member[] = [];

            if (memberIds.length > 0) {
              const {
                data: profileRows,
                error: profileError,
              } = await supabase
                .from("profiles")
                .select(
                  "id, display_name"
                )
                .in("id", memberIds);

              if (profileError) {
                console.error(
                  "Failed to load member profiles:",
                  profileError.message
                );
              } else {
                members = (
                  profileRows ?? []
                ).map((profile) => ({
                  id: profile.id,
                  displayName:
                    profile.display_name,
                }));
              }
            }

            const memberNameMap =
              new Map<
                string,
                string
              >();

            members.forEach(
              (member) => {
                memberNameMap.set(
                  member.id,
                  member.displayName
                );
              }
            );

            const {
              data: transactionRows,
              error: transactionError,
            } = transactionResult;

            if (transactionError) {
              console.error(
                "Failed to load transactions:",
                transactionError.message
              );
            }

            const transactions: Transaction[] =
              (
                transactionRows ?? []
              ).map((transaction) => ({
                id: transaction.id,

                debtorId:
                  transaction.debtor_id,

                creditorId:
                  transaction.creditor_id,

                debtorName:
                  memberNameMap.get(
                    transaction.debtor_id
                  ) ?? "Unknown",

                creditorName:
                  memberNameMap.get(
                    transaction.creditor_id
                  ) ?? "Unknown",

                amountInPence:
                  transaction.amount_in_pence,

                description:
                  transaction.description,

                createdAt:
                  transaction.created_at,

                status:
                  transaction.status as TransactionStatus,
              }));

            const loadedEvent: Event = {
              id: eventRow.id,
              name: eventRow.name,

              description:
                eventRow.description,

              createdBy:
                eventRow.created_by,

              members,
              transactions,
            };

            return loadedEvent;
          }
        )
      );

      setEvents(
        loadedEvents.filter(
          (event): event is Event =>
            event !== null
        )
      );
    }, [session]);

  const refreshEvents =
    useCallback(
      async (
        showIndicator = false
      ) => {
        if (!session) {
          setEvents([]);
          return;
        }

        if (
          refreshInProgressRef.current
        ) {
          refreshQueuedRef.current =
            true;

          await refreshInProgressRef.current;

          return;
        }

        if (showIndicator) {
          setRefreshing(true);
        }

        const refreshPromise =
          (async () => {
            do {
              refreshQueuedRef.current =
                false;

              await loadEventsFromDatabase();
            } while (
              refreshQueuedRef.current
            );
          })();

        refreshInProgressRef.current =
          refreshPromise;

        try {
          await refreshPromise;
        } finally {
          refreshInProgressRef.current =
            null;

          if (showIndicator) {
            setRefreshing(false);
          }
        }
      },
      [
        session,
        loadEventsFromDatabase,
      ]
    );

  useEffect(() => {
    if (!session) {
      setEvents([]);
      setLoading(false);
      return;
    }

    async function initialLoad() {
      setLoading(true);

      await refreshEvents();

      setLoading(false);
    }

    initialLoad();
  }, [
    session,
    refreshEvents,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    function scheduleRealtimeRefresh() {
      if (
        realtimeTimerRef.current
      ) {
        clearTimeout(
          realtimeTimerRef.current
        );
      }

      realtimeTimerRef.current =
        setTimeout(() => {
          refreshEvents();
        }, 250);
    }

    const channel = supabase
      .channel(
        `group-finance-${session.user.id}`
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "events",
        },
        () => {
          scheduleRealtimeRefresh();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_members",
        },
        () => {
          scheduleRealtimeRefresh();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        () => {
          scheduleRealtimeRefresh();
        }
      )

      .subscribe((_status, error) => {
        if (error) {
          console.error(
            "Realtime subscription error:",
            error
          );
        }
      });

    return () => {
      if (
        realtimeTimerRef.current
      ) {
        clearTimeout(
          realtimeTimerRef.current
        );

        realtimeTimerRef.current =
          null;
      }

      supabase.removeChannel(
        channel
      );
    };
  }, [
    session,
    refreshEvents,
  ]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const subscription =
      AppState.addEventListener(
        "change",
        async (nextAppState) => {
          if (
            nextAppState ===
            "active"
          ) {
            await refreshEvents();
          }
        }
      );

    return () => {
      subscription.remove();
    };
  }, [
    session,
    refreshEvents,
  ]);

  async function createEvent(
    name: string,
    description: string
  ) {
    const { data, error } =
      await supabase.rpc(
        "create_event",
        {
          p_name: name.trim(),
          p_description:
            description.trim(),
        }
      );

    if (error) {
      console.error(
        "Failed to create event:",
        error.message
      );

      return null;
    }

    const newEventId =
      data as string;

    await refreshEvents();

    return {
      id: newEventId,
      name: name.trim(),

      description:
        description.trim(),

      createdBy:
        session?.user.id ?? "",

      members: [],
      transactions: [],
    };
  }

  async function addMember(
    eventId: string,
    displayName: string
  ) {
    const { error } =
      await supabase.rpc(
        "add_event_member_by_name",
        {
          p_event_id: eventId,

          p_display_name:
            displayName.trim(),
        }
      );

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
  }

  async function createTransaction(
    eventId: string,
    creditorId: string,
    amountInPence: number,
    description: string
  ) {
    if (!session) {
      return "You must be signed in.";
    }

    const { error } =
      await supabase
        .from("transactions")
        .insert({
          event_id: eventId,

          debtor_id:
            session.user.id,

          creditor_id:
            creditorId,

          amount_in_pence:
            amountInPence,

          description:
            description.trim(),

          status: "pending",
        });

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
  }

  async function runTransactionAction(
    functionName: string,
    eventId: string,
    transactionId: string
  ) {
    const { error } =
      await supabase.rpc(
        functionName,
        {
          p_event_id:
            eventId,

          p_transaction_id:
            transactionId,
        }
      );

    if (error) {
      console.error(
        `${functionName} failed:`,
        error.message
      );

      return;
    }

    await refreshEvents();
  }

  async function confirmTransaction(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "confirm_transaction",
      eventId,
      transactionId
    );
  }

  async function rejectTransaction(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "reject_transaction",
      eventId,
      transactionId
    );
  }

  async function markTransactionPaid(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "mark_transaction_paid",
      eventId,
      transactionId
    );
  }

  async function confirmSettlement(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "confirm_settlement",
      eventId,
      transactionId
    );
  }

  async function rejectSettlement(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "reject_settlement",
      eventId,
      transactionId
    );
  }

  async function forceResolveTransaction(
    eventId: string,
    transactionId: string
  ) {
    await runTransactionAction(
      "force_resolve_stuck_transaction",
      eventId,
      transactionId
    );
  }

  async function deleteEvent(
    eventId: string
  ) {
    const { data, error } =
      await supabase
        .from("events")
        .delete()
        .eq(
          "id",
          eventId
        )
        .select("id");

    if (error) {
      console.error(
        "Failed to delete event:",
        error.message
      );

      return "Could not delete the event.";
    }

    if (
      !data ||
      data.length === 0
    ) {
      await refreshEvents();

      return "You no longer have permission to delete this event.";
    }

    await refreshEvents();

    return null;
  }

  return (
    <EventContext.Provider
      value={{
        events,
        loading,
        refreshing,
        refreshEvents,

        createEvent,
        addMember,
        createTransaction,

        confirmTransaction,
        rejectTransaction,

        markTransactionPaid,
        confirmSettlement,
        rejectSettlement,
        forceResolveTransaction,

        deleteEvent,
      }}
    >
      {children}
    </EventContext.Provider>
  );
}

export function useEvents() {
  const context =
    useContext(EventContext);

  if (!context) {
    throw new Error(
      "useEvents must be used inside EventProvider"
    );
  }

  return context;
}