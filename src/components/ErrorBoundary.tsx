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
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-lg font-display font-bold text-foreground mb-2">
              Opa! Algo deu errado
            </div>
            <div className="text-sm text-muted-foreground mb-4">
              A página encontrou um erro e não conseguiu carregar.
            </div>
            {this.state.message && (
              <pre className="text-xs whitespace-pre-wrap bg-muted/40 border border-border rounded-lg p-3 mb-4 overflow-auto">
                {this.state.message}
              </pre>
            )}
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()}>Recarregar</Button>
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


