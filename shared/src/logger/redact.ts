// Central secret redaction for the logger.
//
// Two complementary strategies:
//  - Value-based: known secret values (mnemonics, service secrets) are registered
//    at startup and scrubbed from the final log line regardless of how they got
//    there (meta, error message, stack, cause, nested object dump, ...).
//  - Key-based: log-meta keys whose name looks like a secret are replaced before
//    serialization, as defense in depth for values we never explicitly registered.

const registeredSecrets = new Set<string>();

// Avoid redacting trivial/short values (e.g. dev placeholders like "123") that
// would otherwise turn normal log output into a wall of [REDACTED].
const MIN_SECRET_LENGTH = 6;

const REDACTED = "[REDACTED]";

const SECRET_KEY_PATTERN =
  /(mnemonic|secret|passphrase|password|seed|private[_-]?key|api[_-]?key|access[_-]?key|auth(?:orization)?|token|credential)/i;

export const registerSecret = (value: string | undefined | null): void => {
  if (typeof value !== "string") {
    return;
  }
  const trimmed = value.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) {
    return;
  }
  registeredSecrets.add(trimmed);
};

export const registerSecrets = (values: Array<string | undefined | null>): void => {
  for (const value of values) {
    registerSecret(value);
  }
};

export const isSecretKey = (key: string): boolean => SECRET_KEY_PATTERN.test(key);

// Scrub every registered secret value from arbitrary text. Uses split/join
// (not RegExp) so secret values containing regex-special characters are handled
// literally and safely.
export const redactSecretsFromText = (text: string): string => {
  if (registeredSecrets.size === 0) {
    return text;
  }
  let output = text;
  for (const secret of registeredSecrets) {
    if (output.includes(secret)) {
      output = output.split(secret).join(REDACTED);
    }
  }
  return output;
};
