import type { Transaction } from "../context/EventContext";
import {
  calculatePairwiseBalances,
  calculatePersonalBalances,
  isOutstanding,
} from "./balances";

function makeTransaction(
  overrides: Partial<Transaction>
): Transaction {
  return {
    id: "tx-1",
    debtorId: "alice",
    creditorId: "bob",
    debtorName: "Alice",
    creditorName: "Bob",
    amountInPence: 1000,
    description: "Test transaction",
    createdAt: "2026-01-01T00:00:00Z",
    status: "confirmed",
    ...overrides,
  };
}

describe("isOutstanding", () => {
  it("treats confirmed and payment_pending as outstanding", () => {
    expect(
      isOutstanding("confirmed")
    ).toBe(true);

    expect(
      isOutstanding(
        "payment_pending"
      )
    ).toBe(true);
  });

  it("treats every other status as not outstanding", () => {
    expect(
      isOutstanding("pending")
    ).toBe(false);

    expect(
      isOutstanding("rejected")
    ).toBe(false);

    expect(
      isOutstanding("settled")
    ).toBe(false);

    expect(
      isOutstanding("cancelled")
    ).toBe(false);
  });
});

describe("calculatePairwiseBalances", () => {
  it("returns an empty object for no transactions", () => {
    expect(
      calculatePairwiseBalances([])
    ).toEqual({});
  });

  it("credits the lexicographically smaller id when they're the debtor", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          debtorId: "alice",
          creditorId: "bob",
          amountInPence: 500,
        }),
      ]);

    expect(result).toEqual({
      "alice|bob": 500,
    });
  });

  it("flips the sign when the lexicographically larger id is the debtor", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          debtorId: "bob",
          creditorId: "alice",
          amountInPence: 500,
        }),
      ]);

    expect(result).toEqual({
      "alice|bob": -500,
    });
  });

  it("nets multiple transactions between the same pair", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          debtorId: "alice",
          creditorId: "bob",
          amountInPence: 1000,
        }),
        makeTransaction({
          debtorId: "bob",
          creditorId: "alice",
          amountInPence: 400,
        }),
      ]);

    expect(result).toEqual({
      "alice|bob": 600,
    });
  });

  it("can net a pair down to exactly zero", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          debtorId: "alice",
          creditorId: "bob",
          amountInPence: 500,
        }),
        makeTransaction({
          debtorId: "bob",
          creditorId: "alice",
          amountInPence: 500,
        }),
      ]);

    expect(result).toEqual({
      "alice|bob": 0,
    });
  });

  it("keeps different pairs independent", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          debtorId: "alice",
          creditorId: "bob",
          amountInPence: 500,
        }),
        makeTransaction({
          debtorId: "carol",
          creditorId: "bob",
          amountInPence: 300,
        }),
      ]);

    expect(result).toEqual({
      "alice|bob": 500,
      "bob|carol": -300,
    });
  });

  it("ignores transactions that aren't outstanding", () => {
    const result =
      calculatePairwiseBalances([
        makeTransaction({
          status: "pending",
        }),
        makeTransaction({
          status: "rejected",
        }),
        makeTransaction({
          status: "settled",
        }),
        makeTransaction({
          status: "cancelled",
        }),
      ]);

    expect(result).toEqual({});
  });
});

describe("calculatePersonalBalances", () => {
  it("returns an empty object for no transactions", () => {
    expect(
      calculatePersonalBalances(
        [],
        "alice"
      )
    ).toEqual({});
  });

  it("is negative when the current user is the debtor", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            debtorId: "alice",
            creditorId: "bob",
            amountInPence: 700,
          }),
        ],
        "alice"
      );

    expect(result).toEqual({
      bob: -700,
    });
  });

  it("is positive when the current user is the creditor", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            debtorId: "bob",
            creditorId: "alice",
            amountInPence: 700,
          }),
        ],
        "alice"
      );

    expect(result).toEqual({
      bob: 700,
    });
  });

  it("ignores transactions the current user isn't a party to", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            debtorId: "bob",
            creditorId: "carol",
            amountInPence: 700,
          }),
        ],
        "alice"
      );

    expect(result).toEqual({});
  });

  it("nets multiple transactions with the same counterparty", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            debtorId: "alice",
            creditorId: "bob",
            amountInPence: 1000,
          }),
          makeTransaction({
            debtorId: "bob",
            creditorId: "alice",
            amountInPence: 400,
          }),
        ],
        "alice"
      );

    expect(result).toEqual({
      bob: -600,
    });
  });

  it("aggregates across what would be multiple events without any special casing", () => {
    // Simulates the cross-event Balances screen: transactions
    // from different events, same counterparty, just
    // concatenated into one array before calling this.
    const eventOneTransactions = [
      makeTransaction({
        id: "tx-a",
        debtorId: "alice",
        creditorId: "bob",
        amountInPence: 1000,
      }),
    ];

    const eventTwoTransactions = [
      makeTransaction({
        id: "tx-b",
        debtorId: "bob",
        creditorId: "alice",
        amountInPence: 300,
      }),
    ];

    const result =
      calculatePersonalBalances(
        [
          ...eventOneTransactions,
          ...eventTwoTransactions,
        ],
        "alice"
      );

    expect(result).toEqual({
      bob: -700,
    });
  });

  it("keeps different counterparties independent", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            debtorId: "alice",
            creditorId: "bob",
            amountInPence: 500,
          }),
          makeTransaction({
            debtorId: "carol",
            creditorId: "alice",
            amountInPence: 200,
          }),
        ],
        "alice"
      );

    expect(result).toEqual({
      bob: -500,
      carol: 200,
    });
  });

  it("ignores transactions that aren't outstanding", () => {
    const result =
      calculatePersonalBalances(
        [
          makeTransaction({
            status: "pending",
            debtorId: "alice",
            creditorId: "bob",
          }),
          makeTransaction({
            status: "settled",
            debtorId: "alice",
            creditorId: "bob",
          }),
        ],
        "alice"
      );

    expect(result).toEqual({});
  });
});
