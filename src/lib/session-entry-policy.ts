export type SessionEntryMode = "wait" | "invite" | "account";

export function sessionEntryMode(authLoading: boolean, hasUser: boolean, inviteToken: string | null): SessionEntryMode {
  if (authLoading) return "wait";
  // An explicit patient invitation must be validated instead of reusing another signed-in account.
  if (inviteToken?.trim()) return "invite";
  return hasUser ? "account" : "wait";
}

export function sessionForbiddenMessage(message: unknown): string {
  const text = typeof message === "string" ? message.trim() : "";
  if (/^(forbidden|unauthorized|access denied)[.!]?$/i.test(text))
    return "Esta sessão não está vinculada à conta que está aberta. Entre com a conta do paciente ou abra o link de convite completo.";
  return text || "Essa sessão ainda não está disponível. Tente mais perto do horário.";
}
