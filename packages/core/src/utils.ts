/**
 * Capitalizes the first letter of a string and lowercases the rest.
 * @param val - The string to capitalize
 * @returns The capitalized string
 */
export function capitalize(val: string) {
  return val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
}
