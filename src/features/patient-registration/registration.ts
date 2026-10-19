export type RegistrationProfessional = {
  name: string;
  registration: string | null;
  photo_url: string | null;
};

export type PatientRegistrationLink = {
  token: string;
  expires_at: string;
  professional: RegistrationProfessional;
};

export const registrationWelcomeKey = "patient-registration-welcome";

export function registrationLinkUrl(origin: string, token: string): string {
  const url = new URL("/cadastro", origin);
  url.searchParams.set("perfil", "paciente");
  url.searchParams.set("convite_profissional", token);
  return url.toString();
}

export function registrationWelcome(raw: string | null, patientId: number): RegistrationProfessional | null {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.patient_id !== patientId || !value.professional || typeof value.professional.name !== "string"
      || !value.professional.name.trim()) return null;
    const professional = value.professional;
    return {
      name: professional.name,
      registration: typeof professional.registration === "string" ? professional.registration : null,
      photo_url: typeof professional.photo_url === "string" ? professional.photo_url : null,
    };
  } catch { return null; }
}
