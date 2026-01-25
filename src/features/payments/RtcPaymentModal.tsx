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
import { CreditCard, LockKeyhole, QrCode, ShieldCheck } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: number;
  sessions?: number | null;
  amount: number;
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

export default function RtcPaymentModal({ open, onOpenChange, appointmentId, sessions, amount, payer, onPaid }: Props) {
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
  const [pix, setPix] = useState<null | { qr_code: string; qr_code_base64: string }>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);

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
  const brickContainerId = useMemo(() => `cardPaymentBrick_container_${appointmentId}`, [appointmentId]);

  const reset = useCallback(() => {
    setBusy(false);
    setError("");
    setPix(null);
    setProviderPaymentId(null);
    setWaiting(false);
  }, []);

  // Poll de status (necessário quando o usuário ainda não conseguiu "join" na sala)
  useEffect(() => {
    if (!open) return;
    if (!waiting) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void api
        .paymentsStatus(appointmentId)
        .then((s) => {
          if (cancelled) return;
          if (s.paid) {
            toastRef.current({ title: "Pagamento", description: "Pagamento confirmado. Liberando a sessão..." });
            onPaidRef.current();
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
        const email = payerEmail.trim();
        if (email) {
          init.payer = { ...(init.payer || {}), email };
        }
        if (payerCpfDigits) {
          init.payer = {
            ...(init.payer || {}),
            identification: { type: "CPF", number: payerCpfDigits },
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
                      name: payerName.trim() || null,
                      email: payerEmail.trim() || null,
                      identification: payerCpfDigits ? { type: "CPF", number: payerCpfDigits } : null,
                    },
                    card: cardPayload,
                    idempotency_key: idempotencyKey,
                  })
                  .then((res) => {
                    const p = res.data;
                    setProviderPaymentId(p.provider_payment_id ?? null);
                    if (p.status === "approved") {
                      toastRef.current({ title: "Pagamento", description: "Pagamento aprovado." });
                      onPaidRef.current();
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
  }, [open, tab, publicKey, appointmentId, brickContainerId, amount, payerCpfDigits, payerEmail]);

  const createPix = useCallback(async () => {
    setBusy(true);
    setError("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const res = await api.paymentsCreate({
        appointment_id: appointmentId,
        method: "pix",
        payer: {
          name: payerName.trim() || null,
          email: payerEmail.trim() || null,
          identification: payerCpfDigits ? { type: "CPF", number: payerCpfDigits } : null,
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
  }, [appointmentId, payerCpfDigits, payerEmail, payerName]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    // quando abre, começa no Pix
    setTab("pix");
    setError("");
    setPayerName(String(payer?.name ?? "").trim());
    setPayerEmail(String(payer?.email ?? "").trim());
    setPayerCpfRaw("");
  }, [open, reset, payer?.email, payer?.name]);

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
          "sm:max-w-3xl sm:w-[95vw] sm:h-[85vh] sm:rounded-2xl",
        )}
      >
        <DialogHeader className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3">
          <DialogTitle>Pagamento</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Sementes da Fala" className="h-10 w-10 rounded-xl border border-border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">Sementes da Fala</div>
                <div className="text-xs text-muted-foreground truncate">Pagamento seguro • Mercado Pago</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-foreground">
                  {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-xs text-muted-foreground">{sessions ? `${sessions} sessões` : "Pagamento"}</div>
              </div>
            </div>

            <Separator className="my-3" />

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/10 p-2">
                <ShieldCheck className="h-4 w-4 text-brand-green" />
                <div className="text-xs text-foreground">Seguro</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/10 p-2">
                <LockKeyhole className="h-4 w-4 text-brand-green" />
                <div className="text-xs text-foreground">Criptografado</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/10 p-2">
                <QrCode className="h-4 w-4 text-brand-green" />
                <div className="text-xs text-foreground">Pix</div>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/10 p-2">
                <CreditCard className="h-4 w-4 text-brand-green" />
                <div className="text-xs text-foreground">Cartão</div>
              </div>
            </div>

            {providerPaymentId ? (
              <div className="mt-2 text-xs text-muted-foreground">ID do pagamento: {providerPaymentId}</div>
            ) : null}
          </div>
        </div>

        {error ? <div className="px-4 pb-3 text-sm text-destructive">{error}</div> : null}

        <div className="px-4 pb-3">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="text-sm font-semibold text-foreground">Dados do pagador</div>
            <div className="mt-1 text-xs text-muted-foreground">Preencha para tornar o pagamento mais rápido e evitar erros.</div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Ex.: Maria Santos Pereira" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input
                  inputMode="numeric"
                  value={payerCpfMasked}
                  onChange={(e) => setPayerCpfRaw(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>E-mail</Label>
                <Input
                  value={payerEmail}
                  onChange={(e) => setPayerEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  inputMode="email"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex-1 min-h-0 overflow-y-auto">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pix" className="gap-2">
                <QrCode className="h-4 w-4" />
                Pix
              </TabsTrigger>
              <TabsTrigger value="card" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Cartão
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="mt-3 space-y-3">
              {!pix ? (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
                  <div className="text-sm font-semibold text-foreground">Pix</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Gere o QR Code e pague pelo app do seu banco. A sessão será liberada automaticamente após a confirmação.
                  </div>
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <Button className="rounded-xl" onClick={() => void createPix()} disabled={busy}>
                      {busy ? "Gerando..." : "Gerar QR Code"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
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
                                toastRef.current({ title: "Pix", description: "Código copiado." });
                              } catch {
                                toastRef.current({ title: "Pix", description: "Não foi possível copiar.", variant: "destructive" });
                              }
                            }}
                          >
                            Copiar
                          </Button>
                          <Button variant="outline" className="rounded-xl" onClick={() => void createPix()} disabled={busy}>
                            Gerar novo
                          </Button>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Após pagar, a sessão será liberada automaticamente.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="card" className="mt-3 space-y-3">
              {!publicKey ? (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
                  <div className="text-sm font-semibold text-foreground">Cartão</div>
                  <div className="mt-2 text-sm text-destructive">VITE_MP_PUBLIC_KEY não configurada no frontend.</div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
                  <div className="text-sm font-semibold text-foreground">Cartão</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Até <strong>12x</strong> no cartão • <strong>até 6x sem juros</strong> (conforme configuração do Mercado Pago)
                  </div>
                  <div className="mt-4" id={brickContainerId} />
                  <div className="mt-3 text-xs text-muted-foreground">
                    Seu cartão é processado com segurança pelo Mercado Pago. O token do cartão não fica salvo no seu app.
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
              Voltar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

