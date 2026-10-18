export type ReportLetterhead = {
  display_name: string | null;
  logo_data_url: string | null;
};
export type ReportLetterheadSettings = ReportLetterhead & { version: number };

export function letterheadName(letterhead?: ReportLetterhead | null) {
  return letterhead?.display_name?.trim() || "Sementes da Fala";
}

export function validateLetterheadLogo(
  file: Pick<File, "type" | "size">,
): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return "Escolha uma imagem PNG, JPG ou WebP.";
  if (file.size > 2 * 1024 * 1024) return "A imagem deve ter até 2 MB.";
  return null;
}
