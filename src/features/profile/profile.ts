export const PROFILE_NAME_LIMIT = 255;
export const PROFILE_DESCRIPTION_LIMIT = 5000;
export const PROFILE_PHOTO_LIMIT = 5 * 1024 * 1024;

export function profileInitials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((part) => Array.from(part)[0]).slice(0, 2).join("").toUpperCase();
}

export function profileRegistration(user: { professional_crfa?: string | null; professional_registration?: string | null }): string | null {
  return user.professional_crfa?.trim() || user.professional_registration?.trim() || null;
}

export function profileTextErrors(name: string, description: string): { name?: string; description?: string } {
  return {
    ...(name.trim().length < 3 ? { name: "Informe um nome com pelo menos 3 caracteres." }
      : name.trim().length > PROFILE_NAME_LIMIT ? { name: "O nome deve ter até 255 caracteres." } : {}),
    ...(description.length > PROFILE_DESCRIPTION_LIMIT ? { description: "A descrição deve ter até 5.000 caracteres." } : {}),
  };
}

export function profilePhotoError(file: { size: number; type: string }): string | null {
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) return "Escolha uma imagem JPG, PNG, WEBP ou GIF.";
  if (file.size < 1) return "A imagem está vazia. Escolha outro arquivo.";
  if (file.size > PROFILE_PHOTO_LIMIT) return "A foto deve ter no máximo 5 MB.";
  return null;
}
