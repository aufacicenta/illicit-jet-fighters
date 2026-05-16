export const APP_DEFAULTS = {
  seed: 1337,
  preferredAgentKey: "iron-jackal",
  preferredBattlefieldKeys: ["the-prism", "the-dish-no-walls", "classic-arena"],
  fallbackBattlefieldKey: "classic-arena",
} as const;

const pickFirstExistingKey = <T>(registry: Record<string, T>, keys: readonly string[]): string | null => {
  for (const key of keys) {
    if (registry[key]) return key;
  }
  return null;
};

export const resolveDefaultAgentKey = <T>(
  registry: Record<string, T>,
  fallbackKey: string,
): string => (registry[APP_DEFAULTS.preferredAgentKey] ? APP_DEFAULTS.preferredAgentKey : fallbackKey);

export const resolveDefaultBattlefieldKey = <T>(
  registry: Record<string, T>,
  fallbackKey?: string,
): string | null => {
  return (
    pickFirstExistingKey(registry, APP_DEFAULTS.preferredBattlefieldKeys) ??
    (fallbackKey && registry[fallbackKey] ? fallbackKey : null) ??
    Object.keys(registry)[0] ??
    null
  );
};
