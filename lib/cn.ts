/**
 * Minimal className combiner — joins truthy values with a space.
 * No tailwind-merge: later utilities passed via `className` naturally win
 * in source order, which is enough for our component variants.
 */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}
