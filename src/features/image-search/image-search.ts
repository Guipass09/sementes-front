import api from "@/services/api";

export type SearchImage = {
  id: number; tags: string; author: string; page: string; preview: string;
  width: number; height: number; token: string;
};
export type ImageSearchResult = { items: SearchImage[]; total: number; page: number };
export type ImageFilters = { q: string; lang: string; image_type: string; orientation: string; colors: string; order: string };

export async function searchActivityImages(filters: ImageFilters, page: number, signal: AbortSignal): Promise<ImageSearchResult> {
  const response = await api.get<ImageSearchResult>("/api/activity-images/search", { params: { ...filters, colors: filters.colors || undefined, page }, signal });
  return response.data;
}

export async function importActivityImage(image: SearchImage, signal: AbortSignal): Promise<File> {
  const response = await api.post<Blob>("/api/activity-images/import", { token: image.token }, { responseType: "blob", signal });
  const blob = response.data;
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  const extension = extensions[blob.type];
  if (!extension || !blob.size || blob.size > 8 * 1024 * 1024) throw new Error("Arquivo de imagem indisponível. Escolha outra imagem.");
  return new File([blob], `pixabay-${image.id}.${extension}`, { type: blob.type });
}

export async function imageSearchError(error: unknown): Promise<string> {
  const value = error as { response?: { status?: number; data?: Blob | { message?: string } }; message?: string };
  const status = value?.response?.status;
  if (status === 401) return "Sua sessão expirou. Entre novamente na plataforma.";
  if (status === 403) return "A busca está disponível para profissionais e administradores.";
  if (status === 429) return "Muitas buscas neste momento. Aguarde um minuto e tente novamente.";
  if (status === 422) return "A seleção expirou ou não está disponível. Busque novamente ou escolha outra imagem.";
  if (status === 503) return "A busca está temporariamente indisponível. Você pode usar o upload do dispositivo.";
  return "Não foi possível carregar as imagens. Tente novamente ou use o upload do dispositivo.";
}
