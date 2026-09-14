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

import type { TransactionCategory } from "../lib/categories";
import { fetchExchangeRate } from "../lib/currency";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";

export type TransactionStatus =
  | "confirmed"
  | "settled"
  | "cancelled";

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
  originalCurrency: string | null;
  originalAmountInPence: number | null;
  exchangeRate: number | null;
  category: TransactionCategory;
  categoryCustomLabel: string | null;
};

export type ReceiptStatus =
  | "claiming"
  | "finalized"
  | "cancelled";

export type ReceiptSummary = {
  id: string;
  purchaserId: string;
  purchaserName: string;
  currency: string;
  category: TransactionCategory;
  categoryCustomLabel: string | null;
  status: ReceiptStatus;
  createdAt: string;
};

export type Event = {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  primaryCurrency: string;
  additionalCurrencies: string[];
  members: Member[];
  transactions: Transaction[];
  receipts: ReceiptSummary[];
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
    description: string,
    primaryCurrency: string,
    additionalCurrencies: string[]
  ) => Promise<Event | null>;

  addMember: (
    eventId: string,
    displayName: string
  ) => Promise<string | null>;

  addMemberById: (
    eventId: string,
    userId: string
  ) => Promise<string | null>;

  createTransaction: (
    eventId: string,
    creditorId: string,
    amount: number,
    currency: string,
    description: string,
    category: TransactionCategory,
    categoryCustomLabel: string | null
  ) => Promise<string | null>;

  editTransaction: (
    eventId: string,
    transactionId: string,
    creditorId: string,
    amount: number,
    currency: string,
    description: string,
    category: TransactionCategory,
    categoryCustomLabel: string | null
  ) => Promise<string | null>;

  cancelTransaction: (
    eventId: string,
    transactionId: string
  ) => Promise<string | null>;

  markTransactionPaid: (
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

  leaveEvent: (
    eventId: string
  ) => Promise<string | null>;

  removeMember: (
    eventId: string,
    userId: string
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
          "id, name, description, created_by, created_at, primary_currency, additional_currencies"
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
              receiptResult,
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
                  status,
                  original_currency,
                  original_amount_in_pence,
                  exchange_rate,
                  category,
                  category_custom_label
                  `
                )
                .eq(
                  "event_id",
                  eventRow.id
                )
                .order("created_at", {
                  ascending: false,
                }),

              supabase
                .from("receipts")
                .select(
                  `
                  id,
                  purchaser_id,
                  currency,
                  category,
                  category_custom_label,
                  status,
                  created_at
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

                originalCurrency:
                  transaction.original_currency,

                originalAmountInPence:
                  transaction.original_amount_in_pence,

                exchangeRate:
                  transaction.exchange_rate,

                category:
                  transaction.category as TransactionCategory,

                categoryCustomLabel:
                  transaction.category_custom_label,
              }));

            const {
              data: receiptRows,
              error: receiptError,
            } = receiptResult;

            if (receiptError) {
              console.error(
                "Failed to load receipts:",
                receiptError.message
              );
            }

            const receipts: ReceiptSummary[] =
              (
                receiptRows ?? []
              ).map((receipt) => ({
                id: receipt.id,

                purchaserId:
                  receipt.purchaser_id,

                purchaserName:
                  memberNameMap.get(
                    receipt.purchaser_id
                  ) ?? "Unknown",

                currency:
                  receipt.currency,

                category:
                  receipt.category as TransactionCategory,

                categoryCustomLabel:
                  receipt.category_custom_label,

                status:
                  receipt.status as ReceiptStatus,

                createdAt:
                  receipt.created_at,
              }));

            const loadedEvent: Event = {
              id: eventRow.id,
              name: eventRow.name,

              description:
                eventRow.description,

              createdBy:
                eventRow.created_by,

              primaryCurrency:
                eventRow.primary_currency,

              additionalCurrencies:
                eventRow.additional_currencies ??
                [],

              members,
              transactions,
              receipts,
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

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receipts",
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
    description: string,
    primaryCurrency: string,
    additionalCurrencies: string[]
  ) {
    const { data, error } =
      await supabase.rpc(
        "create_event",
        {
          p_name: name.trim(),
          p_description:
            description.trim(),
          p_primary_currency:
            primaryCurrency,
          p_additional_currencies:
            additionalCurrencies,
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

      primaryCurrency,
      additionalCurrencies,

      members: [],
      transactions: [],
      receipts: [],
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

  async function addMemberById(
    eventId: string,
    userId: string
  ) {
    const { error } =
      await supabase.rpc(
        "add_event_member",
        {
          p_event_id: eventId,
          p_user_id: userId,
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
    amount: number,
    currency: string,
    description: string,
    category: TransactionCategory,
    categoryCustomLabel: string | null
  ) {
    if (!session) {
      return "You must be signed in.";
    }

    const event = events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return "Event not found.";
    }

    let amountInPence: number;
    let originalCurrency: string | null =
      null;
    let originalAmountInPence:
      | number
      | null = null;
    let exchangeRate: number | null =
      null;

    if (
      currency ===
      event.primaryCurrency
    ) {
      amountInPence = Math.round(
        amount * 100
      );
    } else {
      let rate: number;

      try {
        rate =
          await fetchExchangeRate(
            currency,
            event.primaryCurrency
          );
      } catch (conversionError) {
        return conversionError instanceof
          Error
          ? conversionError.message
          : "Could not convert that currency.";
      }

      originalCurrency = currency;

      originalAmountInPence =
        Math.round(amount * 100);

      exchangeRate = rate;

      amountInPence = Math.round(
        amount * rate * 100
      );
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

          status: "confirmed",

          original_currency:
            originalCurrency,

          original_amount_in_pence:
            originalAmountInPence,

          exchange_rate:
            exchangeRate,

          category,

          category_custom_label:
            categoryCustomLabel,
        });

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
  }

  async function editTransaction(
    eventId: string,
    transactionId: string,
    creditorId: string,
    amount: number,
    currency: string,
    description: string,
    category: TransactionCategory,
    categoryCustomLabel: string | null
  ) {
    const event = events.find(
      (item) => item.id === eventId
    );

    if (!event) {
      return "Event not found.";
    }

    let amountInPence: number;
    let originalCurrency: string | null =
      null;
    let originalAmountInPence:
      | number
      | null = null;
    let exchangeRate: number | null =
      null;

    if (
      currency ===
      event.primaryCurrency
    ) {
      amountInPence = Math.round(
        amount * 100
      );
    } else {
      let rate: number;

      try {
        rate =
          await fetchExchangeRate(
            currency,
            event.primaryCurrency
          );
      } catch (conversionError) {
        return conversionError instanceof
          Error
          ? conversionError.message
          : "Could not convert that currency.";
      }

      originalCurrency = currency;

      originalAmountInPence =
        Math.round(amount * 100);

      exchangeRate = rate;

      amountInPence = Math.round(
        amount * rate * 100
      );
    }

    const { error } =
      await supabase.rpc(
        "edit_transaction",
        {
          p_event_id: eventId,

          p_transaction_id:
            transactionId,

          p_creditor_id:
            creditorId,

          p_amount_in_pence:
            amountInPence,

          p_description:
            description.trim(),

          p_category: category,

          p_category_custom_label:
            categoryCustomLabel,

          p_original_currency:
            originalCurrency,

          p_original_amount_in_pence:
            originalAmountInPence,

          p_exchange_rate:
            exchangeRate,
        }
      );

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

  async function cancelTransaction(
    eventId: string,
    transactionId: string
  ) {
    const { error } =
      await supabase.rpc(
        "cancel_transaction",
        {
          p_event_id: eventId,

          p_transaction_id:
            transactionId,
        }
      );

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
  }

  async function leaveEvent(
    eventId: string
  ) {
    const { error } =
      await supabase.rpc(
        "leave_event",
        {
          p_event_id: eventId,
        }
      );

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
  }

  async function removeMember(
    eventId: string,
    userId: string
  ) {
    const { error } =
      await supabase.rpc(
        "remove_event_member",
        {
          p_event_id: eventId,
          p_user_id: userId,
        }
      );

    if (error) {
      return error.message;
    }

    await refreshEvents();

    return null;
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
        addMemberById,
        createTransaction,
        editTransaction,
        cancelTransaction,

        markTransactionPaid,
        forceResolveTransaction,

        deleteEvent,
        leaveEvent,
        removeMember,
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