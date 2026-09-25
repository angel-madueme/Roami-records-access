import { customAlphabet } from "nanoid";

const PUBLIC_ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const generateNanoid = customAlphabet(PUBLIC_ID_ALPHABET, 12);

/** Generates the only external identifier exposed for a SavedPlace. */
export function generatePublicId(): string {
  return generateNanoid();
}
