const ADJECTIVES = [
  "iron",
  "shadow",
  "phantom",
  "crimson",
  "steel",
  "rogue",
  "storm",
  "silent",
  "night",
  "scarlet",
  "arctic",
  "obsidian",
  "rapid",
  "blazing",
  "vigilant",
  "grim",
  "frost",
  "ruthless",
  "golden",
  "nova",
  "striker",
  "tactical",
  "covert",
  "prime",
  "onyx",
  "aerial",
  "velocity",
  "battle",
  "radar",
  "eclipse",
] as const;

const NOUNS = [
  "jackal",
  "hawk",
  "viper",
  "talon",
  "cobra",
  "wolf",
  "falcon",
  "raptor",
  "mamba",
  "panther",
  "comet",
  "wraith",
  "anvil",
  "reaper",
  "hornet",
  "hyena",
  "cyclone",
  "kraken",
  "tiger",
  "raven",
  "dagger",
  "raider",
  "sentinel",
  "mirage",
  "avenger",
  "nomad",
  "lancer",
  "specter",
  "blitz",
  "phoenix",
] as const;

const ALPHANUM = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

function randomAlphanumeric(length: number): string {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += ALPHANUM[randomInt(ALPHANUM.length)];
  }
  return value;
}

export function generateFighterSlug(): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const noun = NOUNS[randomInt(NOUNS.length)];
  return `${adjective}-${noun}-${randomAlphanumeric(3)}`;
}

export async function generateUniqueFighterSlug(
  isTaken: (slug: string) => Promise<boolean>,
  maxAttempts = 8,
): Promise<string> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const slug = generateFighterSlug();
    if (!(await isTaken(slug))) {
      return slug;
    }
  }

  throw new Error("Unable to generate a unique fighter slug after maximum retries.");
}
