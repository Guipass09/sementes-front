import logoImage from "@/assets/logo-sementes-da-fala.jpg";

export default function FullScreenLogoLoader({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[9999] bg-background/85 backdrop-blur-sm">
      <div className="h-full w-full flex items-center justify-center px-6">
        <div className="text-center">
          <div className="mx-auto w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-3xl overflow-hidden border border-border bg-card shadow-sm app-logo-pop">
            <img src={logoImage} alt="Sementes da Fala" className="w-full h-full object-contain" />
          </div>
          <div className="mt-5 text-base sm:text-lg text-muted-foreground flex items-center justify-center gap-3">
            <span className="app-dots" aria-hidden="true" />
            <span>{label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


