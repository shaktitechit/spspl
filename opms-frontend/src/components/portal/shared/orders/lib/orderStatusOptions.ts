/**
 * Centralized order filter options (priorities, status option types).
 */

export type StatusOption = { value: string; label: string };

/**
 * Priority options – shared across all departments.
 */
export const PRIORITY_OPTIONS: StatusOption[] = [
  { value: "low",    label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high",   label: "High" },
  { value: "urgent", label: "Urgent" },
];
