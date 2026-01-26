import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { notificationMarkRead, notificationsList, type AppNotificationRow } from "@/lib/laravel-api";
import SchedulePurchasedSessionsModal, { type SaleMeta } from "@/features/appointments/SchedulePurchasedSessionsModal";

const SEEN_KEY = "sementes.sales.seen_ids.v1";

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

function parseSaleNotification(n: AppNotificationRow): SaleMeta | null {
  const kind = String(n?.data?.kind || "");
  if (kind !== "package_sale") return null;
  const s = n?.data?.sale;
  const patientId = Number(s?.patient_id);
  const sessions = Number(s?.sessions);
  if (!Number.isFinite(patientId) || patientId < 1) return null;
  if (!Number.isFinite(sessions) || sessions < 1) return null;
  const patientName = String(s?.patient_name || "Paciente");
  const paymentId = Number(s?.payment_id);
  const amount = Number(s?.amount);
  const paymentStatus = typeof s?.payment_status === "string" ? String(s.payment_status) : null;
  const professionals = Array.isArray(s?.professionals) ? s.professionals : [];
  return {
    notificationId: n.id,
    patient: { id: patientId, name: patientName },
    sessions,
    amount: Number.isFinite(amount) ? amount : undefined,
    paymentId: Number.isFinite(paymentId) ? paymentId : undefined,
    paymentStatus,
    professionals: professionals
      .map((p: any) => ({ id: Number(p?.id), name: String(p?.name || "") }))
      .filter((p: any) => Number.isFinite(p.id) && p.id > 0 && p.name),
  };
}

export default function SaleSchedulerListener() {
  const auth = useAuth();
  const location = useLocation();
  const role = useMemo(() => String(auth.user?.role || "").toLowerCase().trim(), [auth.user?.role]);
  const isAdmin = role === "admin" || role.includes("admin");
  const isProfessional = role.includes("professional") || role.includes("profissional");
  const enabled = !!auth.user && (isAdmin || isProfessional) && !location.pathname.startsWith("/preview-");

  const [open, setOpen] = useState(false);
  const [sale, setSale] = useState<SaleMeta | null>(null);

  const seenRef = useRef<Set<string>>(new Set());
  const pollingRef = useRef<number | null>(null);

  const tick = useCallback(async () => {
    if (!enabled) return;
    if (open) return; // não interrompe modal aberto
    try {
      const res = await notificationsList(10);
      const unread = (res.data || []).filter((n) => !n.read_at);
      const newestSale = unread.find((n) => String(n?.data?.kind || "") === "package_sale" && (n?.data?.ui?.open_modal ?? true));
      if (!newestSale) return;
      if (seenRef.current.has(newestSale.id)) return;

      const parsed = parseSaleNotification(newestSale);
      if (!parsed) return;

      // marca como "visto" localmente pra não reabrir
      seenRef.current.add(newestSale.id);
      saveSeen(seenRef.current);

      setSale(parsed);
      setOpen(true);
    } catch {
      // ignore
    }
  }, [enabled, open]);

  useEffect(() => {
    if (!enabled) return;
    seenRef.current = loadSeen();

    void tick();
    pollingRef.current = window.setInterval(() => void tick(), 2_000);
    return () => {
      if (pollingRef.current) window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    };
  }, [enabled, tick]);

  const onScheduled = useCallback(async () => {
    if (!sale) return;
    try {
      await notificationMarkRead(sale.notificationId);
    } catch {
      // ignore
    }
  }, [sale]);

  if (!enabled) return null;

  return (
    <SchedulePurchasedSessionsModal
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) setSale(null);
      }}
      sale={sale}
      role={isAdmin ? "admin" : "professional"}
      onScheduled={onScheduled}
    />
  );
}

