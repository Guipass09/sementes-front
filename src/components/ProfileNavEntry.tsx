import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { Portal as TooltipPortal } from "@radix-ui/react-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { isResourceLinkActive } from "@/lib/resource-navigation";
import type { ProfileNavItem } from "@/components/ProfileShell";

export default function ProfileNavEntry({ item, collapsed, onNavigate }: {
  item: ProfileNavItem;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(item.active);
  const Icon = item.icon;
  const children = item.children ?? [];
  const submenuId = `profile-submenu-${item.path.replace(/\//g, "-")}`;

  useEffect(() => {
    if (item.active) setExpanded(true);
  }, [item.active, location.pathname, location.search]);

  const rowClass = `relative flex min-h-[46px] w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#438e62] ${item.active
    ? "bg-[#deece2] font-semibold text-[#22633e] before:absolute before:bottom-3.5 before:left-0 before:top-3.5 before:w-[3px] before:rounded-full before:bg-[#438e62] dark:bg-[#304a39] dark:text-[#d2e8d9]"
    : "font-medium text-[#536359] hover:bg-[#e5eee7] hover:text-[#304b3a] dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"}`;

  if (!children.length) return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        <Link to={item.path} onClick={onNavigate} aria-current={item.active ? "page" : undefined} aria-label={item.label} className={`${rowClass} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
          <Icon size={19} strokeWidth={1.7} className="flex-none" />
          <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipPortal><TooltipContent side="right" sideOffset={12} className={collapsed ? "hidden lg:block" : "hidden"}>{item.label}</TooltipContent></TooltipPortal>
    </Tooltip>
  );

  return (
    <div>
      <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls={submenuId} className={`${rowClass} ${collapsed ? "lg:hidden" : ""}`}>
        <Icon size={19} strokeWidth={1.7} className="flex-none" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        <ChevronDown size={15} className={`flex-none transition-transform motion-reduce:transition-none ${expanded ? "rotate-180" : ""}`} />
      </button>
      {collapsed && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label={`Abrir opções de ${item.label.toLowerCase()}`} title={item.label} className={`${rowClass} hidden lg:flex lg:justify-center lg:px-0`}>
              <Icon size={19} strokeWidth={1.7} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={12} className="max-h-[70vh] w-64 overflow-y-auto">
            <DropdownMenuLabel>{item.label}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {children.map(child => (
              <DropdownMenuItem key={child.path} asChild>
                <Link to={child.path} onClick={onNavigate} aria-current={isResourceLinkActive(child.path, location.pathname, location.search) ? "page" : undefined} className="min-h-9 whitespace-normal aria-[current=page]:bg-primary/10 aria-[current=page]:font-semibold">
                  {child.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <div id={submenuId} hidden={!expanded} className={collapsed ? "lg:hidden" : ""}>
        <div className="ml-[21px] mt-1 space-y-0.5 border-l border-[#cfded3] pb-2 pl-3 dark:border-white/15">
          {children.map(child => {
            const active = isResourceLinkActive(child.path, location.pathname, location.search);
            return (
              <Link key={child.path} to={child.path} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`flex min-h-9 items-center rounded-md px-2 py-2 text-xs leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#438e62] ${active ? "bg-[#deece2] font-semibold text-[#22633e] dark:bg-[#304a39] dark:text-[#d2e8d9]" : "text-[#536359] hover:bg-[#e5eee7] hover:text-[#304b3a] dark:text-white/75 dark:hover:bg-white/10"}`}>
                {child.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
