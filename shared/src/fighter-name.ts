const NAME_HEADING_REGEX = /^#\s+(.+)$/m;
const EPITHET_QUOTE_REGEX = /^>\s+"?(.+?)"?$/m;

const normalizeValue = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const parseFighterNameAndEpithet = (markdown: string | null | undefined) => {
  if (!markdown) {
    return { name: null, epithet: null };
  }

  const nameMatch = markdown.match(NAME_HEADING_REGEX);
  const quoteMatch = markdown.match(EPITHET_QUOTE_REGEX);

  return {
    name: normalizeValue(nameMatch?.[1]),
    epithet: normalizeValue(quoteMatch?.[1]),
  };
};

export const resolveFighterName = ({
  storedName,
  characterDescription,
  slug,
}: {
  storedName: string | null | undefined;
  characterDescription: string | null | undefined;
  slug: string;
}): string => {
  const parsedName = parseFighterNameAndEpithet(characterDescription).name;
  return normalizeValue(storedName) ?? parsedName ?? slug;
};

export const formatFighterDisplayLabel = ({
  fighterName,
  fighterId,
  agentVersionNumber,
}: {
  fighterName: string;
  fighterId: number;
  agentVersionNumber: number | null;
}): string => {
  const base = `${fighterName} #${fighterId}`;
  return agentVersionNumber !== null ? `${base} v${agentVersionNumber}` : base;
};
