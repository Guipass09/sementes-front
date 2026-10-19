import ProfessionalShareDialog from "@/features/sharing/ProfessionalShareDialog";
import { adminShareGame, professionalShareGame } from "@/lib/laravel-api";

type Props = { open: boolean; onOpenChange: (open: boolean) => void; mode: "admin" | "professional"; gameType: string; gameId: number; title: string };

export function ShareGameModal({ open, onOpenChange, mode, gameType, gameId, title }: Props) {
  return <ProfessionalShareDialog open={open} onOpenChange={onOpenChange} resourceKey={`${gameType}:${mode}:${gameId}`} kind="jogo" title={title}
    onShare={(shareId) => mode === "admin" ? adminShareGame(gameType, gameId, shareId) : professionalShareGame(gameType, gameId, shareId)} />;
}
