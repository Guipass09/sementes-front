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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pacote fixo (por sessões) */
  packageSessions?: number;
  /** Pacote custom (criado pelo admin para o paciente) */
  customPackageId?: number;
  sessionsLabel?: string | null;
  amount: number;
  payer?: { name?: string | null; email?: string | null };
};

function uuid(): string {
  try {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  } catch {}
  return `idemp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function ensureMercadoPagoSdk(): Promise<void> {
  if (window.MercadoPago) return;
  await new Promise<void>((resolve, reject) => {
    const t0 = Date.now();
    const tick = () => {
      if (window.MercadoPago) return resolve();
      if (Date.now() - t0 > 15000) return reject(new Error("sdk_timeout"));
      setTimeout(tick, 120);
    };
    tick();
  });
}

export default function PackagePaymentModal({
  open,
  onOpenChange,
  packageSessions,
  customPackageId,
  sessionsLabel,
  amount,
  payer,
}: Props) {
  const { toast } = useToast();
  const publicKey = String((import.meta as any).env?.VITE_MP_PUBLIC_KEY ?? "").trim();

  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  const [tab, setTab] = useState<"pix" | "card">("pix");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pix, setPix] = useState<null | { qr_code: string; qr_code_base64: string }>(null);
  const [providerPaymentId, setProviderPaymentId] = useState<string | null>(null);
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [waiting, setWaiting] = useState(false);

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

  const brickContainerId = useMemo(() => `cardPaymentBrick_container_pkg_${customPackageId ?? "fixed"}_${packageSessions ?? "na"}`, [
    customPackageId,
    packageSessions,
  ]);

  const reset = useCallback(() => {
    setBusy(false);
    setError("");
    setPix(null);
    setProviderPaymentId(null);
    setPaymentId(null);
    setWaiting(false);
  }, []);

  // Poll quando já temos um Payment local (pagamento fora do RTC)
  useEffect(() => {
    if (!open) return;
    if (!waiting) return;
    if (!paymentId) return;
    let cancelled = false;
    const id = window.setInterval(() => {
      void api
        .paymentsStatus({ payment_id: paymentId })
        .then((s) => {
          if (cancelled) return;
          if (s.paid) {
            toastRef.current({ title: "Pagamento", description: "Pagamento confirmado." });
            onOpenChange(false);
          }
        })
        .catch(() => {});
    }, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [open, waiting, paymentId, onOpenChange]);

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

        try {
          window.cardPaymentBrickController?.unmount?.();
        } catch {}

        const mp = new (window as any).MercadoPago(publicKey);
        const bricksBuilder = mp.bricks();

        const init: any = { amount };
        const email = payerEmailRef.current.trim();
        if (email) init.payer = { ...(init.payer || {}), email };
        const cpfDigits = payerCpfDigitsRef.current;
        if (cpfDigits) {
          init.payer = { ...(init.payer || {}), identification: { type: "CPF", number: cpfDigits } };
        }

        const settings = {
          initialization: init,
          customization: {
            paymentMethods: { minInstallments: 1, maxInstallments: 12 },
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
                  .paymentsCreate({
                    method: "card",
                    package_sessions: packageSessions,
                    custom_package_id: customPackageId,
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
                    setPaymentId(p.id);
                    setProviderPaymentId(p.provider_payment_id ?? null);
                    if (p.status === "approved") {
                      toastRef.current({ title: "Pagamento", description: "Pagamento aprovado." });
                      onOpenChange(false);
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
    };
  }, [open, tab, publicKey, brickContainerId, amount, packageSessions, customPackageId, onOpenChange]);

  const createPix = useCallback(async () => {
    setBusy(true);
    setError("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const res = await api.paymentsCreate({
        method: "pix",
        package_sessions: packageSessions,
        custom_package_id: customPackageId,
        payer: {
          name: payerNameRef.current.trim() || null,
          email: payerEmailRef.current.trim() || null,
          identification: payerCpfDigitsRef.current ? { type: "CPF", number: payerCpfDigitsRef.current } : null,
        },
        idempotency_key: idempotencyKey,
      });
      const p = res.data;
      setPaymentId(p.id);
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
  }, [packageSessions, customPackageId]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    setTab("pix");
    setError("");
    setPayerName(String(payer?.name ?? "").trim());
    setPayerEmail(String(payer?.email ?? "").trim());
    setPayerCpfRaw("");
  }, [open, reset, payer?.email, payer?.name]);

  const sessionText = sessionsLabel ?? (packageSessions ? `${packageSessions} sessões` : "Pacote");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "flex flex-col w-[100vw] h-[100svh] max-w-none rounded-none p-0 overflow-hidden",
          "sm:max-w-3xl sm:w-[95vw] sm:h-[85vh] sm:rounded-2xl",
        )}
      >
        <DialogHeader className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-3">
          <DialogTitle>Pagamento</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] flex-1 min-h-0 overflow-y-auto">
          <div className="rounded-2xl border border-border bg-card shadow-sm p-4">
            <div className="flex items-center gap-3">
              <img src={logoImage} alt="Sementes da Fala" className="h-10 w-10 rounded-xl border border-border object-cover" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground truncate">Sementes da Fala</div>
                <div className="text-xs text-muted-foreground truncate">Seguro</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-extrabold tracking-tight text-foreground">
                  {amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </div>
                <div className="text-xs text-muted-foreground">{sessionText}</div>
              </div>
            </div>

            <Separator className="my-3" />

            {providerPaymentId ? <div className="mt-2 text-xs text-muted-foreground">ID do pagamento: {providerPaymentId}</div> : null}
            {error ? <div className="mt-3 text-sm text-destructive">{error}</div> : null}

            <Separator className="my-4" />

            <div className="text-sm font-semibold text-foreground">Dados do pagador</div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Nome completo</Label>
                <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Ex.: Maria Santos Pereira" />
              </div>
              <div className="space-y-1.5">
                <Label>CPF</Label>
                <Input inputMode="numeric" value={payerCpfMasked} onChange={(e) => setPayerCpfRaw(e.target.value)} placeholder="000.000.000-00" />
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
                  Cartão
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pix" className="mt-3 space-y-3">
                {!pix ? (
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="mt-4 flex items-center justify-end gap-2">
                      <Button className="rounded-xl" onClick={() => void createPix()} disabled={busy}>
                        {busy ? "Gerando..." : "Gerar QR Code"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
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
                          <textarea className="mt-2 w-full h-28 rounded-xl border border-border bg-background p-2 text-xs" readOnly value={pix.qr_code} />
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
                          <div className="mt-2 text-xs text-muted-foreground">Após pagar, a confirmação aparecerá automaticamente.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="card" className="mt-3 space-y-3">
                {!publicKey ? (
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="mt-2 text-sm text-destructive">VITE_MP_PUBLIC_KEY não configurada no frontend.</div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-muted/10 p-4">
                    <div className="mt-1 text-xs text-muted-foreground">
                      Até <strong>12x</strong> no cartão • <strong>até 6x sem juros</strong> (conforme configuração do Mercado Pago)
                    </div>
                    <div className="mt-4" id={brickContainerId} />
                  </div>
                )}
              </TabsContent>
            </Tabs>

            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
                Fechar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

