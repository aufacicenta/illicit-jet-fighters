export interface MatchResultPayload {
  winnerId: string | null;
  replayHashHex: string;
  replayLength: number;
  endedAt: number;
}

export const submitResult = (result: MatchResultPayload): void => {
  // Post-MVP adapter boundary. Replace this with chain/oracle calls later.
  console.info("Settlement adapter placeholder", result);
};
