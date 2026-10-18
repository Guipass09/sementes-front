export function newestFirst<T>(items: readonly T[], dateOf: (item: T) => string | null | undefined): T[] {
  const timestamp = (item: T) => {
    const date = dateOf(item);
    const value = date ? Date.parse(date) : NaN;
    return Number.isFinite(value) ? value : 0;
  };
  return [...items].sort((a, b) => timestamp(b) - timestamp(a));
}
