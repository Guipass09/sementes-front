import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import * as api from "@/lib/laravel-api";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointmentId: number;
  sessions?: number | null;
  amount: number;
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

export default function RtcPaymentModal({ open, onOpenChange, appointmentId, sessions, amount, onPaid }: Props) {
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

        const settings = {
          initialization: { amount },
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
  }, [open, tab, publicKey, appointmentId, brickContainerId, amount]);

  const createPix = useCallback(async () => {
    setBusy(true);
    setError("");
    setPix(null);
    const idempotencyKey = uuid();
    try {
      const res = await api.paymentsCreate({
        appointment_id: appointmentId,
        method: "pix",
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
    // quando abre, começa no Pix
    setTab("pix");
    setError("");
  }, [open, reset]);

  const headerLabel = useMemo(() => {
    const s = Number.isFinite(Number(sessions)) && Number(sessions) > 0 ? `${sessions} sessões` : "Pagamento";
    const amt = Number.isFinite(Number(amount)) ? amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "";
    return `${s}${amt ? ` • ${amt}` : ""}`;
  }, [sessions, amount]);

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
        <DialogHeader className="px-4 pt-[calc(env(safe-area-inset-top)+16px)] pb-2">
          <DialogTitle>Pagamento (Mercado Pago)</DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-2 text-sm text-muted-foreground">
          {headerLabel}
          {providerPaymentId ? <span className="ml-2 text-xs">(ID: {providerPaymentId})</span> : null}
        </div>

        {error ? (
          <div className="px-4 pb-2 text-sm text-destructive">{error}</div>
        ) : null}

        <div className="px-4 pb-2">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pix">Pix</TabsTrigger>
              <TabsTrigger value="card">Cartão</TabsTrigger>
            </TabsList>

            <TabsContent value="pix" className="mt-3 space-y-3">
              {!pix ? (
                <div className="text-sm text-muted-foreground">
                  Clique em “Gerar Pix” para mostrar o QR Code (sem sair da chamada).
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-4">
                    <img
                      src={`data:image/png;base64,${pix.qr_code_base64}`}
                      alt="QR Code Pix"
                      className="h-44 w-44 rounded-lg border border-border bg-white"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">Copia e cola</div>
                      <textarea
                        className="mt-2 w-full h-28 rounded-lg border border-border bg-background p-2 text-xs"
                        readOnly
                        value={pix.qr_code}
                      />
                      <div className="mt-2 flex items-center gap-2">
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
                  <div className="text-xs text-muted-foreground">
                    Após pagar, a sessão será liberada automaticamente.
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
                  Voltar
                </Button>
                <Button className="rounded-xl" onClick={() => void createPix()} disabled={busy}>
                  {busy ? "Gerando..." : "Gerar Pix"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="card" className="mt-3 space-y-3">
              {!publicKey ? (
                <div className="text-sm text-destructive">VITE_MP_PUBLIC_KEY não configurada no frontend.</div>
              ) : (
                <div>
                  <div id={brickContainerId} />
                  <div className="mt-2 text-xs text-muted-foreground">
                    Ao enviar, o pagamento será processado no backend (token nunca sai do seu servidor).
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={busy}>
                  Voltar
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

