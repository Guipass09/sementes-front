import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { AlertTriangle, CheckCircle2, ClipboardCopy, CreditCard, LockKeyhole, QrCode } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: number;
  sessions?: number | null;
  amount: number;
  defaultTab?: "pix" | "card";
  maxInstallments?: number;
  payer?: { name?: string | null; email?: string | null };
  /** Chamada quando o backend confirmar que está pago */
  onPaid: () => void;
};

function uuid(): string {
  try {
    // browsers modernos
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  } catch {}
  // fallback simples
  return `idemp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function ensureMercadoPagoSdk(): Promise<void> {
  if (window.MercadoPago) return;
  // O script é injetado via index.html; aqui só aguarda.
  await new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (window.MercadoPago) return resolve();
      // Em mobile (Safari/iOS), pode demorar mais para expor window.MercadoPago
      if (Date.now() - t0 > 15000) return reject(new Error("sdk_timeout"));
      setTimeout(tick, 120);
    };
    tick();
  });
}

export default function RtcPaymentModal({
  open,
  onOpenChange,
  appointmentId,
  sessions,
  amount,
  defaultTab,
  maxInstallments,
  payer,
  onPaid,
}: Props) {
  const { toast } = useToast();
  const publicKey = String((import.meta as any).env?.VITE_MP_PUBLIC_KEY ?? "").trim();

  // Evita remount infinito do Brick por re-render da chamada (timer/RTC).
  // Guardamos callbacks em refs para não precisar reinicializar o Brick quando o componente pai renderiza.
  const toastRef = useRef(toast);
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);
  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [statusHint, setStatusHint] = useState<string>("");
  const [pix, setPix] = useState<null | { qr_code: string; qr_code_base64: string }>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  const [paid, setPaid] = useState(false);
  const [brickNonce, setBrickNonce] = useState(0);

  // Form simples (independente do método)
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

  const cardMountedRef = useRef(false);
  const brickContainerId = useMemo(() => `cardPaymentBrick_container_${appointmentId}_${brickNonce}`, [appointmentId, brickNonce]);

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

  const reset = useCallback(() => {
    setBusy(false);
    setError("");
    setStatusHint("");
    setPix(null);
    setProviderPaymentId(null);
    setWaiting(false);
    setPaid(false);
  }, []);

  // Poll de status (necessário quando o usuário ainda não conseguiu "join" na sala)
  useEffect(() => {
    if (!open) return;
    if (!waiting) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void api
        .paymentsStatus({ appointment_id: appointmentId })
        .then((s) => {
          if (cancelled) return;
          if (s.paid) {
            setPaid(true);
            setWaiting(false);
            toastRef.current({ title: "Pagamento", description: "Pagamento confirmado." });
            onPaidRef.current();
            return;
          }
          const st = String(s.status || "");
          if (st === "rejected" || st === "cancelled") {
            setWaiting(false);
            setError("Pagamento negado. Confira os dados e tente novamente.");
            setStatusHint(String(s.status_detail || ""));
          }
        })
        .catch(() => {});
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, waiting, appointmentId]);

  // Card Brick mount/unmount
  useEffect(() => {
    if (!open) return;
    if (tab !== "card") return;
    if (!publicKey) {
      setError("Chave pública do Mercado Pago não configurada (VITE_MP_PUBLIC_KEY).");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await ensureMercadoPagoSdk();
        if (cancelled) return;

        // Unmount antigo (se existir)
        try {
          window.cardPaymentBrickController?.unmount?.();
        } catch {}

        const mp = new (window as any).MercadoPago(publicKey);
        const bricksBuilder = mp.bricks();

        const init: any = { amount };
        // Preenche no Brick apenas uma vez (no mount), para evitar "recarregar infinito" enquanto o usuário digita.
        const email = payerEmailRef.current.trim();
        if (email) {
          init.payer = { ...(init.payer || {}), email };
        }
        const cpfDigits = payerCpfDigitsRef.current;
        if (cpfDigits) {
          init.payer = {
            ...(init.payer || {}),
            identification: { type: "CPF", number: cpfDigits },
          };
        }

        const maxI =
          typeof maxInstallments === "number" && Number.isFinite(maxInstallments)
            ? Math.min(12, Math.max(1, Math.floor(maxInstallments)))
            : 12;

        const settings = {
          initialization: init,
          customization: {
            paymentMethods: {
              minInstallments: 1,
              maxInstallments: maxI,
            },
          },
          callbacks: {
            onReady: () => {
              if (cancelled) return;
              cardMountedRef.current = true;
            },
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
                  .paymentsCreate({
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
                  .then((res) => {
                    const p = res.data;
                    setProviderPaymentId(p.provider_payment_id ?? null);
                    if (p.status === "approved") {
                      setPaid(true);
                      setWaiting(false);
                      toastRef.current({ title: "Pagamento", description: "Pagamento aprovado." });
                      onPaidRef.current();
                    } else if (p.status === "rejected" || p.status === "cancelled") {
                      setWaiting(false);
                      setError("Pagamento negado. Tente novamente.");
                      setStatusHint(String(p.status_detail || ""));
                      toastRef.current({ title: "Pagamento", description: "Pagamento negado. Tente novamente.", variant: "destructive" });
                    } else {
                      toastRef.current({ title: "Pagamento", description: "Pagamento enviado. Aguardando confirmação..." });
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
              // Erros do Brick (não expor detalhes sensíveis)
              console.error("[MP Brick]", err);
              setError("Erro no formulário de pagamento. Confira os dados e tente novamente.");
            },
          },
        };

        window.cardPaymentBrickController = await bricksBuilder.create("cardPayment", brickContainerId, settings);
      } catch {
        if (!cancelled) setError("Não foi possível carregar o Mercado Pago neste dispositivo.");
      }
    })();

    return () => {
      cancelled = true;
      try {
        window.cardPaymentBrickController?.unmount?.();
      } catch {}
      cardMountedRef.current = false;
    };
  }, [open, tab, publicKey, appointmentId, brickContainerId, amount, maxInstallments]);

  const createPix = useCallback(async () => {
    setBusy(true);
    setError("");
    setStatusHint("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const res = await api.paymentsCreate({
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
    } catch {
      setError("Não foi possível gerar o Pix no momento.");
    } finally {
      setBusy(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    // quando abre, respeita tab sugerida
    setTab(defaultTab === "card" ? "card" : "pix");
    setError("");
    setStatusHint("");
    setPayerName(String(payer?.name ?? "").trim());
    setPayerEmail(String(payer?.email ?? "").trim());
    setPayerCpfRaw("");
  }, [open, reset, payer?.email, payer?.name, defaultTab]);

  const fmtMoney = useCallback(
    (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    [],
  );
  const fmtSessions = useCallback((n: number | null | undefined) => {
    if (!n || n <= 0) return "Pagamento da sessão";
    if (n === 1) return "1 sessão";
    return `${n} sessões`;
  }, []);

  const canSubmitPayer = useMemo(() => {
    const email = payerEmail.trim();
    return email.includes("@") && email.includes(".");
  }, [payerEmail]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // Evita o usuário fechar "sem querer" quando o pagamento foi exigido.
          // A tela que chamou decide se permite fechar.
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={cn(
          "flex flex-col w-[100vw] h-[100svh] max-w-none rounded-none p-0 overflow-hidden",
          "sm:max-w-5xl sm:w-[95vw] sm:h-[85vh] sm:rounded-3xl",
        )}
      >
        {/* Fundo mais sofisticado (como a página pública) */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(16,185,129,0.18),transparent_60%),radial-gradient(900px_500px_at_90%_10%,rgba(16,185,129,0.10),transparent_55%),radial-gradient(700px_600px_at_50%_120%,rgba(0,0,0,0.10),transparent_55%)]" />
        </div>

        <div className="px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+16px)] pb-[calc(env(safe-area-inset-bottom)+16px)] flex-1 min-h-0 overflow-y-auto">
          <div className="mx-auto max-w-6xl">
            {/* Header “hero” */}
            <DialogHeader className="rounded-3xl border border-border/70 bg-background/60 backdrop-blur px-5 sm:px-8 py-6 shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                <div className="flex items-center gap-3">
                  <img
                    src={logoImage}
                    alt="Sementes da Fala"
                    className="h-11 w-11 rounded-2xl object-cover border border-border shadow-sm"
                  />
                  <div>
                    <DialogTitle className="font-display font-bold text-foreground leading-tight">Sementes da Fala</DialogTitle>
                    <div className="mt-0.5 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <LockKeyhole className="h-3.5 w-3.5" />
                      Pagamento seguro
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="h-2 w-2 rounded-full bg-brand-green" />
                    Sessão em andamento
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                    <CreditCard className="h-3.5 w-3.5" />
                    Pix e cartão
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">Você está pagando</div>
                  <div className="mt-1 text-2xl sm:text-3xl font-display font-extrabold text-foreground tracking-tight">
                    Pagamento da sessão
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-2 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 px-3 py-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {fmtSessions(sessions ?? null)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{fmtMoney(amount)}</span>
                  </span>
                </div>
              </div>

              {providerPaymentId ? (
                <div className="mt-4 text-xs text-muted-foreground">ID do pagamento: {providerPaymentId}</div>
              ) : null}
            </DialogHeader>

            <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* Main */}
              <div className="order-2 lg:order-1">
                {paid ? (
                  <div className="rounded-3xl border border-brand-green/25 bg-brand-green/10 p-6 shadow-sm">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="h-6 w-6 text-brand-green mt-0.5" />
                      <div>
                        <div className="text-lg font-semibold text-brand-green">Pagamento aprovado!</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          Sua sessão foi liberada. Você pode fechar este modal e continuar a transmissão normalmente.
                        </div>
                        <div className="mt-4 flex items-center justify-end">
                          <Button className="rounded-2xl px-6" onClick={() => onOpenChange(false)}>
                            Voltar para a chamada
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Step 1 */}
                    <div className="rounded-3xl border border-border/70 bg-background/60 backdrop-blur p-6 shadow-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">1) Dados do pagador</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            Essas informações ajudam a processar o pagamento com segurança.
                          </div>
                        </div>
                        {canSubmitPayer ? (
                          <span className="inline-flex items-center gap-2 text-xs text-brand-green">
                            <CheckCircle2 className="h-4 w-4" />
                            OK
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                            placeholder="seuemail@exemplo.com"
                            autoCapitalize="none"
                            autoCorrect="off"
                            inputMode="email"
                          />
                        </div>
                      </div>

                      {error ? (
                        <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                            <div className="text-sm text-destructive">
                              {error}
                              {statusHint ? <div className="mt-1 text-xs text-muted-foreground">{statusHint}</div> : null}
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="rounded-xl"
                              onClick={() => {
                                setWaiting(false);
                                setProviderPaymentId(null);
                                setPix(null);
                                setError("");
                                setStatusHint("");
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
                    </div>

                    <Separator className="my-6" />

                    {/* Step 2 */}
                    <div className="rounded-3xl border border-border/70 bg-background/60 backdrop-blur p-6 shadow-sm">
                      <div className="text-sm font-semibold text-foreground">2) Escolha a forma de pagamento</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Pix é mais rápido. Cartão permite parcelamento conforme disponibilidade.
                      </div>

                      <div className="mt-4">
                        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                          <TabsList className="grid grid-cols-2">
                            <TabsTrigger value="pix" className="gap-2">
                              <QrCode className="h-4 w-4" />
                              Pix
                            </TabsTrigger>
                            <TabsTrigger value="card" className="gap-2">
                              <CreditCard className="h-4 w-4" />
                              Cartão
                            </TabsTrigger>
                          </TabsList>

                          <TabsContent value="pix" className="mt-4">
                            <div className="rounded-2xl border border-border bg-background/70 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-foreground">Pix</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    Gere o QR Code e pague pelo seu banco. Após pagar, a confirmação acontece automaticamente.
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">{fmtMoney(amount)}</span>
                              </div>

                              {pix ? (
                                <div className="mt-5 grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-4 items-start">
                                  <div className="rounded-2xl border border-border bg-background p-3">
                                    <img
                                      alt="QR Code Pix"
                                      className="w-full h-auto rounded-xl"
                                      src={`data:image/png;base64,${pix.qr_code_base64}`}
                                    />
                                  </div>
                                  <div>
                                    <div className="text-xs text-muted-foreground mb-2">Código Pix (copia e cola)</div>
                                    <div className="rounded-2xl border border-border bg-background p-3 text-xs break-all select-all">
                                      {pix.qr_code}
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                      <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={async () => {
                                          try {
                                            await navigator.clipboard.writeText(pix.qr_code);
                                            toastRef.current({ title: "Pix", description: "Copiado para a área de transferência." });
                                          } catch {
                                            toastRef.current({
                                              title: "Pix",
                                              description: "Não foi possível copiar.",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                      >
                                        <ClipboardCopy className="h-4 w-4 mr-2" />
                                        Copiar código
                                      </Button>
                                      <Button
                                        variant="outline"
                                        className="rounded-xl"
                                        onClick={() => void createPix()}
                                        disabled={busy}
                                      >
                                        Gerar novo
                                      </Button>
                                      {providerPaymentId ? (
                                        <span className="text-xs text-muted-foreground">
                                          {waiting ? "Aguardando confirmação…" : "Gerado com sucesso."}
                                        </span>
                                      ) : null}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-5 flex items-center justify-end">
                                  <Button className="rounded-2xl px-6" onClick={() => void createPix()} disabled={busy}>
                                    {busy ? "Gerando..." : "Gerar QR Code"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </TabsContent>

                          <TabsContent value="card" className="mt-4">
                            <div className="rounded-2xl border border-border bg-background/70 p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-foreground">Cartão de crédito</div>
                                  <div className="mt-1 text-xs text-muted-foreground">
                                    {typeof maxInstallments === "number" && maxInstallments >= 1 ? (
                                      <>
                                        Até <strong>{Math.min(12, Math.max(1, Math.floor(maxInstallments)))}x</strong> no cartão •{" "}
                                        <strong>até 6x sem juros</strong> (conforme configuração do Mercado Pago)
                                      </>
                                    ) : (
                                      "Preencha os dados do cartão abaixo."
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-muted-foreground">{fmtMoney(amount)}</span>
                              </div>

                              {!publicKey ? (
                                <div className="mt-4 rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
                                  Chave pública do Mercado Pago não configurada (VITE_MP_PUBLIC_KEY).
                                </div>
                              ) : (
                                <div className={cn("mt-5", busy ? "opacity-60 pointer-events-none" : "")}>
                                  <div id={brickContainerId} />
                                  <div className="mt-2 text-[11px] text-muted-foreground">
                                    Se o formulário não aparecer, toque na tela e aguarde alguns segundos.
                                  </div>
                                </div>
                              )}

                              <div className="mt-4 flex items-center justify-between gap-2">
                                <div className="text-xs text-muted-foreground">Precisa recarregar o formulário?</div>
                                <Button
                                  variant="outline"
                                  className="rounded-xl"
                                  onClick={() => setBrickNonce((n) => n + 1)}
                                  disabled={!publicKey || busy}
                                >
                                  Recarregar
                                </Button>
                              </div>
                            </div>
                          </TabsContent>
                        </Tabs>
                      </div>
                    </div>

                    <div className="mt-6 rounded-3xl border border-border bg-muted/20 p-4 text-xs text-muted-foreground">
                      Ao pagar você concorda com os termos da plataforma. Em caso de erro, tente novamente ou contate o suporte.
                    </div>

                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
                        Fechar
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Sidebar */}
              <div className="order-1 lg:order-2">
                <div className="lg:sticky lg:top-6 space-y-4">
                  <div className="rounded-3xl border border-border/70 bg-background/60 backdrop-blur p-5 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-foreground">Resumo</div>
                        <div className="mt-1 text-xs text-muted-foreground">{fmtSessions(sessions ?? null)}</div>
                      </div>
                      <span className="inline-flex items-center gap-2 rounded-full bg-brand-green/10 text-brand-green border border-brand-green/20 px-3 py-1.5 text-xs">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Seguro
                      </span>
                    </div>

                    <div className="mt-4">
                      <div className="text-4xl font-display font-extrabold text-foreground tracking-tight">{fmtMoney(amount)}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Confirmação automática após o pagamento. Em seguida, continue a sessão normalmente.
                      </div>
                    </div>

                    <Separator className="my-4" />

                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <LockKeyhole className="h-3.5 w-3.5" />
                        Ambiente seguro
                      </div>
                      <div className="flex items-center gap-2">
                        <QrCode className="h-3.5 w-3.5" />
                        Pix com QR Code e copia e cola
                      </div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5" />
                        Cartão de crédito (Mercado Pago)
                      </div>
                    </div>
                  </div>

                  {paid ? null : (
                    <div className="rounded-3xl border border-border/70 bg-background/60 backdrop-blur p-4 shadow-sm">
                      <div className="text-xs text-muted-foreground">
                        Dica: mantenha este modal aberto até ver “Pagamento confirmado”.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

