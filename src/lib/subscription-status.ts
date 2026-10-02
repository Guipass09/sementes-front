export type SubscriptionUrgency = "active" | "soon" | "urgent" | "expired" | "suspended" | "pending" | "legacy" | "clinic" | "not_applicable" | "unknown";

export function subscriptionUrgency(subscription?: { status: string; expires_at: string | null }, now = Date.now()): SubscriptionUrgency {
  if (!subscription) return "unknown";
  if (["suspended", "pending", "legacy", "clinic", "not_applicable"].includes(subscription.status)) return subscription.status as SubscriptionUrgency;
  if (!subscription.expires_at) return "pending";
  const remaining = Date.parse(subscription.expires_at) - now;
  if (!Number.isFinite(remaining)) return "unknown";
  if (remaining <= 0 || subscription.status === "expired") return "expired";
  if (remaining <= 86400000) return "urgent";
  if (remaining <= 7 * 86400000) return "soon";
  return "active";
}
