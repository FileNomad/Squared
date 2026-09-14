import { Ionicons } from "@expo/vector-icons";

export type TransactionCategory =
  | "food"
  | "transport"
  | "accommodation"
  | "bills"
  | "entertainment"
  | "other";

export type CategoryDefinition = {
  value: TransactionCategory;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const TRANSACTION_CATEGORIES: CategoryDefinition[] =
  [
    {
      value: "food",
      label: "Food",
      icon: "restaurant-outline",
      color: "#F59E0B",
    },
    {
      value: "transport",
      label: "Transport",
      icon: "car-outline",
      color: "#3B82F6",
    },
    {
      value: "accommodation",
      label: "Accommodation",
      icon: "bed-outline",
      color: "#8B5CF6",
    },
    {
      value: "bills",
      label: "Bills",
      icon: "receipt-outline",
      color: "#EC4899",
    },
    {
      value: "entertainment",
      label: "Entertainment",
      icon: "film-outline",
      color: "#10B981",
    },
    {
      value: "other",
      label: "Other",
      icon: "ellipsis-horizontal-outline",
      color: "#9CA3AF",
    },
  ];

const CATEGORY_BY_VALUE = new Map<
  TransactionCategory,
  CategoryDefinition
>(
  TRANSACTION_CATEGORIES.map(
    (category) => [
      category.value,
      category,
    ]
  )
);

export function getCategoryDefinition(
  category: TransactionCategory
): CategoryDefinition {
  return (
    CATEGORY_BY_VALUE.get(category) ??
    CATEGORY_BY_VALUE.get("other")!
  );
}

export function getCategoryDisplayLabel(
  category: TransactionCategory,
  customLabel: string | null
): string {
  if (
    category === "other" &&
    customLabel
  ) {
    return customLabel;
  }

  return getCategoryDefinition(category)
    .label;
}
