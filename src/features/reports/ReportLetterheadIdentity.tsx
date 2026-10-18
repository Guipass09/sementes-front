import { useState } from "react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { letterheadName, type ReportLetterhead } from "./letterhead";

const candidates = [
  "/logo-relatorio.png",
  "/logo-relatorio.jpg",
  "/logo-relatorio.webp",
  logoImage,
];

function LetterheadLogo({
  logo,
  name,
}: {
  logo?: string | null;
  name: string;
}) {
  const [fallback, setFallback] = useState(0);
  const [customFailed, setCustomFailed] = useState(false);
  return (
    <img
      src={logo && !customFailed ? logo : candidates[fallback]}
      alt={name}
      width={56}
      height={56}
      className="h-14 w-14 flex-none rounded-lg object-contain"
      onError={() => {
        if (logo && !customFailed) setCustomFailed(true);
        else setFallback((value) => Math.min(value + 1, candidates.length - 1));
      }}
    />
  );
}

export function ReportLetterheadIdentity({
  letterhead,
}: {
  letterhead?: ReportLetterhead | null;
}) {
  const name = letterheadName(letterhead);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-4">
      <LetterheadLogo
        key={letterhead?.logo_data_url ?? "default"}
        logo={letterhead?.logo_data_url}
        name={name}
      />
      <div className="min-w-0 flex-1">
        <div className="font-display text-lg font-bold leading-snug [overflow-wrap:anywhere]">
          {letterhead?.display_name?.trim() ? (
            <span className="text-slate-900">{name}</span>
          ) : (
            <>
              <span className="text-brand-green">Sementes</span>{" "}
              <span className="text-brand-brown">da Fala</span>
            </>
          )}
        </div>
        <div className="mt-1 text-xs uppercase text-slate-500">
          Relatório clínico
        </div>
      </div>
    </div>
  );
}
