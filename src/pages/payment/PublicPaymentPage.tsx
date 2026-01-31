import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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

function decodeTokenPreview(token: string): null | { title: string; amount: number; sessions: number | null } {
  try {
    const part = token.split(".")[0] || "";
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 ? "=".repeat(4 - (b64.length % 4)) : "";
    const json = atob(b64 + pad);
    const obj = JSON.parse(json);
    const title = String(obj?.title ?? "Pagamento");
    const amount = Number(obj?.amount ?? 0);
    const sessionsRaw = obj?.sessions;
    const sessions = sessionsRaw != null ? Number(sessionsRaw) : null;
    return {
      title,
      amount: Number.isFinite(amount) ? amount : 0,
      sessions: Number.isFinite(sessions as any) && (sessions as any) > 0 ? (sessions as any) : null,
    };
  } catch {
    return null;
  }
}

export default function PublicPaymentPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => {
    const t = (searchParams.get("token") || searchParams.get("t") || "").trim();
    return t ? t : null;
  }, [searchParams]);

  const preview = useMemo(() => (token ? decodeTokenPreview(token) : null), [token]);

  const auth = useAuth();
  const { user } = auth;
  const { toast } = useToast();

  const publicKey = String((import.meta as any).env?.VITE_MP_PUBLIC_KEY ?? "").trim();

  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusHint, setStatusHint] = useState<string>("");
  const [pix, setPix] = useState<null | { qr_code: string; qr_code_base64: string }>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [brickNonce, setBrickNonce] = useState(0);

  // Dados do pagador
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

  useEffect(() => {
    setPayerName(String(user?.name ?? "").trim());
    setPayerEmail(String(user?.email ?? "").trim());
  }, [user?.email, user?.name]);

  const brickContainerId = useMemo(() => `cardPaymentBrick_public_${brickNonce}`, [brickNonce]);

  const amount = useMemo(() => {
    const a = preview?.amount ?? 0;
    return Number.isFinite(a) ? a : 0;
  }, [preview?.amount]);

  const resetPayment = useCallback(() => {
    setBusy(false);
    setError("");
    setStatusHint("");
    setPix(null);
    setProviderPaymentId(null);
    setPaymentId(null);
    setWaiting(false);
    setPaid(false);
  }, []);

  // Poll de status enquanto aguardando (pix ou cartão pendente)
  useEffect(() => {
    if (!waiting) return;
    if (!paymentId) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void api
        .paymentsStatusPublic({ payment_id: paymentId })
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
  }, [waiting, paymentId, toast]);

  // Card Brick
  useEffect(() => {
    if (paid) return;
    if (tab !== "card") return;
    if (!publicKey) return;
    if (!token) return;
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

                void api
                  .paymentsCreatePublic({
                    token,
                    method: "card",
                    payer: {
                      name: payerNameRef.current.trim() || null,
                      email: payerEmailRef.current.trim(),
                      identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
                    },
                    card: cardPayload,
                    idempotency_key: idempotencyKey,
                  })
                  .then((res) => {
                    const p = res.data;
                    setPaymentId(p.id ?? null);
                    setProviderPaymentId(p.provider_payment_id ?? null);
                    if (p.status === "approved" || p.paid_at) {
                      setPaid(true);
                      setWaiting(false);
                      toast({ title: "Pagamento", description: "Pagamento confirmado." });
                    } else {
                      setWaiting(true);
                      toast({ title: "Pagamento", description: "Aguardando confirmação..." });
                    }
                    resolve();
                  })
                  .catch((e: any) => {
                    setError(e?.data?.message || "Não foi possível processar o pagamento no momento.");
                    reject();
                  })
                  .finally(() => setBusy(false));
              });
            },
            onError: () => {
              setError("Não foi possível processar o pagamento no momento.");
            },
          },
        };

        const controller = await bricksBuilder.create("cardPayment", brickContainerId, settings);
        (window as any).cardPaymentBrickController = controller;
      } catch {
        setError("Não foi possível carregar o Mercado Pago neste dispositivo.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        (window as any).cardPaymentBrickController?.unmount?.();
      } catch {}
    };
  }, [paid, tab, publicKey, token, amount, brickContainerId, toast]);

  const createPix = useCallback(async () => {
    if (!token) return;
    if (!(typeof amount === "number" && Number.isFinite(amount) && amount > 0)) return;
    const email = payerEmailRef.current.trim();
    if (!email) {
      toast({ title: "Pagamento", description: "Informe o e-mail do pagador.", variant: "destructive" });
      return;
    }

    setBusy(true);
    setError("");
    setStatusHint("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const res = await api.paymentsCreatePublic({
        token,
        method: "pix",
        payer: {
          name: payerNameRef.current.trim() || null,
          email,
          identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
        },
        idempotency_key: idempotencyKey,
      });
      const p = res.data;
      setPaymentId(p.id ?? null);
      setProviderPaymentId(p.provider_payment_id ?? null);
      if (p.pix?.qr_code_base64 && p.pix?.qr_code) {
        setPix({ qr_code_base64: p.pix.qr_code_base64, qr_code: p.pix.qr_code });
        setWaiting(true);
      } else if (p.status === "approved" || p.paid_at) {
        setPaid(true);
        setWaiting(false);
      } else {
        setError("Não foi possível gerar o QR Code do Pix.");
      }
    } catch (e: any) {
      setError(e?.data?.message || "Não foi possível gerar o Pix no momento.");
    } finally {
      setBusy(false);
    }
  }, [token, amount, toast]);

  const fmtMoney = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  if (!token) {
    return (
      <div className="min-h-[100svh] flex items-center justify-center px-4">
        <div className="w-full max-w-lg rounded-3xl border border-border bg-card/70 backdrop-blur p-6 text-center">
          <div className="font-display text-xl font-bold">Link inválido</div>
          <div className="mt-2 text-sm text-muted-foreground">Abra o link novamente ou solicite um novo link.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] py-8 lg:py-12">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-3xl border border-border bg-card/70 backdrop-blur overflow-hidden">
            <div className="px-5 sm:px-8 py-6 bg-gradient-to-b from-brand-green/10 to-transparent border-b border-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img src={logoImage} alt="Sementes da Fala" className="h-10 w-10 rounded-xl object-cover border border-border" />
                  <div>
                    <div className="font-display font-bold text-foreground">Sementes da Fala</div>
                    <div className="text-xs text-muted-foreground">Pagamento seguro</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">Link</div>
                  <div className="text-sm font-semibold text-foreground">{preview?.title ?? "Pagamento"}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-0">
              <div className="p-5 sm:p-8 border-b lg:border-b-0 lg:border-r border-border bg-muted/20">
                <div className="text-sm font-semibold text-foreground">Resumo</div>
                <div className="mt-3 rounded-2xl border border-border bg-card p-4">
                  <div className="text-3xl font-display font-bold text-foreground">{fmtMoney(amount)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {preview?.sessions ? `${preview.sessions} sessões` : "Pagamento avulso"}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-xs">
                    <span className="px-2 py-1 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20">Seguro</span>
                  </div>
                </div>
                <div className="mt-4 text-xs text-muted-foreground">
                  Preencha seus dados, escolha Pix ou Cartão e finalize. Após aprovar, confirme com a profissional.
                </div>
              </div>

              <div className="p-5 sm:p-8">
                {paid ? (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="text-lg font-semibold text-brand-green">Pagamento realizado com sucesso</div>
                    <div className="mt-1 text-sm text-muted-foreground">Confirme com a profissional/admin para prosseguir.</div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="text-sm font-semibold text-foreground">Dados do pagador</div>
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label>Nome completo</Label>
                          <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Seu nome" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>CPF</Label>
                          <Input
                            value={payerCpfMasked}
                            onChange={(e) => setPayerCpfRaw(e.target.value)}
                            inputMode="numeric"
                            placeholder="000.000.000-00"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label>E-mail</Label>
                          <Input
                            value={payerEmail}
                            onChange={(e) => setPayerEmail(e.target.value)}
                            inputMode="email"
                            placeholder="seuemail@exemplo.com"
                          />
                        </div>
                      </div>

                      {error ? (
                        <div className="mt-3 text-sm text-destructive">
                          {error}
                          {statusHint ? <div className="mt-1 text-xs text-muted-foreground">{statusHint}</div> : null}
                        </div>
                      ) : null}
                    </div>

                    <Separator className="my-5" />

                    <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                      <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="pix">Pix</TabsTrigger>
                        <TabsTrigger value="card">Cartão de crédito</TabsTrigger>
                      </TabsList>

                      <TabsContent value="pix" className="mt-4">
                        <div className="rounded-2xl border border-border bg-card p-5">
                          <div className="text-sm font-semibold text-foreground">Pix</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Gere o QR Code e pague pelo seu banco. Após pagar, a confirmação acontece automaticamente.
                          </div>

                          {pix ? (
                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-start">
                              <div className="rounded-xl border border-border bg-background p-3">
                                <img
                                  alt="QR Code Pix"
                                  className="w-full h-auto rounded-lg"
                                  src={`data:image/png;base64,${pix.qr_code_base64}`}
                                />
                              </div>
                              <div>
                                <div className="text-xs text-muted-foreground mb-2">Código Pix (copia e cola)</div>
                                <div className="rounded-xl border border-border bg-background p-3 text-xs break-all select-all">
                                  {pix.qr_code}
                                </div>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(pix.qr_code);
                                        toast({ title: "Pix", description: "Copiado para a área de transferência." });
                                      } catch {
                                        toast({ title: "Pix", description: "Não foi possível copiar.", variant: "destructive" });
                                      }
                                    }}
                                  >
                                    Copiar código
                                  </Button>
                                  {providerPaymentId ? (
                                    <span className="text-xs text-muted-foreground">Aguardando confirmação…</span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 flex items-center justify-end">
                              <Button
                                className="rounded-xl"
                                onClick={() => void createPix()}
                                disabled={busy || !(typeof amount === "number" && Number.isFinite(amount) && amount > 0)}
                              >
                                {busy ? "Gerando..." : "Gerar QR Code"}
                              </Button>
                            </div>
                          )}
                        </div>
                      </TabsContent>

                      <TabsContent value="card" className="mt-4">
                        <div className="rounded-2xl border border-border bg-card p-5">
                          <div className="text-sm font-semibold text-foreground">Cartão de crédito</div>
                          <div className="mt-1 text-xs text-muted-foreground">Preencha os dados do cartão abaixo.</div>
                          {!publicKey ? (
                            <div className="mt-3 text-sm text-destructive">
                              Chave pública do Mercado Pago não configurada (VITE_MP_PUBLIC_KEY).
                            </div>
                          ) : (
                            <div className={cn("mt-4", busy ? "opacity-60 pointer-events-none" : "")}>
                              <div id={brickContainerId} />
                              <div className="mt-2 text-xs text-muted-foreground">
                                Se o formulário não aparecer, toque na tela e aguarde alguns segundos.
                              </div>
                            </div>
                          )}
                          <div className="mt-3 flex justify-end">
                            <Button variant="outline" onClick={() => setBrickNonce((n) => n + 1)} disabled={!publicKey || busy}>
                              Recarregar cartão
                            </Button>
                          </div>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            Ao pagar você concorda com os termos da plataforma. Em caso de erro, tente novamente ou contate o suporte.
          </div>
        </div>
      </div>
    </div>
  );
}

