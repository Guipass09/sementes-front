import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, type LucideIcon } from "lucide-react";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import logoImage from "@/assets/logo-sementes-da-fala.jpg";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";
import NotificationsBell from "@/components/NotificationsBell";
import PwaInstallButton from "@/components/PwaInstallButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import ProfileNavEntry from "@/components/ProfileNavEntry";
import type { ResourceNavLink } from "@/lib/resource-navigation";

const MENU_STORAGE_KEY = "sementes.profile-menu-collapsed";

export type ProfileNavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
  children?: ResourceNavLink[];
};

type Props = {
  homePath: string;
  name: string;
  subtitle: string;
  subtitleIcon?: LucideIcon;
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
  subtitleIcon: SubtitleIcon,
  photoUrl,
  navItems,
  onProfile,
  onLogout,
  actions,
  children,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(MENU_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    try {
      window.localStorage.setItem(MENU_STORAGE_KEY, String(collapsed));
    } catch {
      // The menu remains usable when browser storage is unavailable.
    }
  }, [collapsed]);

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
                <span className="mt-0.5 flex max-w-[72px] items-center justify-end gap-1 text-[10px] leading-tight text-muted-foreground sm:max-w-[140px] sm:text-xs xl:max-w-[190px]" title={subtitle}>
                  {SubtitleIcon && <SubtitleIcon size={13} strokeWidth={1.7} className="flex-none text-brand-green-dark dark:text-primary" aria-hidden="true" />}
                  <span className="truncate">{subtitle}</span>
                </span>
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
        className={`fixed bottom-0 left-0 top-16 z-40 flex w-60 flex-col border-r border-[#d9e3dc] bg-[#f0f5f1] shadow-xl transition-[width,transform,visibility] duration-200 motion-reduce:transition-none dark:border-white/10 dark:bg-[#202c25] lg:visible lg:translate-x-0 lg:shadow-none ${collapsed ? "lg:w-[76px]" : "lg:w-60"} ${menuOpen ? "visible translate-x-0" : "invisible -translate-x-full"}`}
        aria-label="Menu principal"
      >
        <div className={`flex h-16 flex-none items-center justify-between gap-2 px-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <p className={`truncate px-2 text-xs font-semibold uppercase text-[#708076] dark:text-white/60 ${collapsed ? "lg:hidden" : ""}`}>Meu espaço</p>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="hidden h-8 w-8 flex-none items-center justify-center rounded-md text-[#536359] hover:bg-[#e5eee7] hover:text-[#22633e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#438e62] dark:text-white/75 dark:hover:bg-white/10 lg:inline-flex"
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                aria-expanded={!collapsed}
                aria-controls="profile-navigation-links"
              >
                {collapsed ? <PanelLeftOpen size={18} strokeWidth={1.7} /> : <PanelLeftClose size={18} strokeWidth={1.7} />}
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="right" sideOffset={12}>{collapsed ? "Expandir menu" : "Recolher menu"}</TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </div>
        <nav id="profile-navigation-links" className="min-h-0 flex-1 overflow-y-auto px-3 pb-5" aria-label="Navegação principal">
          <div className="space-y-1">
            {navItems.map(item => (
              <ProfileNavEntry key={item.path} item={item} collapsed={collapsed} onNavigate={() => setMenuOpen(false)} />
            ))}
          </div>
        </nav>
        <div className="border-t border-[#dbe5de] px-3 py-3 dark:border-white/10">
          <div className="sm:hidden"><PwaInstallButton /></div>
          <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={onLogout}
                aria-label="Sair"
                className={`mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-[#536359] hover:bg-[#e5eee7] hover:text-[#304b3a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#438e62] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
              >
                <LogOut size={19} strokeWidth={1.7} className="flex-none" />
                <span className={collapsed ? "lg:hidden" : ""}>Sair</span>
              </button>
            </TooltipTrigger>
            <TooltipPortal>
              <TooltipContent side="right" sideOffset={12} className={collapsed ? "hidden lg:block" : "hidden"}>Sair</TooltipContent>
            </TooltipPortal>
          </Tooltip>
        </div>
      </aside>

      <main className={`min-h-screen min-w-0 pt-16 transition-[padding-left] duration-200 motion-reduce:transition-none ${collapsed ? "lg:pl-[76px]" : "lg:pl-60"}`}>
        {children}
      </main>
    </div>
  );
}
