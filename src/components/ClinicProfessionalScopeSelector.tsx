import { BriefcaseMedical } from "lucide-react";
import type { ClinicProfessionalRow } from "@/lib/laravel-api";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

const initials = (value: string) =>
  value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export default function ClinicProfessionalScopeSelector(props: {
  professionals: ClinicProfessionalRow[];
  selectedProfessionalId: number | null;
  onSelect: (professionalId: number) => void;
  title?: string;
  description?: string;
  metricLabel?: string;
}): JSX.Element | null {
  const {
    professionals,
    selectedProfessionalId,
    onSelect,
    title = "Escolha o terapeuta",
    description = "Clique em um perfil para visualizar os dados daquele profissional.",
    metricLabel = "paciente(s) vinculado(s)",
  } = props;

  if (professionals.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {professionals.map((professional) => {
          const isSelected = selectedProfessionalId === professional.id;
          return (
            <button
              key={professional.id}
              type="button"
              onClick={() => onSelect(professional.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected ? "border-primary bg-primary/10 shadow-sm" : "border-border bg-card hover:shadow-sm"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden border border-border bg-gradient-to-br from-brand-green to-brand-green-dark flex items-center justify-center text-white font-semibold text-xs sm:text-sm flex-shrink-0">
                  {professional.profile_photo_url ? (
                    <img src={normalizeMediaUrl(professional.profile_photo_url)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initials(professional.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{professional.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{professional.email}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-brand-green/10 px-2.5 py-1 text-brand-green">
                      {professional.assigned_users_count} {metricLabel}
                    </span>
                    {professional.professional_crfa ? (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-muted-foreground">
                        {professional.professional_crfa}
                      </span>
                    ) : null}
                    {professional.professional_registration ? (
                      <span className="rounded-full bg-brand-blue/10 px-2.5 py-1 text-brand-blue">
                        Registro: {professional.professional_registration}
                      </span>
                    ) : null}
                  </div>
                </div>
                {isSelected ? <BriefcaseMedical className="h-4 w-4 text-primary flex-shrink-0" /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
