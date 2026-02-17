import { createAvatar } from "@dicebear/core";
import { avataaars } from "@dicebear/collection";

/**
 * Generate a deterministic avatar data URI from a seed string.
 * Uses the avataaars style to match the previous HTTP API behaviour.
 */
export function generateAvatarDataUri(seed: string): string {
  return createAvatar(avataaars, {
    seed,
    randomizeIds: true,
    backgroundColor: ["transparent"],
  }).toDataUri();
}
