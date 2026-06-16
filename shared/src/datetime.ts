const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const pad2 = (value: number) => String(value).padStart(2, "0");

const toDate = (value: Date | string | number): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * Formats a datetime as `2026 Jun, 25. 20:00:00` using the runtime's local timezone.
 * Deterministic across server and client (no locale APIs).
 */
export const formatDateTime = (value: Date | string | number): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const month = MONTH_LABELS[date.getMonth()];
  if (!month) {
    return "Invalid date";
  }

  return `${date.getFullYear()} ${month} ${date.getDate()} - ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
};

/**
 * Compact datetime for tight UI columns: `Jun 25, 20:00`.
 * Appends a 2-digit year when the date is not in the current calendar year.
 */
export const formatCompactDateTime = (value: Date | string | number): string => {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  const month = MONTH_LABELS[date.getMonth()];
  if (!month) {
    return "Invalid date";
  }

  const yearSuffix =
    date.getFullYear() !== new Date().getFullYear()
      ? ` '${String(date.getFullYear()).slice(-2)}`
      : "";

  return `${month} ${date.getDate()}${yearSuffix}, ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

/** Formats nullable ISO datetime strings; returns `fallback` when value is missing. */
export const formatNullableDateTime = (
  value: string | null | undefined,
  fallback = "N/A",
): string => {
  if (!value) {
    return fallback;
  }
  return formatDateTime(value);
};
