import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/auth/AuthContext";
import {
  notificationMarkRead,
  notificationsList,
  notificationsMarkAllRead,
  notificationsUnreadCount,
  type AppNotificationRow,
} from "@/lib/laravel-api";

const SEEN_KEY = "sementes.notifications.seen_ids.v1";

function loadSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map(String));
  } catch {
    return new Set();
  }
}

function saveSeen(seen: Set<string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-200)));
  } catch {
    // ignore
  }
}

function formatWhen(iso?: string | null) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function inferActionPath(n: AppNotificationRow, isAdmin: boolean): string | null {
  const kind = String(n?.data?.kind || "");
  if (kind === "new_content") {
    return n?.data?.content?.action_path ?? null;
  }
  if (kind === "appointment_30min" || kind === "appointment_completed") {
    return isAdmin ? "/admin/horarios" : "/paciente/sessoes";
  }
  return null;
}

export default function NotificationsBell() {
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotificationRow[]>([]);
  const [unread, setUnread] = useState(0);
  const seenRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<number | null>(null);

  const isPreview = location.pathname.startsWith("/preview-");
  const isAdmin = useMemo(() => {
    const role = String(auth.user?.role || "").toLowerCase().trim();
    return role === "admin" || role.includes("admin");
  }, [auth.user?.role]);

  const refreshUnread = useCallback(async () => {
    if (!auth.user || isPreview) return;
    const res = await notificationsUnreadCount();
    setUnread(res.unread_count ?? 0);
  }, [auth.user, isPreview]);

  const refreshList = useCallback(async () => {
    if (!auth.user || isPreview) return;
    const res = await notificationsList(50);
    setItems(res.data || []);
    setUnread(res.unread_count ?? 0);
    return res;
  }, [auth.user, isPreview]);

  // Poll unread count + show toast for newest unseen unread notification
  useEffect(() => {
    if (!auth.user || isPreview) return;
    seenRef.current = loadSeen();

    const tick = async () => {
      try {
        const prev = unread;
        const res = await notificationsUnreadCount();
        const next = res.unread_count ?? 0;
        setUnread(next);

        if (next > prev) {
          const list = await notificationsList(10);
          const newest = (list.data || []).find((n) => !n.read_at);
          if (newest && !seenRef.current.has(newest.id)) {
            const title = String(newest?.data?.title || "Notificação");
            const body = String(newest?.data?.body || "");
            const iconUrl = String(newest?.data?.icon_url || "");

            toast({
              title: (
                <div className="flex items-center gap-2">
                  {iconUrl ? <img src={iconUrl} alt="" className="w-5 h-5 rounded" /> : null}
                  <span>{title}</span>
                </div>
              ),
              description: body,
            });

            seenRef.current.add(newest.id);
            saveSeen(seenRef.current);
          }
        }
      } catch {
        // ignore
      }
    };

    void refreshUnread();
    void tick();

    pollingRef.current = window.setInterval(() => void tick(), 30_000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user, isPreview]);

  // When opening, load list
  useEffect(() => {
    if (!open) return;
    void refreshList();
  }, [open, refreshList]);

  const handleOpenChange = (v: boolean) => setOpen(v);

  const markAll = useCallback(async () => {
    try {
      await notificationsMarkAllRead();
      await refreshList();
    } catch {
      // ignore
    }
  }, [refreshList]);

  const onClickNotification = useCallback(
    async (n: AppNotificationRow) => {
      try {
        if (!n.read_at) {
          await notificationMarkRead(n.id);
        }
        const path = inferActionPath(n, isAdmin);
        if (path) {
          setOpen(false);
          navigate(path);
        } else {
          await refreshList();
        }
      } catch {
        // ignore
      }
    },
    [isAdmin, navigate, refreshList],
  );

  if (!auth.user || isPreview) return null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted/50 transition-colors flex-shrink-0"
          aria-label="Notificações"
        >
          <Bell size={18} />
          {unread > 0 ? (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-0.5 rounded-full bg-brand-orange text-white text-[10px] flex items-center justify-center shadow">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-96 p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <p className="font-semibold">Notificações</p>
            <p className="text-xs text-muted-foreground">{unread > 0 ? `${unread} não lida(s)` : "Tudo em dia"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={() => void markAll()} disabled={unread === 0}>
            <Check className="mr-2" size={16} />
            Marcar tudo como lido
          </Button>
        </div>

        <div className="max-h-[420px] overflow-auto">
          {items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">Nenhuma notificação por enquanto.</div>
          ) : (
            <div className="divide-y">
              {items.map((n) => {
                const title = String(n?.data?.title || "Notificação");
                const body = String(n?.data?.body || "");
                const iconUrl = String(n?.data?.icon_url || "");
                const when = formatWhen(n.created_at);
                const isUnread = !n.read_at;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void onClickNotification(n)}
                    className={cn(
                      "w-full text-left px-4 py-3 hover:bg-muted/40 transition-colors",
                      isUnread && "bg-brand-orange/5",
                    )}
                  >
                    <div className="flex gap-3">
                      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {iconUrl ? <img src={iconUrl} alt="" className="w-full h-full object-cover" /> : <Bell size={18} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("font-semibold text-sm", isUnread ? "text-foreground" : "text-muted-foreground")}>
                            {title}
                          </p>
                          {isUnread ? <span className="mt-1 w-2 h-2 rounded-full bg-brand-orange flex-shrink-0" /> : null}
                        </div>
                        {body ? <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{body}</p> : null}
                        {when ? <p className="text-[11px] text-muted-foreground mt-1">{when}</p> : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

