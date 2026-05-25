type FormatCompactIdOptions = {
  leadingChars?: number;
  trailingChars?: number;
  minimumLength?: number;
};

type FormatHighlightedIdOptions = FormatCompactIdOptions & {
  highlightWhenShort?: boolean;
};

export type HighlightedIdParts = {
  leading: string;
  middle: string;
  trailing: string;
  isHighlighted: boolean;
};

const DEFAULT_LEADING_CHARS = 6;
const DEFAULT_TRAILING_CHARS = 4;
const DEFAULT_MINIMUM_LENGTH = 12;

export const formatCompactId = (value: string, options: FormatCompactIdOptions = {}): string => {
  const {
    leadingChars = DEFAULT_LEADING_CHARS,
    trailingChars = DEFAULT_TRAILING_CHARS,
    minimumLength = DEFAULT_MINIMUM_LENGTH,
  } = options;

  if (value.length <= minimumLength) {
    return value;
  }

  return `${value.slice(0, leadingChars)}...${value.slice(-trailingChars)}`;
};

export const formatNullableCompactId = (
  value: string | null | undefined,
  fallback = "—",
  options: FormatCompactIdOptions = {},
): string => {
  if (!value) {
    return fallback;
  }

  return formatCompactId(value, options);
};

export const formatHighlightedId = (
  value: string,
  options: FormatHighlightedIdOptions = {},
): HighlightedIdParts => {
  const {
    leadingChars = DEFAULT_LEADING_CHARS,
    trailingChars = DEFAULT_TRAILING_CHARS,
    minimumLength = DEFAULT_MINIMUM_LENGTH,
    highlightWhenShort = false,
  } = options;

  if (value.length <= minimumLength) {
    return {
      leading: "",
      middle: value,
      trailing: "",
      isHighlighted: highlightWhenShort,
    };
  }

  const safeLeadingChars = Math.max(0, Math.min(leadingChars, value.length));
  const safeTrailingChars = Math.max(0, Math.min(trailingChars, value.length - safeLeadingChars));

  const leading = value.slice(0, safeLeadingChars);
  const middle = value.slice(safeLeadingChars, value.length - safeTrailingChars);
  const trailing = value.slice(value.length - safeTrailingChars);

  return {
    leading,
    middle,
    trailing,
    isHighlighted: true,
  };
};

export const formatNullableHighlightedId = (
  value: string | null | undefined,
  fallback = "—",
  options: FormatHighlightedIdOptions = {},
): HighlightedIdParts => {
  if (!value) {
    return {
      leading: "",
      middle: fallback,
      trailing: "",
      isHighlighted: false,
    };
  }

  return formatHighlightedId(value, options);
};
