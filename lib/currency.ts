export type Currency = {
  code: string;
  name: string;
  symbol: string;
};

export const COMMON_CURRENCIES: Currency[] = [
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺" },
  { code: "THB", name: "Thai Baht", symbol: "฿" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$" },
  { code: "INR", name: "Indian Rupee", symbol: "₹" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "KRW", name: "South Korean Won", symbol: "₩" },
  { code: "ILS", name: "Israeli Shekel", symbol: "₪" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "VND", name: "Vietnamese Dong", symbol: "₫" },
];

const CURRENCY_BY_CODE = new Map<string, Currency>(
  COMMON_CURRENCIES.map((currency) => [
    currency.code,
    currency,
  ])
);

export function getCurrencySymbol(
  code: string
): string {
  return (
    CURRENCY_BY_CODE.get(code)?.symbol ?? code
  );
}

export function getCurrencyName(
  code: string
): string {
  return (
    CURRENCY_BY_CODE.get(code)?.name ?? code
  );
}

export function formatCurrencyAmount(
  amount: number,
  code: string
): string {
  return `${getCurrencySymbol(code)}${amount.toFixed(2)}`;
}

export function formatCurrencyFromPence(
  amountInPence: number,
  code: string
): string {
  return formatCurrencyAmount(
    amountInPence / 100,
    code
  );
}

export async function fetchExchangeRate(
  from: string,
  to: string
): Promise<number> {
  if (from === to) {
    return 1;
  }

  let response: Response;

  try {
    response = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=${from}&symbols=${to}`
    );
  } catch {
    throw new Error(
      `Could not reach the exchange rate service. Check your connection and try again.`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Could not fetch the ${from} to ${to} exchange rate right now.`
    );
  }

  const data = await response.json();

  const rate = data?.rates?.[to];

  if (typeof rate !== "number") {
    throw new Error(
      `No exchange rate available for ${from} to ${to}.`
    );
  }

  return rate;
}
