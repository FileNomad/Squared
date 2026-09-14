import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

import type { TransactionCategory } from "../lib/categories";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import type { ReceiptStatus } from "./EventContext";

/**
 * supabase-js's FunctionsHttpError carries the actual
 * response body on `context`, which is a Response object
 * that still needs to be read - error.message is just the
 * generic "Edge Function returned a non-2xx status code",
 * not the scan-receipt function's own { error: "..." } body.
 * Falls back to that generic message if context isn't a
 * readable Response (a network-level FunctionsFetchError,
 * or a body that isn't JSON).
 */
async function extractFunctionErrorMessage(
  error: {
    message: string;
    context?: unknown;
  }
): Promise<string> {
  const context = error.context as
    | {
        json?: () => Promise<unknown>;
      }
    | undefined;

  if (typeof context?.json !== "function") {
    return error.message;
  }

  try {
    const body = await context.json();

    const bodyError = (
      body as {
        error?: unknown;
      }
    )?.error;

    return typeof bodyError === "string"
      ? bodyError
      : error.message;
  } catch {
    return error.message;
  }
}

export type ReceiptItem = {
  id: string;
  name: string;
  priceInPence: number;
  quantity: number;
  claimantIds: string[];
};

export type ReceiptDetail = {
  id: string;
  eventId: string;
  purchaserId: string;
  currency: string;
  category: TransactionCategory;
  categoryCustomLabel: string | null;
  taxInPence: number;
  tipInPence: number;
  status: ReceiptStatus;
  attendeeIds: string[];
  items: ReceiptItem[];
};

type ScanReceiptParams = {
  eventId: string;
  currency: string;
  category: TransactionCategory;
  categoryCustomLabel: string | null;
  attendeeIds: string[];
  imageBase64: string;
};

type ReceiptContextType = {
  receipt: ReceiptDetail | null;
  loading: boolean;
  scanning: boolean;

  loadReceipt: (
    receiptId: string
  ) => Promise<void>;

  clearReceipt: () => void;

  subscribeToReceipt: (
    receiptId: string
  ) => () => void;

  scanReceipt: (
    params: ScanReceiptParams
  ) => Promise<{
    receiptId: string | null;
    error: string | null;
  }>;

  claimItem: (
    itemId: string
  ) => Promise<string | null>;

  unclaimItem: (
    itemId: string
  ) => Promise<string | null>;

  updateTaxTip: (
    receiptId: string,
    taxInPence: number,
    tipInPence: number
  ) => Promise<string | null>;

  finalizeReceipt: (
    receiptId: string,
    originalCurrency: string | null,
    exchangeRate: number | null
  ) => Promise<string | null>;

  cancelReceipt: (
    receiptId: string
  ) => Promise<string | null>;
};

const ReceiptContext =
  createContext<ReceiptContextType | undefined>(
    undefined
  );

export function ReceiptProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { session } = useAuth();

  const [receipt, setReceipt] =
    useState<ReceiptDetail | null>(
      null
    );

  const [loading, setLoading] =
    useState(false);

  const [scanning, setScanning] =
    useState(false);

  const loadReceipt = useCallback(
    async (receiptId: string) => {
      if (!session) {
        setReceipt(null);
        return;
      }

      setLoading(true);

      const [
        receiptResult,
        attendeeResult,
        itemResult,
      ] = await Promise.all([
        supabase
          .from("receipts")
          .select(
            `
            id,
            event_id,
            purchaser_id,
            currency,
            category,
            category_custom_label,
            tax_in_pence,
            tip_in_pence,
            status
            `
          )
          .eq("id", receiptId)
          .single(),

        supabase
          .from("receipt_attendees")
          .select("user_id")
          .eq(
            "receipt_id",
            receiptId
          ),

        supabase
          .from("receipt_items")
          .select(
            "id, name, price_in_pence, quantity"
          )
          .eq(
            "receipt_id",
            receiptId
          )
          .order("name"),
      ]);

      if (
        receiptResult.error ||
        !receiptResult.data
      ) {
        console.error(
          "Failed to load receipt:",
          receiptResult.error?.message
        );

        setReceipt(null);
        setLoading(false);
        return;
      }

      const itemIds = (
        itemResult.data ?? []
      ).map((item) => item.id);

      let claimRows: {
        receipt_item_id: string;
        user_id: string;
      }[] = [];

      if (itemIds.length > 0) {
        const {
          data: claimData,
          error: claimError,
        } = await supabase
          .from("receipt_item_claims")
          .select(
            "receipt_item_id, user_id"
          )
          .in(
            "receipt_item_id",
            itemIds
          );

        if (claimError) {
          console.error(
            "Failed to load receipt claims:",
            claimError.message
          );
        } else {
          claimRows =
            claimData ?? [];
        }
      }

      const claimsByItem = new Map<
        string,
        string[]
      >();

      claimRows.forEach((claim) => {
        const existing =
          claimsByItem.get(
            claim.receipt_item_id
          ) ?? [];

        existing.push(
          claim.user_id
        );

        claimsByItem.set(
          claim.receipt_item_id,
          existing
        );
      });

      const items: ReceiptItem[] = (
        itemResult.data ?? []
      ).map((item) => ({
        id: item.id,
        name: item.name,

        priceInPence:
          item.price_in_pence,

        quantity: item.quantity,

        claimantIds:
          claimsByItem.get(
            item.id
          ) ?? [],
      }));

      const receiptRow =
        receiptResult.data;

      setReceipt({
        id: receiptRow.id,
        eventId: receiptRow.event_id,

        purchaserId:
          receiptRow.purchaser_id,

        currency:
          receiptRow.currency,

        category:
          receiptRow.category as TransactionCategory,

        categoryCustomLabel:
          receiptRow.category_custom_label,

        taxInPence:
          receiptRow.tax_in_pence,

        tipInPence:
          receiptRow.tip_in_pence,

        status:
          receiptRow.status as ReceiptStatus,

        attendeeIds: (
          attendeeResult.data ?? []
        ).map(
          (row) => row.user_id
        ),

        items,
      });

      setLoading(false);
    },
    [session]
  );

  function clearReceipt() {
    setReceipt(null);
  }

  function subscribeToReceipt(
    receiptId: string
  ) {
    let refreshTimer: ReturnType<
      typeof setTimeout
    > | null = null;

    function scheduleRefresh() {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      refreshTimer = setTimeout(() => {
        loadReceipt(receiptId);
      }, 250);
    }

    const channel = supabase
      .channel(
        `receipt-${receiptId}`
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table:
            "receipt_item_claims",
        },
        () => {
          scheduleRefresh();
        }
      )

      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receipts",
          filter: `id=eq.${receiptId}`,
        },
        () => {
          scheduleRefresh();
        }
      )

      .subscribe((_status, error) => {
        if (error) {
          console.error(
            "Receipt realtime subscription error:",
            error
          );
        }
      });

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }

      supabase.removeChannel(
        channel
      );
    };
  }

  async function scanReceipt(
    params: ScanReceiptParams
  ) {
    setScanning(true);

    const { data, error } =
      await supabase.functions.invoke(
        "scan-receipt",
        {
          body: {
            event_id:
              params.eventId,
            currency:
              params.currency,
            category:
              params.category,

            category_custom_label:
              params.categoryCustomLabel,

            attendee_ids:
              params.attendeeIds,

            image_base64:
              params.imageBase64,
          },
        }
      );

    setScanning(false);

    if (error) {
      return {
        receiptId: null,
        error: await extractFunctionErrorMessage(
          error
        ),
      };
    }

    if (data?.error) {
      return {
        receiptId: null,
        error: data.error as string,
      };
    }

    return {
      receiptId:
        (data?.receipt_id as
          | string
          | undefined) ?? null,
      error: null,
    };
  }

  async function claimItem(
    itemId: string
  ) {
    const { error } =
      await supabase.rpc(
        "claim_receipt_item",
        { p_item_id: itemId }
      );

    if (error) {
      return error.message;
    }

    if (receipt) {
      await loadReceipt(receipt.id);
    }

    return null;
  }

  async function unclaimItem(
    itemId: string
  ) {
    const { error } =
      await supabase.rpc(
        "unclaim_receipt_item",
        { p_item_id: itemId }
      );

    if (error) {
      return error.message;
    }

    if (receipt) {
      await loadReceipt(receipt.id);
    }

    return null;
  }

  async function updateTaxTip(
    receiptId: string,
    taxInPence: number,
    tipInPence: number
  ) {
    const { error } =
      await supabase.rpc(
        "update_receipt_tax_tip",
        {
          p_receipt_id: receiptId,

          p_tax_in_pence:
            taxInPence,

          p_tip_in_pence:
            tipInPence,
        }
      );

    if (error) {
      return error.message;
    }

    await loadReceipt(receiptId);

    return null;
  }

  async function finalizeReceipt(
    receiptId: string,
    originalCurrency: string | null,
    exchangeRate: number | null
  ) {
    const { error } =
      await supabase.rpc(
        "finalize_receipt",
        {
          p_receipt_id: receiptId,

          p_original_currency:
            originalCurrency,

          p_exchange_rate:
            exchangeRate,
        }
      );

    if (error) {
      return error.message;
    }

    await loadReceipt(receiptId);

    return null;
  }

  async function cancelReceipt(
    receiptId: string
  ) {
    const { error } =
      await supabase.rpc(
        "cancel_receipt",
        {
          p_receipt_id: receiptId,
        }
      );

    if (error) {
      return error.message;
    }

    await loadReceipt(receiptId);

    return null;
  }

  return (
    <ReceiptContext.Provider
      value={{
        receipt,
        loading,
        scanning,

        loadReceipt,
        clearReceipt,
        subscribeToReceipt,
        scanReceipt,
        claimItem,
        unclaimItem,
        updateTaxTip,
        finalizeReceipt,
        cancelReceipt,
      }}
    >
      {children}
    </ReceiptContext.Provider>
  );
}

export function useReceipt() {
  const context = useContext(
    ReceiptContext
  );

  if (!context) {
    throw new Error(
      "useReceipt must be used within a ReceiptProvider"
    );
  }

  return context;
}
