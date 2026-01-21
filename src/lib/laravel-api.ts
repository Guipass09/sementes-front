export type AuthRole = "admin" | "user" | "professional";

/**
 * Permissões de acesso do usuário.
 * 
 * PERMISSÕES PADRÃO (definidas no backend):
 * Quando um usuário é criado via registro público (/api/register),
 * o backend deve aplicar automaticamente:
 * - inicio: true (sempre acessível)
 * - atividades: true
 * - jogos: true (sempre acessível)
 * - relatorios: true
 * - horarios/sessoes: true
 */
export type UserAccess = {
  atividades: boolean;
  horarios: boolean; // Controla acesso a "Sessões" (/paciente/sessoes)
  relatorios: boolean;
};

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  child_age?: number | null;
  role: AuthRole;
  blocked: boolean;
  profile_description?: string | null;
  profile_photo_url?: string | null;
  access: UserAccess;
};

export type ProfessionalUserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  profile_photo_url?: string | null;
};

export type ReportType = "mensal" | "trimestral" | "avaliacao";

export type ReportRow = {
  id: number;
  title: string;
  date: string; // YYYY-MM-DD
  type: ReportType;
  professional_name: string;
  content: string;
  summary: string;
  patient_name?: string;
  patient: { id: number; name: string };
  created_by: { id?: number; name: string; role: AuthRole };
};

export type ActivityStatus = "disponivel" | "em_andamento" | "concluida";
export type ActivityMediaType = "image" | "video";

export type ActivityMediaRow = {
  id: number;
  media_type: ActivityMediaType;
  url: string;
  thumbnail_url?: string | null;
  caption?: string | null;
  position: number;
};

export type ActivityRow = {
  id: number;
  title: string;
  description: string;
  category?: string | null;
  estimated_time?: string | null;
  status?: ActivityStatus; // user
  progress?: { current_step: number; completed_steps: number[]; total_steps: number } | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  media: ActivityMediaRow[];
  thumbnail?: ActivityMediaRow | null;
  created_at?: string | null;
};

// ---------------------------
// JOGO DA MEMÓRIA
// ---------------------------

export type MemoryGameStatus = "disponivel" | "concluido";

export type MemoryGameCardRow = {
  id: number;
  pair_key: number;
  url: string;
  position: number;
};

export type MemoryGameRow = {
  id: number;
  title: string;
  description: string;
  pairs_count: number;
  variant?: "classic" | "v2";
  status?: MemoryGameStatus; // user
  progress?: any | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  cards: MemoryGameCardRow[];
  thumbnail?: MemoryGameCardRow | null;
  created_at?: string | null;
};

export type AuditoryGameStatus = "disponivel" | "concluido";

export type AuditoryGameItemRow = {
  id: number;
  url: string;
  position: number;
  expected_side?: "left" | "right";
};

export type AuditoryGameRow = {
  id: number;
  title: string;
  description: string;
  items_count: number;
  background_url: string;
  status?: AuditoryGameStatus; // user
  progress?: any | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  items: AuditoryGameItemRow[];
  thumbnail?: AuditoryGameItemRow | null;
  created_at?: string | null;
};

// ---------------------------
// JOGO DA FORCA
// ---------------------------

export type HangmanGameStatus = "disponivel" | "concluido";

// ---------------------------
// JOGO DA ROLETA
// ---------------------------

export type SpinWheelGameStatus = "disponivel" | "concluido";

export type SpinWheelGameItemRow = {
  id: number;
  position: number;
  image_url: string;
  label: string;
  color?: string | null;
};

export type SpinWheelGameRow = {
  id: number;
  title: string;
  center_title?: string | null;
  background_url?: string | null;
  items_count: number;
  status?: SpinWheelGameStatus; // user
  progress?: any | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  items: SpinWheelGameItemRow[];
  thumbnail?: { url: string } | null;
  created_at?: string | null;
};

// ---------------------------
// DISCRIMINAÇÃO FONEMA
// ---------------------------

export type PhonemeGameStatus = "disponivel" | "concluido";

export type PhonemeGameItemRow = {
  id: number;
  position: number;
  word: string;
  left_url: string;
  right_url: string;
  correct_side: "left" | "right";
};

export type PhonemeGameRow = {
  id: number;
  title: string;
  description: string;
  sessions_count: number;
  background_url: string;
  status?: PhonemeGameStatus; // user
  progress?: any | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  items: PhonemeGameItemRow[];
  thumbnail?: PhonemeGameItemRow | null;
  created_at?: string | null;
};

// ---------------------------
// CAÇA-PALAVRAS
// ---------------------------

export type WordSearchGameStatus = "disponivel" | "concluido";

export type WordSearchGameItemRow = {
  id: number;
  position: number;
  word: string;
  image_url: string;
  direction: "horizontal" | "vertical";
  start_row: number;
  start_col: number;
};

export type WordSearchGameRow = {
  id: number;
  title: string;
  description: string;
  words_count: number;
  background_url: string;
  status?: WordSearchGameStatus; // user
  progress?: any | null;
  grid_data?: { grid: string[][]; size: number; placed: any } | null;
  letter_color?: string; // Cor das letras (hex)
  grid_background_color?: string; // Cor do fundo do grid (hex)
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  items: WordSearchGameItemRow[];
  created_at?: string | null;
};

// ---------------------------
// JOGO DAS CARTAS
// ---------------------------

export type CardGameStatus = "disponivel" | "concluido";

export type CardGameRow = {
  id: number;
  title: string;
  description: string;
  cards_count: number;
  background_url?: string | null;
  cards?: Array<{ id: number; position: number; url: string | null }>;
  status?: CardGameStatus; // user
  progress?: any | null; // user
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  created_at?: string | null;
};

export type HangmanSupportImageRow = {
  position: number;
  url: string;
};

export type HangmanGameRow = {
  id: number;
  title: string;
  description: string;
  word_length: number;
  secret_word?: string; // user/admin (não exibir na UI)
  status?: HangmanGameStatus; // user
  progress?: any | null;
  created_by: { id?: number; name: string; role: AuthRole };
  assigned_count?: number; // admin
  assigned_to?: Array<{ id: number; name: string }>; // admin
  support_images: HangmanSupportImageRow[];
  thumbnail?: HangmanSupportImageRow | null;
  created_at?: string | null;
};

// ---------------------------
// NOTIFICAÇÕES (IN-APP)
// ---------------------------

export type AppNotificationRow = {
  id: string;
  type: string;
  data: any;
  read_at?: string | null;
  created_at?: string | null;
};

export type NotificationsListResponse = {
  data: AppNotificationRow[];
  unread_count: number;
};

type ApiError = {
  status: number;
  data: any;
};

import api from "../services/api";

async function request<T>(
  path: string,
  options: { method?: string; json?: any; formData?: FormData; __csrfRetried?: boolean; headers?: Record<string,string>; keepalive?: boolean; body?: any } = {}
): Promise<T> {
  const method = (options.method || "GET").toUpperCase();
  const hasJsonBody = options.json !== undefined;
  const hasFormData = options.formData !== undefined;

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(options.headers || {}),
  };

  if (hasJsonBody) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await api.request({
      url: path,
      method,
      data: hasFormData ? options.formData : hasJsonBody ? options.json : options.body,
      headers,
      // keepalive is used by fetch; axios does not support it directly — ignore safely
      validateStatus: () => true,
    });

    // Note: token-based auth (Bearer) in frontend; do not retry CSRF here.

    if (res.status === 204) return null as unknown as T;

    if (res.status >= 200 && res.status < 300) {
      return res.data as T;
    }

    const err: ApiError = { status: res.status, data: res.data };
    throw err;
  } catch (e: any) {
    if (e && e.response) {
      throw { status: e.response.status, data: e.response.data } as ApiError;
    }
    throw e;
  }
}

export async function ensureCsrfCookie(): Promise<void> {
  // No-op when using token-based auth in frontend.
  return;
}

export async function me(): Promise<AuthUser> {
  return await request<AuthUser>("/api/me");
}

export async function notificationsList(limit = 50): Promise<NotificationsListResponse> {
  return await request<NotificationsListResponse>(`/api/notifications?limit=${encodeURIComponent(String(limit))}`);
}

export async function notificationsUnreadCount(): Promise<{ unread_count: number }> {
  return await request<{ unread_count: number }>("/api/notifications/unread-count");
}

export async function notificationMarkRead(id: string): Promise<{ success: true }> {
  return await request<{ success: true }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" });
}

export async function notificationsMarkAllRead(): Promise<{ success: true }> {
  return await request<{ success: true }>("/api/notifications/read-all", { method: "POST" });
}

export async function registerPushToken(playerId: string, deviceType?: string, deviceInfo?: string): Promise<{ success: boolean }> {
  return await request<{ success: boolean }>("/api/notifications/push/register", {
    method: "POST",
    json: { player_id: playerId, device_type: deviceType, device_info: deviceInfo },
  });
}

export async function unregisterPushToken(playerId: string): Promise<{ success: boolean }> {
  return await request<{ success: boolean }>("/api/notifications/push/unregister", {
    method: "POST",
    json: { player_id: playerId },
  });
}

export async function updateMe(payload: {
  name?: string;
  profile_description?: string | null;
  profile_photo?: File | null;
  remove_photo?: boolean;
}): Promise<AuthUser> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.name !== undefined) fd.set("name", payload.name);
  if (payload.profile_description !== undefined)
    fd.set("profile_description", payload.profile_description ?? "");
  if (payload.profile_photo) fd.set("profile_photo", payload.profile_photo);
  if (payload.remove_photo) fd.set("remove_photo", "1");
  // Use POST with _method=PATCH for FormData to work properly with Laravel
  fd.set("_method", "PATCH");
  return await request<AuthUser>("/api/me", { method: "POST", formData: fd });
}

export async function login(params: {
  email: string;
  password: string;
  remember?: boolean;
}): Promise<{ token: string; user: AuthUser }> {
  // backend returns { token, user }
  return await request<{ token: string; user: AuthUser }>("/api/login", {
    method: "POST",
    json: {
      email: params.email,
      password: params.password,
      remember: !!params.remember,
    },
  });
}

export async function register(params: {
  name: string;
  email: string;
  phone: string;
  child_age?: number | null;
  password: string;
  password_confirmation: string;
}): Promise<AuthUser> {
  await ensureCsrfCookie();
  return await request<AuthUser>("/api/register", {
    method: "POST",
    json: params,
  });
}

export async function registerProfessional(params: {
  name: string;
  email: string;
  phone: string;
  professional_age: number;
  professional_crfa: string;
  password: string;
  password_confirmation: string;
}): Promise<{ token: string; user: AuthUser }> {
  await ensureCsrfCookie();
  return await request<{ token: string; user: AuthUser }>("/api/register-professional", {
    method: "POST",
    json: params,
  });
}

export async function professionalListUsers(): Promise<{ data: ProfessionalUserRow[] }> {
  return await request<{ data: ProfessionalUserRow[] }>("/api/professional/users");
}

export async function professionalListAppointments(): Promise<{ data: any[] }> {
  return await request<{ data: any[] }>("/api/professional/appointments");
}

export async function professionalListActivities(): Promise<ActivityRow[]> {
  const res = await request<{ data: ActivityRow[] }>("/api/professional/activities");
  return res.data ?? [];
}

export async function professionalGetActivity(id: number): Promise<ActivityRow> {
  return await request<ActivityRow>(`/api/professional/activities/${id}`);
}

export async function professionalCreateActivity(payload: {
  title: string;
  description: string;
  category?: string;
  estimated_time?: string;
  assigned_to: number[];
  media: Array<{ file: File; media_type: ActivityMediaType; caption: string; thumbnail?: File | null }>;
}): Promise<ActivityRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  if (payload.category) fd.set("category", payload.category);
  if (payload.estimated_time) fd.set("estimated_time", payload.estimated_time);
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  payload.media.forEach((m, idx) => {
    fd.append("media_files[]", m.file);
    fd.append("media_types[]", m.media_type);
    fd.append("media_captions[]", m.caption ?? "");
    fd.append("media_positions[]", String(idx));
    if (m.media_type === "video" && m.thumbnail) {
      fd.append(`media_thumbnails[${idx}]`, m.thumbnail);
    }
  });
  return await request<ActivityRow>("/api/professional/activities", { method: "POST", formData: fd });
}

export async function professionalUpdateActivity(
  id: number,
  payload: Partial<{ title: string; description: string; category: string; estimated_time: string; assigned_to: number[] }>
): Promise<ActivityRow> {
  await ensureCsrfCookie();
  const json: any = { ...payload };
  if (payload.assigned_to) {
    json.assigned_to_json = JSON.stringify(payload.assigned_to);
    delete json.assigned_to;
  }
  return await request<ActivityRow>(`/api/professional/activities/${id}`, { method: "PATCH", json });
}

export async function professionalAddActivityMedia(params: {
  activity_id: number;
  file: File;
  media_type: ActivityMediaType;
  caption?: string;
  position?: number;
  thumbnail?: File | null;
}): Promise<ActivityMediaRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("file", params.file);
  fd.set("media_type", params.media_type);
  if (params.caption) fd.set("caption", params.caption);
  if (params.position !== undefined) fd.set("position", String(params.position));
  if (params.media_type === "video" && params.thumbnail) fd.set("thumbnail", params.thumbnail);
  return await request<ActivityMediaRow>(`/api/professional/activities/${params.activity_id}/media`, { method: "POST", formData: fd });
}

export async function professionalDeleteActivity(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/activities/${id}`, { method: "DELETE" });
}

export async function professionalDeleteActivityMedia(params: { activity_id: number; media_id: number }): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/activities/${params.activity_id}/media/${params.media_id}`, { method: "DELETE" });
}

export async function professionalListReports(): Promise<ReportRow[]> {
  const res = await request<{ data: ReportRow[] }>("/api/professional/reports");
  return res.data ?? [];
}

export async function professionalCreateReport(payload: {
  user_id: number;
  patient_name: string;
  professional_name: string;
  title: string;
  report_date: string;
  type: ReportType;
  content: string;
}): Promise<ReportRow> {
  await ensureCsrfCookie();
  return await request<ReportRow>("/api/professional/reports", { method: "POST", json: payload });
}

export async function professionalUpdateReport(
  id: number,
  payload: Partial<{
    user_id: number;
    patient_name: string;
    professional_name: string;
    title: string;
    report_date: string;
    type: ReportType;
    content: string;
  }>
): Promise<ReportRow> {
  await ensureCsrfCookie();
  return await request<ReportRow>(`/api/professional/reports/${id}`, { method: "PATCH", json: payload });
}

export async function professionalDeleteReport(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/reports/${id}`, { method: "DELETE" });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  await ensureCsrfCookie();
  return await request<{ message: string }>("/api/forgot-password", { method: "POST", json: { email } });
}

export async function resetPassword(payload: {
  email: string;
  token: string;
  password: string;
  password_confirmation: string;
}): Promise<{ message: string }> {
  await ensureCsrfCookie();
  return await request<{ message: string }>("/api/reset-password", { method: "POST", json: payload });
}

export async function logout(): Promise<void> {
  await ensureCsrfCookie();
  await request<void>("/api/logout", { method: "POST" });
}

export async function getWeeklySlotAvailability(): Promise<{
  unavailable: Record<string, string[]>;
  as_of: string;
}> {
  return await request("/api/availability/weekly-slots");
}

export async function userRegisterPurchaseIntent(payload: {
  package_sessions: number;
  selected_slots?: Array<{ dayId: string; time: string }>;
}): Promise<void> {
  await ensureCsrfCookie();
  await request<void>("/api/packages/purchase-intent", {
    method: "POST",
    json: payload,
    keepalive: true,
  });
}

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  child_age?: number | null;
  role: AuthRole;
  blocked: boolean;
  access: UserAccess;
  profile_description?: string | null;
  profile_photo_url?: string | null;
  purchase_intent_message?: string | null;
  purchase_intent_at?: string | null;
  created_at?: string | null;
};

export type AdminProfessionalRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: "professional";
  blocked: boolean;
  access: UserAccess;
  profile_photo_url?: string | null;
  professional_age?: number | null;
  professional_crfa?: string | null;
  professional_registration?: string | null;
  assigned_users_count?: number;
};

export async function adminListUsers(): Promise<AdminUserRow[]> {
  const res = await request<{ data: AdminUserRow[] }>("/api/admin/users");
  return res.data;
}

export async function adminListProfessionals(): Promise<AdminProfessionalRow[]> {
  const res = await request<{ data: AdminProfessionalRow[] }>("/api/admin/professionals");
  return res.data ?? [];
}

export async function adminUpdateUser(
  id: number,
  payload: Partial<Pick<AdminUserRow, "blocked" | "access">>
): Promise<AdminUserRow> {
  await ensureCsrfCookie();
  return await request<AdminUserRow>(`/api/admin/users/${id}`, {
    method: "PATCH",
    json: payload,
  });
}

export async function adminUpdateProfessional(
  id: number,
  payload: Partial<
    Pick<
      AdminProfessionalRow,
      "blocked" | "access" | "name" | "email" | "phone" | "professional_age" | "professional_crfa" | "professional_registration"
    >
  >
): Promise<AdminProfessionalRow> {
  await ensureCsrfCookie();
  return await request<AdminProfessionalRow>(`/api/admin/professionals/${id}`, { method: "PATCH", json: payload });
}

export async function adminDeleteUser(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/users/${id}`, { method: "DELETE" });
}

export async function adminDeleteProfessional(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/professionals/${id}`, { method: "DELETE" });
}

export async function adminClearPurchaseIntent(userId: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/users/${userId}/purchase-intent`, { method: "DELETE" });
}

export async function adminGetUserProgressSummary(userId: number): Promise<{
  activities: { total: number; disponivel: number; em_andamento: number; concluida: number };
  memory_games: { total: number; disponivel: number; concluido: number };
  auditory_games: { total: number; disponivel: number; concluido: number };
  hangman_games: { total: number; disponivel: number; concluido: number };
}> {
  return await request(`/api/admin/users/${userId}/progress-summary`);
}

export type AdminDashboardMetrics = {
  total_users: number;
  scheduled_sessions: number;
};

export async function adminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  return await request<AdminDashboardMetrics>("/api/admin/dashboard-metrics");
}

export type JoinSessionMeta = {
  visible: boolean;
  enabled: boolean;
  blink: boolean;
  reason?: string | null;
  label?: string | null;
  logo_url?: string | null;
  available_from?: string | null;
  available_until?: string | null;
  server_now?: string | null;
};

export type AdminAppointmentRow = {
  id: number;
  user_id: number;
  professional_name: string;
  session_date: string; // YYYY-MM-DD
  session_time: string; // HH:mm:ss (ou HH:mm)
  total_sessions: number;
  status: "active" | "completed" | "canceled";
  created_at: string;
  updated_at: string;
  user?: { id: number; name: string; email: string };
  join_session?: JoinSessionMeta;
};

export type CustomPackageRow = {
  id: number;
  user_id: number;
  title: string;
  sessions_count: number;
  price_per_session: number | string;
  total_price: number | string;
  payment_url: string;
  user?: { id: number; name: string };
  created_at?: string;
  updated_at?: string;
};

export async function adminListAppointments(): Promise<AdminAppointmentRow[]> {
  const res = await request<{ data: AdminAppointmentRow[] }>("/api/admin/appointments");
  return res.data;
}

export async function adminListCustomPackages(userId: number): Promise<CustomPackageRow[]> {
  const res = await request<{ data: CustomPackageRow[] }>(`/api/admin/users/${userId}/custom-packages`);
  return res.data;
}

export async function adminListAllCustomPackages(): Promise<CustomPackageRow[]> {
  const res = await request<{ data: CustomPackageRow[] }>("/api/admin/custom-packages");
  return res.data;
}

export async function adminCreateCustomPackage(
  userId: number,
  payload: {
    title: string;
    sessions_count: number;
    price_per_session: number;
    total_price: number;
    payment_url: string;
  }
): Promise<CustomPackageRow> {
  await ensureCsrfCookie();
  return await request<CustomPackageRow>(`/api/admin/users/${userId}/custom-packages`, {
    method: "POST",
    json: payload,
  });
}

export async function adminUpdateCustomPackage(
  id: number,
  payload: Partial<{
    title: string;
    sessions_count: number;
    price_per_session: number;
    total_price: number;
    payment_url: string;
  }>
): Promise<CustomPackageRow> {
  await ensureCsrfCookie();
  return await request<CustomPackageRow>(`/api/admin/custom-packages/${id}`, {
    method: "PATCH",
    json: payload,
  });
}

export async function adminDeleteCustomPackage(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/custom-packages/${id}`, { method: "DELETE" });
}

export async function adminCreateRecurringAppointments(payload: {
  user_id: number;
  professional_name: string;
  professional_user_id?: number | null;
  start_date: string; // YYYY-MM-DD (define o dia da semana)
  session_time: string; // HH:mm
  quantity: number; // quantidade de sessões a criar
}): Promise<{ message: string; dates: string[] }> {
  await ensureCsrfCookie();
  return await request<{ message: string; dates: string[] }>("/api/admin/appointments/recurring", {
    method: "POST",
    json: payload,
  });
}

export async function adminGetUserProfessionals(userId: number): Promise<{ professional_ids: number[] }> {
  return await request<{ professional_ids: number[] }>(`/api/admin/users/${userId}/professionals`);
}

export async function adminSetUserProfessionals(userId: number, professional_ids: number[]): Promise<{ professional_ids: number[] }> {
  await ensureCsrfCookie();
  return await request<{ professional_ids: number[] }>(`/api/admin/users/${userId}/professionals`, {
    method: "PUT",
    json: { professional_ids },
  });
}

export type ProfessionalPatientRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  child_age?: number | null;
  profile_photo_url?: string | null;
};

export async function professionalListPatients(): Promise<ProfessionalPatientRow[]> {
  const res = await request<{ data: ProfessionalPatientRow[] }>("/api/professional/patients");
  return res.data ?? [];
}

export async function professionalGetPatientOverview(userId: number): Promise<any> {
  return await request(`/api/professional/patients/${userId}/overview`);
}

// ---------------------------
// PROFESSIONAL GAMES
// ---------------------------

export async function professionalListMemoryGames(opts?: { variant?: "classic" | "v2" }): Promise<MemoryGameRow[]> {
  const qs = opts?.variant ? `?variant=${encodeURIComponent(opts.variant)}` : "";
  const res = await request<{ data: MemoryGameRow[] }>(`/api/professional/memory-games${qs}`);
  return res.data;
}

export async function professionalGetMemoryGame(id: number): Promise<MemoryGameRow> {
  return await request<MemoryGameRow>(`/api/professional/memory-games/${id}`);
}

export async function professionalCreateMemoryGame(payload: {
  title: string;
  description: string;
  pairs_count: number;
  variant?: "classic" | "v2";
  assigned_to: number[];
  pair_images: File[];
}): Promise<MemoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("pairs_count", String(payload.pairs_count));
  if (payload.variant) fd.set("variant", payload.variant);
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  payload.pair_images.forEach((f) => fd.append("pair_images[]", f));
  return await request<MemoryGameRow>("/api/professional/memory-games", { method: "POST", formData: fd });
}

export async function professionalUpdateMemoryGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    pair_images: File[];
  }>
): Promise<MemoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.pair_images !== undefined) payload.pair_images.forEach((f) => fd.append("pair_images[]", f));
  fd.set("_method", "PATCH");
  return await request<MemoryGameRow>(`/api/professional/memory-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteMemoryGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/memory-games/${id}`, { method: "DELETE" });
}

export async function professionalListAuditoryGames(): Promise<AuditoryGameRow[]> {
  const res = await request<{ data: AuditoryGameRow[] }>("/api/professional/auditory-games");
  return res.data;
}

export async function professionalGetAuditoryGame(id: number): Promise<AuditoryGameRow> {
  return await request<AuditoryGameRow>(`/api/professional/auditory-games/${id}`);
}

export async function professionalCreateAuditoryGame(payload: {
  title: string;
  description: string;
  items_count: 4 | 6 | 10;
  assigned_to: number[];
  background: File;
  items: File[];
  items_sides: Array<"certo" | "errado">;
}): Promise<AuditoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("items_count", String(payload.items_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  payload.items.forEach((f) => fd.append("items[]", f));
  fd.set("items_sides_json", JSON.stringify(payload.items_sides));
  return await request<AuditoryGameRow>("/api/professional/auditory-games", { method: "POST", formData: fd });
}

export async function professionalUpdateAuditoryGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    background: File;
    items: File[];
    items_sides: Array<"certo" | "errado">;
  }>
): Promise<AuditoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined) fd.set("background", payload.background);
  if (payload.items !== undefined) payload.items.forEach((f) => fd.append("items[]", f));
  if (payload.items_sides !== undefined) fd.set("items_sides_json", JSON.stringify(payload.items_sides));
  fd.set("_method", "PATCH");
  return await request<AuditoryGameRow>(`/api/professional/auditory-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteAuditoryGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/auditory-games/${id}`, { method: "DELETE" });
}

export async function professionalListPhonemeGames(): Promise<PhonemeGameRow[]> {
  const res = await request<{ data: PhonemeGameRow[] }>("/api/professional/phoneme-games");
  return res.data;
}

export async function professionalGetPhonemeGame(id: number): Promise<PhonemeGameRow> {
  return await request<PhonemeGameRow>(`/api/professional/phoneme-games/${id}`);
}

export async function professionalCreatePhonemeGame(payload: {
  title: string;
  description: string;
  sessions_count: number;
  assigned_to: number[];
  background: File;
  words: string[];
  correct_sides: Array<"left" | "right">;
  left_images: File[];
  right_images: File[];
}): Promise<PhonemeGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("sessions_count", String(payload.sessions_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  fd.set("words_json", JSON.stringify(payload.words || []));
  fd.set("correct_sides_json", JSON.stringify(payload.correct_sides || []));
  payload.left_images.forEach((f) => fd.append("left_images[]", f));
  payload.right_images.forEach((f) => fd.append("right_images[]", f));
  return await request<PhonemeGameRow>("/api/professional/phoneme-games", { method: "POST", formData: fd });
}

export async function professionalUpdatePhonemeGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    background: File;
    words: string[];
    correct_sides: Array<"left" | "right">;
    left_images: File[];
    right_images: File[];
  }>
): Promise<PhonemeGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined) fd.set("background", payload.background);
  if (payload.words !== undefined) fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.correct_sides !== undefined) fd.set("correct_sides_json", JSON.stringify(payload.correct_sides || []));
  if (payload.left_images !== undefined) payload.left_images.forEach((f) => fd.append("left_images[]", f));
  if (payload.right_images !== undefined) payload.right_images.forEach((f) => fd.append("right_images[]", f));
  fd.set("_method", "PATCH");
  return await request<PhonemeGameRow>(`/api/professional/phoneme-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeletePhonemeGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/phoneme-games/${id}`, { method: "DELETE" });
}

export async function professionalListHangmanGames(): Promise<HangmanGameRow[]> {
  const res = await request<{ data: HangmanGameRow[] }>("/api/professional/hangman-games");
  return res.data;
}

export async function professionalGetHangmanGame(id: number): Promise<HangmanGameRow> {
  return await request<HangmanGameRow>(`/api/professional/hangman-games/${id}`);
}

export async function professionalCreateHangmanGame(payload: {
  title: string;
  description: string;
  secret_word: string;
  assigned_to: number[];
  support_images?: File[];
}): Promise<HangmanGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("secret_word", payload.secret_word);
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  (payload.support_images || []).forEach((f) => fd.append("support_images[]", f));
  return await request<HangmanGameRow>("/api/professional/hangman-games", { method: "POST", formData: fd });
}

export async function professionalUpdateHangmanGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    secret_word: string;
    assigned_to: number[];
    clear_images: boolean;
    support_images: File[];
  }>
): Promise<HangmanGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.secret_word !== undefined) fd.set("secret_word", payload.secret_word);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.clear_images !== undefined) fd.set("clear_images", payload.clear_images ? "1" : "0");
  if (payload.support_images !== undefined) payload.support_images.forEach((f) => fd.append("support_images[]", f));
  fd.set("_method", "PATCH");
  return await request<HangmanGameRow>(`/api/professional/hangman-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteHangmanGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/hangman-games/${id}`, { method: "DELETE" });
}

export async function professionalListWordSearchGames(): Promise<WordSearchGameRow[]> {
  const res = await request<{ data: WordSearchGameRow[] }>("/api/professional/word-search-games");
  return res.data;
}

export async function professionalGetWordSearchGame(id: number): Promise<WordSearchGameRow> {
  return await request<WordSearchGameRow>(`/api/professional/word-search-games/${id}`);
}

export async function professionalCreateWordSearchGame(payload: {
  title: string;
  description: string;
  words_count: number;
  assigned_to: number[];
  background: File;
  words: string[];
  directions?: Array<"horizontal" | "vertical">;
  images: File[];
  letter_color?: string;
  grid_background_color?: string;
}): Promise<WordSearchGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("words_count", String(payload.words_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.directions) fd.set("directions_json", JSON.stringify(payload.directions));
  payload.images.forEach((f) => fd.append("images[]", f));
  if (payload.letter_color) fd.set("letter_color", payload.letter_color);
  if (payload.grid_background_color) fd.set("grid_background_color", payload.grid_background_color);
  return await request<WordSearchGameRow>("/api/professional/word-search-games", { method: "POST", formData: fd });
}

export async function professionalUpdateWordSearchGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    background: File;
    words: string[];
    directions: Array<"horizontal" | "vertical">;
    images: File[];
    letter_color: string;
    grid_background_color: string;
  }>
): Promise<WordSearchGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined) fd.set("background", payload.background);
  if (payload.words !== undefined) fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.directions !== undefined) fd.set("directions_json", JSON.stringify(payload.directions));
  if (payload.images !== undefined) payload.images.forEach((f) => fd.append("images[]", f));
  if (payload.letter_color !== undefined) fd.set("letter_color", payload.letter_color);
  if (payload.grid_background_color !== undefined) fd.set("grid_background_color", payload.grid_background_color);
  fd.set("_method", "PATCH");
  return await request<WordSearchGameRow>(`/api/professional/word-search-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteWordSearchGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/word-search-games/${id}`, { method: "DELETE" });
}

export async function professionalListCardGames(): Promise<CardGameRow[]> {
  const res = await request<{ data: CardGameRow[] }>("/api/professional/card-games");
  return res.data ?? [];
}

export async function professionalGetCardGame(id: number): Promise<CardGameRow> {
  return await request<CardGameRow>(`/api/professional/card-games/${id}`);
}

export async function professionalCreateCardGame(payload: {
  title: string;
  description: string;
  cards_count: number;
  assigned_to: number[];
  background?: File | null;
  card_images: File[];
}): Promise<CardGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("cards_count", String(payload.cards_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  payload.card_images.forEach((f) => fd.append("card_images[]", f));
  return await request<CardGameRow>("/api/professional/card-games", { method: "POST", formData: fd });
}

export async function professionalUpdateCardGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    cards_count: number;
    assigned_to: number[];
    background: File | null;
    card_images: File[];
  }>
): Promise<CardGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.cards_count !== undefined) fd.set("cards_count", String(payload.cards_count));
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined && payload.background) fd.set("background", payload.background);
  if (payload.card_images !== undefined) payload.card_images.forEach((f) => fd.append("card_images[]", f));
  fd.set("_method", "PATCH");
  return await request<CardGameRow>(`/api/professional/card-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteCardGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/card-games/${id}`, { method: "DELETE" });
}

export async function professionalListSpinWheelGames(): Promise<SpinWheelGameRow[]> {
  const res = await request<{ data: SpinWheelGameRow[] }>("/api/professional/spin-wheel-games");
  return res.data;
}

export async function professionalGetSpinWheelGame(id: number): Promise<SpinWheelGameRow> {
  return await request<SpinWheelGameRow>(`/api/professional/spin-wheel-games/${id}`);
}

export async function professionalCreateSpinWheelGame(payload: {
  title: string;
  center_title?: string | null;
  items_count: number;
  assigned_to: number[];
  background?: File | null;
  item_images: File[];
  item_labels: string[];
}): Promise<SpinWheelGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  if (payload.center_title) fd.set("center_title", payload.center_title);
  fd.set("items_count", String(payload.items_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  payload.item_images.forEach((f) => fd.append("item_images[]", f));
  payload.item_labels.forEach((l) => fd.append("item_labels[]", l));
  return await request<SpinWheelGameRow>("/api/professional/spin-wheel-games", { method: "POST", formData: fd });
}

export async function professionalUpdateSpinWheelGame(
  id: number,
  payload: Partial<{
    title: string;
    center_title: string | null;
    assigned_to: number[];
    background: File | null;
    item_images: File[];
    item_labels: string[];
  }>
): Promise<SpinWheelGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.center_title !== undefined) fd.set("center_title", payload.center_title ?? "");
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined && payload.background) fd.set("background", payload.background);
  if (payload.item_images !== undefined) payload.item_images.forEach((f) => fd.append("item_images[]", f));
  if (payload.item_labels !== undefined) payload.item_labels.forEach((l) => fd.append("item_labels[]", l));
  fd.set("_method", "PATCH");
  return await request<SpinWheelGameRow>(`/api/professional/spin-wheel-games/${id}`, { method: "POST", formData: fd });
}

export async function professionalDeleteSpinWheelGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/professional/spin-wheel-games/${id}`, { method: "DELETE" });
}

export async function adminDeleteAppointment(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/appointments/${id}`, { method: "DELETE" });
}

export async function adminUpdateAppointmentStatus(id: number, status: "active" | "completed" | "canceled"): Promise<AdminAppointmentRow> {
  await ensureCsrfCookie();
  return await request<AdminAppointmentRow>(`/api/admin/appointments/${id}`, {
    method: "PATCH",
    json: { status },
  });
}

export async function adminDeleteAllAppointmentsForUser(userId: number): Promise<{ message: string; deleted: number }> {
  await ensureCsrfCookie();
  return await request<{ message: string; deleted: number }>(`/api/admin/users/${userId}/appointments`, {
    method: "DELETE",
  });
}

// ---------------------------
// RELATÓRIOS (admin/user)
// ---------------------------

export async function adminListReports(): Promise<ReportRow[]> {
  const res = await request<{ data: ReportRow[] }>("/api/admin/reports");
  return res.data;
}

export async function adminCreateReport(payload: {
  user_id: number;
  patient_name: string;
  professional_name: string;
  title: string;
  report_date: string; // YYYY-MM-DD
  type: ReportType;
  content: string;
}): Promise<ReportRow> {
  await ensureCsrfCookie();
  return await request<ReportRow>("/api/admin/reports", { method: "POST", json: payload });
}

export async function adminUpdateReport(
  id: number,
  payload: Partial<{
    user_id: number;
    patient_name: string;
    professional_name: string;
    title: string;
    report_date: string;
    type: ReportType;
    content: string;
  }>
): Promise<ReportRow> {
  await ensureCsrfCookie();
  return await request<ReportRow>(`/api/admin/reports/${id}`, { method: "PATCH", json: payload });
}

export async function adminDeleteReport(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/reports/${id}`, { method: "DELETE" });
}

export async function userListReports(): Promise<ReportRow[]> {
  const res = await request<{ data: ReportRow[] }>("/api/reports");
  return res.data;
}

// ---------------------------
// ATIVIDADES (admin/user)
// ---------------------------

export async function adminListActivities(): Promise<ActivityRow[]> {
  const res = await request<{ data: ActivityRow[] }>("/api/admin/activities");
  return res.data;
}

export async function adminGetActivity(id: number): Promise<ActivityRow> {
  return await request<ActivityRow>(`/api/admin/activities/${id}`);
}

export async function adminListMemoryGames(opts?: { variant?: "classic" | "v2" }): Promise<MemoryGameRow[]> {
  const qs = opts?.variant ? `?variant=${encodeURIComponent(opts.variant)}` : "";
  const res = await request<{ data: MemoryGameRow[] }>(`/api/admin/memory-games${qs}`);
  return res.data;
}

export async function adminGetMemoryGame(id: number): Promise<MemoryGameRow> {
  return await request<MemoryGameRow>(`/api/admin/memory-games/${id}`);
}

export async function adminCreateMemoryGame(payload: {
  title: string;
  description: string;
  pairs_count: number;
  variant?: "classic" | "v2";
  assigned_to: number[];
  pair_images: File[];
}): Promise<MemoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("pairs_count", String(payload.pairs_count));
  if (payload.variant) fd.set("variant", payload.variant);
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  payload.pair_images.forEach((f) => fd.append("pair_images[]", f));
  return await request<MemoryGameRow>("/api/admin/memory-games", { method: "POST", formData: fd });
}

export async function adminDeleteMemoryGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/memory-games/${id}`, { method: "DELETE" });
}

export async function adminUpdateMemoryGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    pair_images: File[];
  }>
): Promise<MemoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.pair_images !== undefined) payload.pair_images.forEach((f) => fd.append("pair_images[]", f));
  fd.set("_method", "PATCH");
  return await request<MemoryGameRow>(`/api/admin/memory-games/${id}`, { method: "POST", formData: fd });
}

export async function adminListAuditoryGames(): Promise<AuditoryGameRow[]> {
  const res = await request<{ data: AuditoryGameRow[] }>("/api/admin/auditory-games");
  return res.data;
}

export async function adminListPhonemeGames(): Promise<PhonemeGameRow[]> {
  const res = await request<{ data: PhonemeGameRow[] }>("/api/admin/phoneme-games");
  return res.data;
}

export async function adminListHangmanGames(): Promise<HangmanGameRow[]> {
  const res = await request<{ data: HangmanGameRow[] }>("/api/admin/hangman-games");
  return res.data;
}

export async function adminGetAuditoryGame(id: number): Promise<AuditoryGameRow> {
  return await request<AuditoryGameRow>(`/api/admin/auditory-games/${id}`);
}

export async function adminGetPhonemeGame(id: number): Promise<PhonemeGameRow> {
  return await request<PhonemeGameRow>(`/api/admin/phoneme-games/${id}`);
}

export async function adminGetHangmanGame(id: number): Promise<HangmanGameRow> {
  return await request<HangmanGameRow>(`/api/admin/hangman-games/${id}`);
}

export async function adminCreateAuditoryGame(payload: {
  title: string;
  description: string;
  items_count: 4 | 6 | 10;
  assigned_to: number[];
  background: File;
  items: File[];
  items_sides: Array<"certo" | "errado">;
}): Promise<AuditoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("items_count", String(payload.items_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  payload.items.forEach((f) => fd.append("items[]", f));
  fd.set("items_sides_json", JSON.stringify(payload.items_sides));
  return await request<AuditoryGameRow>("/api/admin/auditory-games", { method: "POST", formData: fd });
}

export async function adminCreatePhonemeGame(payload: {
  title: string;
  description: string;
  sessions_count: number;
  assigned_to: number[];
  background: File;
  words: string[];
  correct_sides: Array<"left" | "right">;
  left_images: File[];
  right_images: File[];
}): Promise<PhonemeGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("sessions_count", String(payload.sessions_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  fd.set("words_json", JSON.stringify(payload.words || []));
  fd.set("correct_sides_json", JSON.stringify(payload.correct_sides || []));
  payload.left_images.forEach((f) => fd.append("left_images[]", f));
  payload.right_images.forEach((f) => fd.append("right_images[]", f));
  return await request<PhonemeGameRow>("/api/admin/phoneme-games", { method: "POST", formData: fd });
}

export async function adminCreateHangmanGame(payload: {
  title: string;
  description: string;
  secret_word: string;
  assigned_to: number[];
  support_images?: File[];
}): Promise<HangmanGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("secret_word", payload.secret_word);
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  (payload.support_images || []).forEach((f) => fd.append("support_images[]", f));
  return await request<HangmanGameRow>("/api/admin/hangman-games", { method: "POST", formData: fd });
}

export async function adminDeleteAuditoryGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/auditory-games/${id}`, { method: "DELETE" });
}

export async function adminDeletePhonemeGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/phoneme-games/${id}`, { method: "DELETE" });
}

export async function adminListWordSearchGames(): Promise<WordSearchGameRow[]> {
  const res = await request<{ data: WordSearchGameRow[] }>("/api/admin/word-search-games");
  return res.data;
}

export async function adminGetWordSearchGame(id: number): Promise<WordSearchGameRow> {
  return await request<WordSearchGameRow>(`/api/admin/word-search-games/${id}`);
}

export async function adminCreateWordSearchGame(payload: {
  title: string;
  description: string;
  words_count: number;
  assigned_to: number[];
  background: File;
  words: string[];
  directions?: Array<"horizontal" | "vertical">;
  images: File[];
  letter_color?: string;
  grid_background_color?: string;
}): Promise<WordSearchGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("words_count", String(payload.words_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  fd.set("background", payload.background);
  fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.directions) {
    fd.set("directions_json", JSON.stringify(payload.directions || []));
  }
  if (payload.letter_color) {
    fd.set("letter_color", payload.letter_color);
  }
  if (payload.grid_background_color) {
    fd.set("grid_background_color", payload.grid_background_color);
  }
  payload.images.forEach((f) => fd.append("images[]", f));
  return await request<WordSearchGameRow>("/api/admin/word-search-games", { method: "POST", formData: fd });
}

export async function adminDeleteWordSearchGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/word-search-games/${id}`, { method: "DELETE" });
}

export async function adminUpdateWordSearchGame(
  id: number,
  payload: {
    title?: string;
    description?: string;
    assigned_to?: number[];
    background?: File;
    words?: string[];
    directions?: Array<"horizontal" | "vertical">;
    images?: File[];
    letter_color?: string;
    grid_background_color?: string;
  }
): Promise<WordSearchGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  if (payload.words !== undefined) fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.directions !== undefined && payload.directions) {
    fd.set("directions_json", JSON.stringify(payload.directions));
  }
  if (payload.letter_color !== undefined) fd.set("letter_color", payload.letter_color);
  if (payload.grid_background_color !== undefined) fd.set("grid_background_color", payload.grid_background_color);
  if (payload.images) {
    payload.images.forEach((f) => fd.append("images[]", f));
  }
  fd.set("_method", "PATCH");
  return await request<WordSearchGameRow>(`/api/admin/word-search-games/${id}`, { method: "POST", formData: fd });
}

export async function adminListCardGames(): Promise<CardGameRow[]> {
  const res = await request<{ data: CardGameRow[] }>("/api/admin/card-games");
  return res.data;
}

export async function adminGetCardGame(id: number): Promise<CardGameRow> {
  return await request<CardGameRow>(`/api/admin/card-games/${id}`);
}

export async function adminCreateCardGame(payload: {
  title: string;
  description: string;
  cards_count: number;
  assigned_to: number[];
  background?: File;
  card_images: File[];
}): Promise<CardGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  fd.set("cards_count", String(payload.cards_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  for (const f of payload.card_images || []) fd.append("card_images[]", f);
  return await request<CardGameRow>("/api/admin/card-games", { method: "POST", formData: fd });
}

export async function adminUpdateCardGame(
  id: number,
  payload: {
    title?: string;
    description?: string;
    cards_count?: number;
    assigned_to?: number[];
    background?: File | null;
    card_images?: File[] | null;
  }
): Promise<CardGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.cards_count !== undefined) fd.set("cards_count", String(payload.cards_count));
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  if (payload.card_images && payload.card_images.length) {
    for (const f of payload.card_images) fd.append("card_images[]", f);
  }
  fd.set("_method", "PATCH");
  return await request<CardGameRow>(`/api/admin/card-games/${id}`, { method: "POST", formData: fd });
}

export async function adminDeleteCardGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/card-games/${id}`, { method: "DELETE" });
}

export async function userListCardGames(): Promise<CardGameRow[]> {
  const res = await request<{ data: CardGameRow[] }>("/api/card-games");
  return res.data;
}

export async function userGetCardGame(id: number, opts?: { session_id?: number | null }): Promise<CardGameRow> {
  const q = opts?.session_id ? `?session_id=${encodeURIComponent(String(opts.session_id))}` : "";
  return await request<CardGameRow>(`/api/card-games/${id}${q}`);
}

export async function userUpdateCardGameProgress(
  id: number,
  payload: { status?: CardGameStatus; progress?: any }
): Promise<CardGameRow> {
  await ensureCsrfCookie();
  return await request<CardGameRow>(`/api/card-games/${id}/progress`, { method: "PATCH", json: payload });
}

export async function adminDeleteHangmanGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/hangman-games/${id}`, { method: "DELETE" });
}

export async function adminUpdateAuditoryGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    background: File;
    items: File[]; // substitui TODAS as imagens do topo
    items_sides: Array<"certo" | "errado">; // atualiza a regra (pode ser sozinho)
  }>
): Promise<AuditoryGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined && payload.background) fd.set("background", payload.background);
  if (payload.items !== undefined && payload.items) payload.items.forEach((f) => fd.append("items[]", f));
  if (payload.items_sides !== undefined) fd.set("items_sides_json", JSON.stringify(payload.items_sides));
  fd.set("_method", "PATCH");
  return await request<AuditoryGameRow>(`/api/admin/auditory-games/${id}`, { method: "POST", formData: fd });
}

export async function adminUpdatePhonemeGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    assigned_to: number[];
    background: File;
    words: string[];
    correct_sides: Array<"left" | "right">;
    left_images: File[];
    right_images: File[];
  }>
): Promise<PhonemeGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined && payload.background) fd.set("background", payload.background);
  if (payload.words !== undefined) fd.set("words_json", JSON.stringify(payload.words || []));
  if (payload.correct_sides !== undefined) fd.set("correct_sides_json", JSON.stringify(payload.correct_sides || []));
  if (payload.left_images !== undefined) payload.left_images.forEach((f) => fd.append("left_images[]", f));
  if (payload.right_images !== undefined) payload.right_images.forEach((f) => fd.append("right_images[]", f));
  fd.set("_method", "PATCH");
  return await request<PhonemeGameRow>(`/api/admin/phoneme-games/${id}`, { method: "POST", formData: fd });
}

export async function adminUpdateHangmanGame(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    secret_word: string;
    assigned_to: number[];
    support_images: File[];
    clear_images: boolean;
  }>
): Promise<HangmanGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.description !== undefined) fd.set("description", payload.description);
  if (payload.secret_word !== undefined) fd.set("secret_word", payload.secret_word);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.clear_images !== undefined) fd.set("clear_images", payload.clear_images ? "1" : "0");
  if (payload.support_images !== undefined) payload.support_images.forEach((f) => fd.append("support_images[]", f));
  fd.set("_method", "PATCH");
  return await request<HangmanGameRow>(`/api/admin/hangman-games/${id}`, { method: "POST", formData: fd });
}

export async function adminCreateActivity(payload: {
  title: string;
  description: string;
  category?: string;
  estimated_time?: string;
  assigned_to: number[];
  media: Array<{ file: File; media_type: ActivityMediaType; caption: string; thumbnail?: File | null }>;
}): Promise<ActivityRow> {
  await ensureCsrfCookie();

  const fd = new FormData();
  fd.set("title", payload.title);
  fd.set("description", payload.description);
  if (payload.category) fd.set("category", payload.category);
  if (payload.estimated_time) fd.set("estimated_time", payload.estimated_time);

  // enviar como JSON (mais simples do lado do Laravel)
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));

  payload.media.forEach((m, idx) => {
    fd.append("media_files[]", m.file);
    fd.append("media_types[]", m.media_type);
    fd.append("media_captions[]", m.caption ?? "");
    fd.append("media_positions[]", String(idx));
    if (m.media_type === "video" && m.thumbnail) {
      // usar índice para manter alinhamento mesmo se for "sparse"
      fd.append(`media_thumbnails[${idx}]`, m.thumbnail);
    }
  });

  return await request<ActivityRow>("/api/admin/activities", {
    method: "POST",
    formData: fd,
  });
}

export async function adminUpdateActivity(
  id: number,
  payload: Partial<{
    title: string;
    description: string;
    category: string;
    estimated_time: string;
    assigned_to: number[];
  }>
): Promise<ActivityRow> {
  await ensureCsrfCookie();

  // Para update sem upload, JSON é suficiente
  const json: any = { ...payload };
  if (payload.assigned_to) {
    json.assigned_to_json = JSON.stringify(payload.assigned_to);
    delete json.assigned_to;
  }

  return await request<ActivityRow>(`/api/admin/activities/${id}`, {
    method: "PATCH",
    json,
  });
}

export async function adminAddActivityMedia(params: {
  activity_id: number;
  file: File;
  media_type: ActivityMediaType;
  caption?: string;
  position?: number;
  thumbnail?: File | null;
}): Promise<ActivityMediaRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("file", params.file);
  fd.set("media_type", params.media_type);
  if (params.caption) fd.set("caption", params.caption);
  if (params.position !== undefined) fd.set("position", String(params.position));
  if (params.media_type === "video" && params.thumbnail) fd.set("thumbnail", params.thumbnail);

  return await request<ActivityMediaRow>(`/api/admin/activities/${params.activity_id}/media`, {
    method: "POST",
    formData: fd,
  });
}

export async function adminDeleteActivity(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/activities/${id}`, { method: "DELETE" });
}

export async function adminDeleteActivityMedia(params: {
  activity_id: number;
  media_id: number;
}): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/activities/${params.activity_id}/media/${params.media_id}`, {
    method: "DELETE",
  });
}

export async function userListActivities(): Promise<ActivityRow[]> {
  const res = await request<{ data: ActivityRow[] }>("/api/activities");
  return res.data;
}

export async function userGetActivity(id: number, opts?: { session_id?: number | null }): Promise<ActivityRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<ActivityRow>(`/api/activities/${id}${qs}`);
}

export async function userUpdateActivityProgress(
  id: number,
  payload: { current_step?: number; completed_steps?: number[] }
): Promise<ActivityRow> {
  await ensureCsrfCookie();
  return await request<ActivityRow>(`/api/activities/${id}/progress`, { method: "PATCH", json: payload });
}

export async function userListMemoryGames(opts?: { variant?: "classic" | "v2" }): Promise<MemoryGameRow[]> {
  const qs = opts?.variant ? `?variant=${encodeURIComponent(opts.variant)}` : "";
  const res = await request<{ data: MemoryGameRow[] }>(`/api/memory-games${qs}`);
  return res.data;
}

export async function userGetMemoryGame(id: number, opts?: { session_id?: number | null }): Promise<MemoryGameRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<MemoryGameRow>(`/api/memory-games/${id}${qs}`);
}

export async function userUpdateMemoryGameProgress(
  id: number,
  payload: { progress?: any; status?: MemoryGameStatus }
): Promise<MemoryGameRow> {
  await ensureCsrfCookie();
  return await request<MemoryGameRow>(`/api/memory-games/${id}/progress`, { method: "PATCH", json: payload });
}

export async function userListPhonemeGames(): Promise<PhonemeGameRow[]> {
  const res = await request<{ data: PhonemeGameRow[] }>("/api/phoneme-games");
  return res.data;
}

export async function userGetPhonemeGame(id: number, opts?: { session_id?: number | null }): Promise<PhonemeGameRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<PhonemeGameRow>(`/api/phoneme-games/${id}${qs}`);
}

export async function userUpdatePhonemeGameProgress(
  id: number,
  payload: { progress?: any; status?: PhonemeGameStatus }
): Promise<PhonemeGameRow> {
  await ensureCsrfCookie();
  return await request<PhonemeGameRow>(`/api/phoneme-games/${id}/progress`, { method: "PATCH", json: payload });
}

export async function userListWordSearchGames(): Promise<WordSearchGameRow[]> {
  const res = await request<{ data: WordSearchGameRow[] }>("/api/word-search-games");
  return res.data;
}

export async function userGetWordSearchGame(id: number, opts?: { session_id?: number | null }): Promise<WordSearchGameRow> {
  const sid = opts?.session_id;
  const qs = sid ? `?session_id=${sid}` : "";
  return await request<WordSearchGameRow>(`/api/word-search-games/${id}${qs}`);
}

export async function userUpdateWordSearchGameProgress(
  id: number,
  payload: { progress?: any; status?: WordSearchGameStatus }
): Promise<WordSearchGameRow> {
  await ensureCsrfCookie();
  return await request<WordSearchGameRow>(`/api/word-search-games/${id}/progress`, { method: "PATCH", json: payload });
}

export async function userListAuditoryGames(): Promise<AuditoryGameRow[]> {
  const res = await request<{ data: AuditoryGameRow[] }>("/api/auditory-games");
  return res.data;
}

export async function userListHangmanGames(): Promise<HangmanGameRow[]> {
  const res = await request<{ data: HangmanGameRow[] }>("/api/hangman-games");
  return res.data;
}

export async function userGetAuditoryGame(id: number, opts?: { session_id?: number | null }): Promise<AuditoryGameRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<AuditoryGameRow>(`/api/auditory-games/${id}${qs}`);
}

export async function userGetHangmanGame(id: number, opts?: { session_id?: number | null }): Promise<HangmanGameRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<HangmanGameRow>(`/api/hangman-games/${id}${qs}`);
}

export async function userUpdateAuditoryGameProgress(
  id: number,
  payload: { progress?: any; status?: AuditoryGameStatus }
): Promise<AuditoryGameRow> {
  await ensureCsrfCookie();
  return await request<AuditoryGameRow>(`/api/auditory-games/${id}/progress`, { method: "PATCH", json: payload });
}

export async function userUpdateHangmanGameProgress(
  id: number,
  payload: { progress?: any; status?: HangmanGameStatus }
): Promise<HangmanGameRow> {
  await ensureCsrfCookie();
  return await request<HangmanGameRow>(`/api/hangman-games/${id}/progress`, { method: "PATCH", json: payload });
}

export type UserAppointmentRow = {
  id: number;
  professional_name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: "active" | "completed" | "canceled";
  total_sessions: number;
  join_session?: JoinSessionMeta;
};

export async function userListAppointments(): Promise<{
  data: UserAppointmentRow[];
  summary: { total_contracted: number; used_sessions: number; remaining_sessions: number };
  upcoming: Array<Pick<UserAppointmentRow, "id" | "professional_name" | "date" | "time" | "status" | "join_session">>;
}> {
  return await request("/api/user/appointments");
}

export async function userListCustomPackages(): Promise<CustomPackageRow[]> {
  const res = await request<{ data: CustomPackageRow[] }>("/api/user/custom-packages");
  return res.data;
}

// ---------------------------
// VIDEO (WebRTC signaling)
// ---------------------------

export type VideoJoinResponse = {
  role: "admin" | "user";
  token: string;
  sessionId: number;
  iceServers: Array<{ urls: string[]; username?: string; credential?: string }>;
  room?: {
    appointment_id: number;
    created_at?: string;
    content?: { path?: string } | null;
    content_updated_at?: string | null;
    control_granted_to_user?: boolean;
    control_updated_at?: string | null;
  } | null;
  server_now: string;
};

export async function videoJoin(appointment_id: number): Promise<VideoJoinResponse> {
  return await request<VideoJoinResponse>("/api/video/join", {
    method: "POST",
    json: { appointment_id },
  });
}

export async function videoSendCommand(params: {
  appointment_id: number;
  token: string;
  kind: string;
  payload?: any;
}): Promise<{ ok: true; id: number }> {
  return await request<{ ok: true; id: number }>("/api/video/command", {
    method: "POST",
    json: {
      appointment_id: params.appointment_id,
      token: params.token,
      kind: params.kind,
      payload: params.payload ?? null,
    },
  });
}

export type VideoPollMessage = {
  id: number;
  kind: string;
  payload: any;
  from: "admin" | "user";
  at: string;
};

export async function videoPoll(params: {
  appointment_id: number;
  token: string;
  after_id: number;
}): Promise<{ messages: VideoPollMessage[]; next_cursor: number }> {
  const q = new URLSearchParams({
    appointment_id: String(params.appointment_id),
    token: params.token,
    after_id: String(params.after_id || 0),
  }).toString();
  return await request<{ messages: VideoPollMessage[]; next_cursor: number }>(`/api/video/command?${q}`);
}

export function isApiError(e: unknown): e is ApiError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as any).status === "number"
  );
}

// ---------------------------
// ROLETA (admin)
// ---------------------------

export async function adminListSpinWheelGames(): Promise<SpinWheelGameRow[]> {
  const res = await request<{ data: SpinWheelGameRow[] }>("/api/admin/spin-wheel-games");
  return res.data;
}

export async function adminGetSpinWheelGame(id: number): Promise<SpinWheelGameRow> {
  return await request<SpinWheelGameRow>(`/api/admin/spin-wheel-games/${id}`);
}

export async function adminCreateSpinWheelGame(payload: {
  title: string;
  center_title?: string;
  items_count: number;
  assigned_to: number[];
  background?: File;
  item_images: File[];
  item_labels: string[];
}): Promise<SpinWheelGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  fd.set("title", payload.title);
  if (payload.center_title) fd.set("center_title", payload.center_title);
  fd.set("items_count", String(payload.items_count));
  fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background) fd.set("background", payload.background);
  payload.item_images.forEach((f) => fd.append("item_images[]", f));
  payload.item_labels.forEach((l) => fd.append("item_labels[]", l));
  return await request<SpinWheelGameRow>("/api/admin/spin-wheel-games", { method: "POST", formData: fd });
}

export async function adminUpdateSpinWheelGame(
  id: number,
  payload: Partial<{
    title: string;
    center_title: string;
    assigned_to: number[];
    background: File;
    item_images: File[];
    item_labels: string[];
  }>
): Promise<SpinWheelGameRow> {
  await ensureCsrfCookie();
  const fd = new FormData();
  if (payload.title !== undefined) fd.set("title", payload.title);
  if (payload.center_title !== undefined) fd.set("center_title", payload.center_title);
  if (payload.assigned_to !== undefined) fd.set("assigned_to_json", JSON.stringify(payload.assigned_to || []));
  if (payload.background !== undefined && payload.background) fd.set("background", payload.background);
  if (payload.item_images !== undefined) payload.item_images.forEach((f) => fd.append("item_images[]", f));
  if (payload.item_labels !== undefined) payload.item_labels.forEach((l) => fd.append("item_labels[]", l));
  fd.set("_method", "PATCH");
  return await request<SpinWheelGameRow>(`/api/admin/spin-wheel-games/${id}`, { method: "POST", formData: fd });
}

export async function adminDeleteSpinWheelGame(id: number): Promise<void> {
  await ensureCsrfCookie();
  await request<void>(`/api/admin/spin-wheel-games/${id}`, { method: "DELETE" });
}

// ---------------------------
// ROLETA (user)
// ---------------------------

export async function userListSpinWheelGames(): Promise<SpinWheelGameRow[]> {
  const res = await request<{ data: SpinWheelGameRow[] }>("/api/spin-wheel-games");
  return res.data;
}

export async function userGetSpinWheelGame(id: number, opts?: { session_id?: number | null }): Promise<SpinWheelGameRow> {
  const sid = opts?.session_id;
  const qs = typeof sid === "number" && Number.isFinite(sid) ? `?session_id=${encodeURIComponent(String(sid))}` : "";
  return await request<SpinWheelGameRow>(`/api/spin-wheel-games/${id}${qs}`);
}

export async function userUpdateSpinWheelGameProgress(
  id: number,
  payload: { progress?: any; status?: SpinWheelGameStatus }
): Promise<SpinWheelGameRow> {
  await ensureCsrfCookie();
  return await request<SpinWheelGameRow>(`/api/spin-wheel-games/${id}/progress`, { method: "PATCH", json: payload });
}


