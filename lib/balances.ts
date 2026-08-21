import type {
  Transaction,
  TransactionStatus,
} from "../context/EventContext";

const OUTSTANDING_STATUSES: TransactionStatus[] =
  ["confirmed", "payment_pending"];

export function isOutstanding(
  status: TransactionStatus
): boolean {
  return OUTSTANDING_STATUSES.includes(
    status
  );
}

/**
 * All pairwise balances among any two people appearing in
 * the given transactions, regardless of whether either of
 * them is the caller - used for a single event's "everyone
 * vs everyone" Net Balance section.
 *
 * Keyed by "smallerId|largerId" (ids sorted
 * lexicographically). A positive value means the
 * lexicographically smaller id is owed money by the larger
 * one; negative means the reverse. This sign convention is
 * arbitrary but must stay consistent with how callers
 * resolve it back into "X owes Y" - see
 * app/events/[id]/index.tsx.
 */
export function calculatePairwiseBalances(
  transactions: Transaction[]
): Record<string, number> {
  const balances: Record<
    string,
    number
  > = {};

  transactions.forEach(
    (transaction) => {
      if (
        !isOutstanding(
          transaction.status
        )
      ) {
        return;
      }

      const pair = [
        transaction.debtorId,
        transaction.creditorId,
      ]
        .sort()
        .join("|");

      const direction =
        transaction.debtorId <
        transaction.creditorId
          ? 1
          : -1;

      balances[pair] =
        (balances[pair] || 0) +
        transaction.amountInPence *
          direction;
    }
  );

  return balances;
}

/**
 * Net balance between the given user and every other person
 * they have an outstanding transaction with, across however
 * many transactions are passed in - a single event's, or
 * every event's combined (that's what makes the cross-event
 * Balances screen just an aggregation, not a special case).
 *
 * Positive means the counterparty owes the user; negative
 * means the user owes the counterparty. Transactions not
 * involving the user are ignored.
 */
export function calculatePersonalBalances(
  transactions: Transaction[],
  currentUserId: string
): Record<string, number> {
  const balances: Record<
    string,
    number
  > = {};

  transactions.forEach(
    (transaction) => {
      if (
        !isOutstanding(
          transaction.status
        )
      ) {
        return;
      }

      const isDebtor =
        transaction.debtorId ===
        currentUserId;

      const isCreditor =
        transaction.creditorId ===
        currentUserId;

      if (
        !isDebtor &&
        !isCreditor
      ) {
        return;
      }

      const counterpartyId =
        isDebtor
          ? transaction.creditorId
          : transaction.debtorId;

      const delta = isDebtor
        ? -transaction.amountInPence
        : transaction.amountInPence;

      balances[counterpartyId] =
        (balances[
          counterpartyId
        ] ?? 0) + delta;
    }
  );

  return balances;
}
