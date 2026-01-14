import React from "react";
import { Button } from "@/components/ui/button";

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message?: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: unknown) {
    // mantém log no console para debug
    // eslint-disable-next-line no-console
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      const isChunkFail =
        typeof this.state.message === "string" &&
        (this.state.message.includes("dynamically imported module") ||
          this.state.message.includes("Failed to fetch dynamically imported module"));

      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-lg font-display font-bold text-foreground mb-2">
              Opa! Algo deu errado
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              A página encontrou um erro e não conseguiu carregar.
            </div>
            {isChunkFail ? (
              <div className="text-sm text-muted-foreground mb-4">
                Parece que você está com uma versão antiga do app em cache (após atualização). Clique em{" "}
                <strong>Recarregar</strong>. Se estiver no iPad (PWA), pode ser necessário fechar o app e abrir de
                novo.
              </div>
            ) : null}
            {this.state.message && (
              <pre className="text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded-lg p-3 mb-4 overflow-auto">
                {this.state.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  try {
                    const url = new URL(window.location.href);
                    url.searchParams.set("__reload", String(Date.now()));
                    window.location.replace(url.toString());
                  } catch {
                    window.location.reload();
                  }
                }}
              >
                Recarregar
              </Button>
              <Button variant="outline" onClick={() => history.back()}>
                Voltar
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


