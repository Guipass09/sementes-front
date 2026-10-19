export type SharingProfessional = {
  share_id: string;
  name: string;
  registration: string | null;
  profile_photo_url: string | null;
};

export function normalizedSharingId(value: string): string | null {
  const compact = value.trim().replace(/[\s-]+/g, "").toUpperCase();
  if (!/^SF[A-F0-9]{12}$/.test(compact)) return null;
  return `SF-${compact.slice(2, 6)}-${compact.slice(6, 10)}-${compact.slice(10, 14)}`;
}

export function shareRecipientPayload(recipient: string | number[]): { professional_share_id: string } | { professional_ids: number[] } {
  return typeof recipient === "string" ? { professional_share_id: recipient } : { professional_ids: recipient };
}
