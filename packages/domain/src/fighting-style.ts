/**
 * Whether a build has a fighting style, by id ("archery", "defense").
 *
 * 2014 keeps styles as optional features and 2024 as feats; the id is the same
 * slug either way, so both lists are asked.
 */
export function hasFightingStyle(
  choices: { feats?: readonly string[]; optionalFeatures?: readonly string[] },
  id: string,
): boolean {
  return Boolean(choices.feats?.includes(id) || choices.optionalFeatures?.includes(id));
}
