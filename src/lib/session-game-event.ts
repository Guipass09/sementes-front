export function isCurrentSessionGameEvent(
  active: { path: string; share_id: string } | null,
  payload: { path?: string; share_id?: string } | null | undefined,
): boolean {
  return !!active && payload?.path === active.path && payload?.share_id === active.share_id;
}
