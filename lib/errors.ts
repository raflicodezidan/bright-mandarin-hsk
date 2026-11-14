export function databaseErrorMessage(
  error: { message: string } | null,
  fallback: string,
): string {
  if (!error) return fallback;
  const message = error.message.replace(/^P0001:\s*/, "").trim();
  return message.length > 0 ? message : fallback;
}
