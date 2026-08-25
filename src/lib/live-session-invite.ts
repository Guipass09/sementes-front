export const LIVE_SESSION_INVITE_MESSAGE =
  "Para entrar no atendimento, clique no link e depois em participar, caso peça para autorizar camera ou microfone é necessario permitir 💚";

export function buildLiveSessionInviteUrl(appointmentId: number, inviteToken: string, origin = window.location.origin): string {
  const url = new URL(origin);
  url.pathname = `/convite-sessao/${appointmentId}`;
  url.searchParams.set("invite_token", inviteToken);
  return url.toString();
}

export function buildLiveSessionInviteShareText(link: string): string {
  return `${LIVE_SESSION_INVITE_MESSAGE}\n\n${link}`;
}
