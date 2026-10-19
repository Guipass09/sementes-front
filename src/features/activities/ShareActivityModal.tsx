import ProfessionalShareDialog from "@/features/sharing/ProfessionalShareDialog";
import { adminShareActivity, professionalShareActivity, type ActivityRow } from "@/lib/laravel-api";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; activity: ActivityRow | null; mode: "admin" | "professional" };

export function ShareActivityModal({ open, onOpenChange, activity, mode }: Props) {
  if (!activity) return null;
  return <ProfessionalShareDialog open={open} onOpenChange={onOpenChange} resourceKey={`activity:${mode}:${activity.id}`} kind="atividade" title={activity.title}
    onShare={(shareId) => mode === "admin" ? adminShareActivity(activity.id, shareId) : professionalShareActivity(activity.id, shareId)} />;
}
