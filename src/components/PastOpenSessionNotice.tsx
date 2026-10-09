import { Clock3 } from "lucide-react";

export function PastOpenSessionsSummary({ count }: { count: number }): JSX.Element | null {
  if (count === 0) return null;

  return (
    <div role="status" className="mb-4 flex items-start gap-2 border-l-2 border-amber-500 bg-amber-50/60 px-3 py-2 text-sm text-foreground">
      <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p>
        <strong>{count === 1 ? "1 horário anterior ainda em aberto." : `${count} horários anteriores ainda em aberto.`}</strong>{" "}
        Confira o que aconteceu antes de finalizar ou reagendar.
      </p>
    </div>
  );
}

export function PastOpenSessionHint(): JSX.Element {
  return (
    <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
      <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Horário passou e ainda está em aberto.
    </p>
  );
}

export function PastOpenSessionCount({ count }: { count: number }): JSX.Element | null {
  if (count === 0) return null;

  return (
    <span className="inline-flex w-fit items-center gap-1 text-xs font-medium text-amber-800">
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      {count === 1 ? "1 horário a conferir" : `${count} horários a conferir`}
    </span>
  );
}
