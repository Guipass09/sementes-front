import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import FullScreenLogoLoader from "@/components/FullScreenLogoLoader";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import * as api from "@/lib/laravel-api";

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  } catch {}
  return `idemp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function ensureMercadoPagoSdk(): Promise<void> {
  if ((window as any).MercadoPago) return;
  await new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if ((window as any).MercadoPago) return resolve();
      if (Date.now() - t0 > 15000) return reject(new Error("sdk_timeout"));
      setTimeout(tick, 120);
    };
    tick();
  });
}

export default function AppointmentPaymentPage(): JSX.Element {
  const { id } = useParams();
  const appointmentId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  const [searchParams] = useSearchParams();
  const inviteToken = useMemo(() => {
    const t = (searchParams.get("invite_token") || searchParams.get("invite") || searchParams.get("token") || "").trim();
    return t ? t : null;
  }, [searchParams]);

  const auth = useAuth();
  const { user } = auth;
  const { toast } = useToast();

  // Gate (deslogado): confirmar e-mail para autenticar via invite.
  const [inviteAuthBusy, setInviteAuthBusy] = useState(false);
  const [pageAuthToken, setPageAuthToken] = useState<string | null>(null);
  const [pageAuthUser, setPageAuthUser] = useState<any | null>(null);

  const [loadingInfo, setLoadingInfo] = useState(true);
  const [info, setInfo] = useState<null | {
    payment_required: boolean;
    amount: number | null;
    sessions: number | null;
    paid: boolean;
    status?: string | null;
    status_detail?: string | null;
  }>(null);

  const publicKey = String((import.meta as any).env?.VITE_MP_PUBLIC_KEY ?? "").trim();

  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusHint, setStatusHint] = useState<string>("");
  const [pix, setPix] = useState<null | { qr_code: string; qr_code_base64: string }>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [brickNonce, setBrickNonce] = useState(0);

  // Dados do pagador (obrigatório antes do método)
  const [payerName, setPayerName] = useState<string>("");
  const [payerEmail, setPayerEmail] = useState<string>("");
  const [payerCpfRaw, setPayerCpfRaw] = useState<string>("");
  const payerCpfDigits = useMemo(() => payerCpfRaw.replace(/\D/g, "").slice(0, 11), [payerCpfRaw]);
  const payerCpfMasked = useMemo(() => {
    const d = payerCpfDigits;
    if (!d) return "";
    const p1 = d.slice(0, 3);
    const p2 = d.slice(3, 6);
    const p3 = d.slice(6, 9);
    const p4 = d.slice(9, 11);
    let out = p1;
    if (p2) out += `.${p2}`;
    if (p3) out += `.${p3}`;
    if (p4) out += `-${p4}`;
    return out;
  }, [payerCpfDigits]);

  const payerNameRef = useRef("");
  const payerEmailRef = useRef("");
  const payerCpfDigitsRef = useRef("");
  useEffect(() => {
    payerNameRef.current = payerName;
  }, [payerName]);
  useEffect(() => {
    payerEmailRef.current = payerEmail;
  }, [payerEmail]);
  useEffect(() => {
    payerCpfDigitsRef.current = payerCpfDigits;
  }, [payerCpfDigits]);

  const brickContainerId = useMemo(
    () => `cardPaymentBrick_page_${appointmentId ?? "x"}_${brickNonce}`,
    [appointmentId, brickNonce]
  );

  const resetPayment = useCallback(() => {
    setBusy(false);
    setError("");
    setStatusHint("");
    setPix(null);
    setProviderPaymentId(null);
    setWaiting(false);
    setPaid(false);
  }, []);

  const loadInfo = useCallback(async () => {
    if (!appointmentId) return;
    setLoadingInfo(true);
    try {
      const s: any = pageAuthToken
        ? await api.paymentsStatusWithAuth(pageAuthToken, { appointment_id: appointmentId })
        : await api.paymentsStatus({ appointment_id: appointmentId });
      setInfo({
        payment_required: !!s.payment_required,
        amount: typeof s.amount === "number" ? s.amount : s.amount != null ? Number(s.amount) : null,
        sessions: typeof s.sessions === "number" ? s.sessions : s.sessions != null ? Number(s.sessions) : null,
        paid: !!s.paid,
        status: s.status ?? null,
        status_detail: s.status_detail ?? null,
      });
      if (s.paid) setPaid(true);
    } catch (e: any) {
      setInfo(null);
      setError(e?.data?.message || "Não foi possível carregar o pagamento agora.");
    } finally {
      setLoadingInfo(false);
    }
  }, [appointmentId, pageAuthToken]);

  useEffect(() => {
    const u = pageAuthUser || user;
    setPayerName(String(u?.name ?? "").trim());
    setPayerEmail(String(u?.email ?? "").trim());
  }, [user?.email, user?.name, pageAuthUser]);

  // auth via invite (SEM e-mail) para link público de pagamento
  useEffect(() => {
    if (!appointmentId) return;
    if (!inviteToken) return;
    if (pageAuthToken) return;
    // Se já é paciente logado, não precisa.
    if (user && (user as any).role === "user") return;

    let cancelled = false;
    setInviteAuthBusy(true);
    setError("");
    void api
      .appointmentInviteAuthPublic({ appointment_id: appointmentId, invite_token: inviteToken })
      .then((res) => {
        if (cancelled) return;
        setPageAuthToken(String(res.token || "").trim());
        setPageAuthUser(res.user as any);
      })
      .catch((err: any) => {
        if (cancelled) return;
        toast({
          title: "Acesso",
          description: err?.data?.message || "Não foi possível validar o link de pagamento.",
          variant: "destructive",
        });
      })
      .finally(() => {
        if (cancelled) return;
        setInviteAuthBusy(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appointmentId, inviteToken, pageAuthToken, toast, user]);

  // Poll de status enquanto aguardando (pix ou cartão pendente)
  useEffect(() => {
    if (!appointmentId) return;
    if (!waiting) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      const req = pageAuthToken
        ? api.paymentsStatusWithAuth(pageAuthToken, { appointment_id: appointmentId })
        : api.paymentsStatus({ appointment_id: appointmentId });
      void req
        .then((s: any) => {
          if (cancelled) return;
          if (s.paid) {
            setPaid(true);
            setWaiting(false);
            toast({ title: "Pagamento", description: "Pagamento confirmado." });
            return;
          }
          const st = String(s.status || "");
          if (st === "rejected" || st === "cancelled") {
            setWaiting(false);
            setError("Pagamento recusado. Confira os dados e tente novamente.");
            setStatusHint(String(s.status_detail || ""));
          }
        })
        .catch(() => {});
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [waiting, appointmentId, toast, pageAuthToken]);

  // Card Brick
  useEffect(() => {
    if (!appointmentId) return;
    const tokenToUse = pageAuthToken || null;
    const canPay = (user && (user as any).role === "user") || !!tokenToUse;
    if (!canPay) return;
    if (paid) return;
    if (tab !== "card") return;
    if (!publicKey) return;
    const amount = info?.amount ?? null;
    if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0)) return;

    let cancelled = false;
    (async () => {
      try {
        await ensureMercadoPagoSdk();
        if (cancelled) return;

        try {
          (window as any).cardPaymentBrickController?.unmount?.();
        } catch {}

        const mp = new (window as any).MercadoPago(publicKey);
        const bricksBuilder = mp.bricks();

        const init: any = { amount };
        const email = payerEmailRef.current.trim();
        if (email) init.payer = { ...(init.payer || {}), email };
        const cpfDigits = payerCpfDigitsRef.current;
        if (cpfDigits) {
          init.payer = {
            ...(init.payer || {}),
            identification: { type: "CPF", number: cpfDigits },
          };
        }

        const settings = {
          initialization: init,
          customization: {
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: 12,
            },
          },
          callbacks: {
            onReady: () => {},
            onSubmit: (formData: any) => {
              return new Promise<void>((resolve, reject) => {
                const idempotencyKey = uuid();
                setBusy(true);
                setError("");

                const cardPayload = {
                  token: String(formData?.token ?? ""),
                  installments: Number(formData?.installments ?? 1),
                  payment_method_id: String(formData?.payment_method_id ?? formData?.paymentMethodId ?? ""),
                  issuer_id: formData?.issuer_id ?? formData?.issuerId ?? null,
                  identification_type: String(formData?.payer?.identification?.type ?? formData?.identificationType ?? ""),
                  identification_number: String(formData?.payer?.identification?.number ?? formData?.identificationNumber ?? ""),
                };

                const req = tokenToUse
                  ? api.paymentsCreateWithAuth(tokenToUse, {
                      appointment_id: appointmentId,
                      method: "card",
                      payer: {
                        name: payerNameRef.current.trim() || null,
                        email: payerEmailRef.current.trim() || null,
                        identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
                      },
                      card: cardPayload,
                      idempotency_key: idempotencyKey,
                    })
                  : api.paymentsCreate({
                      appointment_id: appointmentId,
                      method: "card",
                      payer: {
                        name: payerNameRef.current.trim() || null,
                        email: payerEmailRef.current.trim() || null,
                        identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
                      },
                      card: cardPayload,
                      idempotency_key: idempotencyKey,
                    });

                void req
                  .then((res) => {
                    const p = res.data;
                    setProviderPaymentId(p.provider_payment_id ?? null);
                    if (p.status === "approved") {
                      setPaid(true);
                      setWaiting(false);
                      toast({ title: "Pagamento", description: "Pagamento aprovado." });
                    } else if (p.status === "rejected" || p.status === "cancelled") {
                      setWaiting(false);
                      setError("Pagamento recusado. Tente novamente.");
                      setStatusHint(String(p.status_detail || ""));
                      toast({ title: "Pagamento", description: "Pagamento recusado. Tente novamente.", variant: "destructive" });
                    } else {
                      toast({ title: "Pagamento", description: "Pagamento enviado. Aguardando confirmação..." });
                      setWaiting(true);
                    }
                    resolve();
                  })
                  .catch(() => {
                    setError("Não foi possível processar o pagamento no momento.");
                    reject();
                  })
                  .finally(() => setBusy(false));
              });
            },
            onError: (err: any) => {
              console.error("[MP Brick]", err);
              setError("Erro no formulário de pagamento. Confira os dados e tente novamente.");
            },
          },
        };

        (window as any).cardPaymentBrickController = await bricksBuilder.create("cardPayment", brickContainerId, settings);
      } catch (e) {
        console.error("[MP Brick] falhou", e);
        if (!cancelled) setError("Não foi possível iniciar o Mercado Pago agora. Tente novamente.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        (window as any).cardPaymentBrickController?.unmount?.();
      } catch {}
    };
  }, [appointmentId, user, tab, publicKey, brickContainerId, paid, toast, info?.amount, pageAuthToken]);

  const createPix = useCallback(async () => {
    if (!appointmentId) return;
    setBusy(true);
    setError("");
    setStatusHint("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const tokenToUse = pageAuthToken || null;
      const res = tokenToUse
        ? await api.paymentsCreateWithAuth(tokenToUse, {
            appointment_id: appointmentId,
            method: "pix",
            payer: {
              name: payerNameRef.current.trim() || null,
              email: payerEmailRef.current.trim() || null,
              identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
            },
            idempotency_key: idempotencyKey,
          })
        : await api.paymentsCreate({
            appointment_id: appointmentId,
            method: "pix",
            payer: {
              name: payerNameRef.current.trim() || null,
              email: payerEmailRef.current.trim() || null,
              identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
            },
            idempotency_key: idempotencyKey,
          });
      const p = res.data;
      setProviderPaymentId(p.provider_payment_id ?? null);
      if (p.pix?.qr_code_base64 && p.pix?.qr_code) {
        setPix({ qr_code_base64: p.pix.qr_code_base64, qr_code: p.pix.qr_code });
        setWaiting(true);
      } else {
        setError("Não foi possível gerar o QR Code do Pix.");
      }
    } catch (e: any) {
      setError(e?.data?.message || "Não foi possível gerar o Pix no momento.");
    } finally {
      setBusy(false);
    }
  }, [appointmentId, pageAuthToken]);

  useEffect(() => {
    if (!appointmentId) return;
    const canRead = !!pageAuthToken || (!!user && (user as any).role === "user");
    if (!canRead) return;
    void loadInfo();
  }, [appointmentId, user, pageAuthToken, loadInfo]);

  if (!appointmentId) {
    return <FullScreenLogoLoader label="Pagamento" />;
  }

  const fmt = (n: number | null) =>
    typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  return (
    <div className="min-h-[100svh] bg-gradient-to-b from-brand-green/10 via-background to-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        <div className="flex items-center gap-3">
          <img src={logoImage} alt="Sementes da Fala" className="h-10 w-10 rounded-xl border border-border object-cover" />
          <div className="min-w-0">
            <div className="font-display font-bold text-lg leading-tight">
              <span className="text-brand-green">Sementes</span> <span className="text-brand-brown">da Fala</span>
            </div>
            <div className="text-xs text-muted-foreground">Pagamento seguro</div>
          </div>
          <div className="ml-auto text-right">
            <div className="text-xs text-muted-foreground">Sessão</div>
            <div className="text-sm font-semibold text-foreground">#{appointmentId}</div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[360px_1fr]">
          <div className="rounded-3xl border border-border bg-card/70 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-foreground">Resumo</div>
              <span className="inline-flex items-center rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-xs font-medium text-brand-green">
                Seguro
              </span>
            </div>

            <div className="mt-3 text-4xl font-extrabold tracking-tight text-foreground">
              {paid || info?.paid ? "Pago" : fmt(info?.amount ?? null)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {info?.sessions ? `${info.sessions} sessões` : "—"}
            </div>

            <Separator className="my-4" />

            <div className="text-xs text-muted-foreground leading-relaxed">
              Preencha seus dados, escolha Pix ou Cartão e finalize. Ao aprovar, confirme com a profissional.
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-card p-5 shadow-sm">
          {!user && !pageAuthToken ? (
            inviteToken ? (
              <div className="py-10">
                <FullScreenLogoLoader label={inviteAuthBusy ? "Validando link..." : "Carregando pagamento..."} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Faça login na plataforma para pagar, ou use o link enviado pela profissional/admin.
              </div>
            )
          ) : (
            <>
              {loadingInfo ? (
                <div className="py-10">
                  <FullScreenLogoLoader label="Carregando pagamento..." />
                </div>
              ) : null}

              {paid || info?.paid ? (
                <div className="rounded-2xl border border-brand-green/30 bg-brand-green/10 p-5">
                  <div className="text-xl font-semibold text-foreground">Pagamento realizado com sucesso</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Obrigado! Agora confirme com a profissional.
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">Resumo</div>
                      <div className="text-xs text-muted-foreground">
                        {info?.sessions ? `${info.sessions} sessões` : "Pagamento"} • Valor:{" "}
                        <strong>{fmt(info?.amount ?? null)}</strong>
                      </div>
                      {providerPaymentId ? (
                        <div className="mt-1 text-xs text-muted-foreground">ID do pagamento: {providerPaymentId}</div>
                      ) : null}
                    </div>
                    <span className="inline-flex items-center rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-1 text-xs font-medium text-brand-green">
                      Seguro
                    </span>
                  </div>

                  <Separator className="my-4" />

                  <div className="text-sm font-semibold text-foreground">Dados do pagador</div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nome completo</Label>
                      <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Nome do titular" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>CPF</Label>
                      <Input inputMode="numeric" value={payerCpfMasked} onChange={(e) => setPayerCpfRaw(e.target.value)} placeholder="000.000.000-00" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>E-mail</Label>
                      <Input value={payerEmail} onChange={(e) => setPayerEmail(e.target.value)} placeholder="seu@email.com" inputMode="email" />
                    </div>
                  </div>

                  {error ? (
                    <div className="mt-4">
                      <div className="text-sm text-destructive">{error}</div>
                      {statusHint ? <div className="mt-1 text-xs text-muted-foreground">Detalhe: {statusHint}</div> : null}
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl"
                          onClick={() => {
                            resetPayment();
                            setBrickNonce((v) => v + 1);
                            setTab("card");
                          }}
                          disabled={busy}
                        >
                          Tentar novamente
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <Separator className="my-4" />

                  <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                    <TabsList className="grid w-full grid-cols-2 gap-3 bg-transparent p-0">
                      <TabsTrigger
                        value="pix"
                        className={cn(
                          "h-12 rounded-xl border border-border bg-background data-[state=active]:bg-muted/20",
                          "data-[state=active]:border-brand-green data-[state=active]:text-foreground",
                        )}
                      >
                        Pix
                      </TabsTrigger>
                      <TabsTrigger
                        value="card"
                        className={cn(
                          "h-12 rounded-xl border border-border bg-background data-[state=active]:bg-muted/20",
                          "data-[state=active]:border-brand-green data-[state=active]:text-foreground",
                        )}
                      >
                        Cartão de crédito
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="pix" className="mt-3 space-y-3">
                      {!pix ? (
                        <div className="rounded-xl border border-border bg-muted/10 p-4">
                          <div className="text-sm text-muted-foreground">
                            Gere o QR Code e pague pelo seu banco. Após pagar, a confirmação acontece automaticamente.
                          </div>
                          {!(typeof info?.amount === "number" && Number.isFinite(info.amount) && info.amount > 0) ? (
                            <div className="mt-3 text-sm text-muted-foreground">
                              Valor do pagamento não disponível ainda. Gere o link novamente pelo admin/profissional.
                            </div>
                          ) : null}
                          <div className="mt-4 flex items-center justify-end gap-2">
                            <Button
                              className="rounded-xl"
                              onClick={() => void createPix()}
                              disabled={busy || !(typeof info?.amount === "number" && Number.isFinite(info.amount) && info.amount > 0)}
                            >
                              {busy ? "Gerando..." : "Gerar QR Code"}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border bg-muted/10 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="flex items-center justify-center">
                              <img
                                src={`data:image/png;base64,${pix.qr_code_base64}`}
                                alt="QR Code Pix"
                                className="h-48 w-48 rounded-xl border border-border bg-white"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-semibold text-foreground">Copia e cola</div>
                              <textarea
                                className="mt-2 w-full h-28 rounded-xl border border-border bg-background p-2 text-xs"
                                readOnly
                                value={pix.qr_code}
                              />
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Button
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={async () => {
                                    try {
                                      await navigator.clipboard.writeText(pix.qr_code);
                                      toast({ title: "Pix", description: "Código copiado." });
                                    } catch {
                                      toast({ title: "Pix", description: "Não foi possível copiar.", variant: "destructive" });
                                    }
                                  }}
                                >
                                  Copiar
                                </Button>
                                <Button variant="outline" className="rounded-xl" onClick={() => void createPix()} disabled={busy}>
                                  Gerar novo
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="card" className="mt-3 space-y-3">
                      {!publicKey ? (
                        <div className="rounded-xl border border-border bg-muted/10 p-4">
                          <div className="text-sm text-destructive">VITE_MP_PUBLIC_KEY não configurada no frontend.</div>
                        </div>
                      ) : !(typeof info?.amount === "number" && Number.isFinite(info.amount) && info.amount > 0) ? (
                        <div className="rounded-xl border border-border bg-muted/10 p-4">
                          <div className="text-sm text-muted-foreground">
                            Valor do pagamento não disponível ainda. Gere o link novamente pelo admin/profissional.
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-border bg-muted/10 p-4">
                          <div className="text-xs text-muted-foreground">
                            Parcelamento disponível conforme regras do Mercado Pago.
                          </div>
                          <div className="mt-4" id={brickContainerId} />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}

