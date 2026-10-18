import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu, X, type LucideIcon } from "lucide-react";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import NotificationsBell from "@/components/NotificationsBell";
import PwaInstallButton from "@/components/PwaInstallButton";

export type ProfileNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
};

type Props = {
  homePath: string;
  name: string;
  subtitle: string;
  photoUrl?: string | null;
  navItems: ProfileNavItem[];
  onProfile: () => void;
  onLogout: () => void;
  actions?: ReactNode;
  children: ReactNode;
};

export default function ProfileShell({
  homePath,
  name,
  subtitle,
  photoUrl,
  navItems,
  onProfile,
  onLogout,
  actions,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background/95 shadow-sm backdrop-blur-md">
        <div className="flex h-full items-center justify-between gap-2 px-3 sm:px-5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-md text-foreground hover:bg-muted lg:hidden"
              aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={menuOpen}
              aria-controls="profile-navigation"
            >
              {menuOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
            <Link to={homePath} className="flex min-w-0 items-center gap-2" aria-label="Sementes da Fala - início">
              <img src={logoImage} alt="" className="h-9 w-9 flex-none rounded-md object-contain" />
              <span className="hidden truncate font-display text-base font-bold sm:inline">
                <span className="text-brand-green">Sementes</span> <span className="text-brand-brown">da Fala</span>
              </span>
            </Link>
          </div>

          <div className="flex flex-none items-center gap-1 sm:gap-2">
            {actions}
            <NotificationsBell />
            <div className="hidden sm:block"><PwaInstallButton /></div>
            <span className="mx-1 hidden h-7 w-px bg-border lg:block" />
            <button
              type="button"
              onClick={onProfile}
              className="flex max-w-[250px] items-center gap-2 rounded-md p-1 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={`Editar perfil de ${name}`}
            >
              <span className="block min-w-0 text-right">
                <span className="block max-w-[72px] truncate text-xs font-semibold leading-tight text-foreground sm:max-w-[140px] sm:text-sm xl:max-w-[190px]">{name}</span>
                <span className="block max-w-[72px] truncate text-[10px] leading-tight text-muted-foreground sm:max-w-[140px] sm:text-xs xl:max-w-[190px]">{subtitle}</span>
              </span>
              <span className="flex h-9 w-9 flex-none items-center justify-center overflow-hidden rounded-full border border-border bg-primary/10 text-xs font-semibold text-primary">
                {photoUrl ? <img src={normalizeMediaUrl(photoUrl)} alt="" className="h-full w-full object-cover" /> : initials}
              </span>
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"
          onClick={() => setMenuOpen(false)}
          aria-label="Fechar menu de navegação"
        />
      )}

      <aside
        id="profile-navigation"
        className={`fixed bottom-0 left-0 top-16 z-40 flex w-60 flex-col border-r border-border bg-background shadow-xl transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 lg:shadow-none ${menuOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}
        aria-label="Menu principal"
      >
        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Navegação principal">
          <p className="mb-3 px-3 text-xs font-semibold uppercase text-muted-foreground">Navegação</p>
          <div className="space-y-1">
            {navItems.map(({ path, label, icon: Icon, active }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md border-l-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <Icon size={18} className="flex-none" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        </nav>
        <div className="border-t border-border px-3 py-3">
          <div className="sm:hidden"><PwaInstallButton /></div>
          <button
            type="button"
            onClick={onLogout}
            className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <main className="min-h-screen min-w-0 pt-16 lg:pl-60">
        {children}
      </main>
    </div>
  );
}
