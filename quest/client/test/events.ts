// Builds event envelopes for the director's tests, each with a fresh ID.
import type { EventHeader, QuestEvent } from "@quest/contract";

let sequence = 0;

export function envelope<E extends QuestEvent>(
  event: E,
  revision = 1,
): EventHeader & E {
  sequence += 1;
  const header: EventHeader = {
    id: `test.${String(sequence)}`,
    revision,
    serverTime: 0,
  };
  return { ...header, ...event };
}
