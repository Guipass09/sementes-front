import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isApiError,
  professionalReportLetterhead,
  saveProfessionalReportLetterhead,
} from "@/lib/laravel-api";
import { ReportLetterheadIdentity } from "./ReportLetterheadIdentity";
import {
  validateLetterheadLogo,
  type ReportLetterheadSettings,
} from "./letterhead";

export function ReportLetterheadDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [settings, setSettings] = useState<ReportLetterheadSettings | null>(
    null,
  );
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reading, setReading] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  useEffect(() => {
    if (!open) return;
    let current = true;
    readVersion.current++;
    setSettings(null);
    setFile(null);
    setPreview(null);
    setRemoved(false);
    setError("");
    setLoadError(false);
    setReading(false);
    professionalReportLetterhead()
      .then((value) => {
        if (current) {
          setSettings(value);
          setName(value.display_name ?? "");
          setPreview(value.logo_data_url);
        }
      })
      .catch(() => {
        if (current) {
          setError("Não foi possível carregar a timbragem.");
          setLoadError(true);
        }
      });
    return () => {
      current = false;
      readVersion.current++;
    };
  }, [open, attempt]);

  async function chooseFile(value: File) {
    const version = ++readVersion.current;
    const invalid = validateLetterheadLogo(value);
    if (invalid) {
      setError(invalid);
      setReading(false);
      return;
    }
    setReading(true);
    setError("");
    try {
      const bitmap = await createImageBitmap(value);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      try {
        if (
          bitmap.width < 32 ||
          bitmap.height < 32 ||
          bitmap.width > 2048 ||
          bitmap.height > 2048
        ) {
          throw new Error(
            "Use uma imagem entre 32 e 2048 pixels em cada lado.",
          );
        }
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Não foi possível preparar esta imagem.");
        const scale = Math.min(256 / bitmap.width, 256 / bitmap.height);
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));
        context.drawImage(
          bitmap,
          Math.floor((256 - width) / 2),
          Math.floor((256 - height) / 2),
          width,
          height,
        );
      } finally {
        bitmap.close();
      }
      const normalized = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) =>
            value
              ? resolve(value)
              : reject(new Error("Não foi possível preparar esta imagem.")),
          "image/png",
        ),
      );
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () =>
          reject(new Error("Não foi possível abrir esta imagem."));
        reader.readAsDataURL(normalized);
      });
      if (readVersion.current !== version) return;
      setFile(new File([normalized], "timbragem.png", { type: "image/png" }));
      setPreview(source);
      setRemoved(false);
    } catch (failure) {
      if (readVersion.current === version)
        setError(
          failure instanceof Error
            ? failure.message
            : "Não foi possível abrir esta imagem.",
        );
    } finally {
      if (readVersion.current === version) setReading(false);
    }
  }

  async function save(reset = false) {
    if (!settings) return;
    setBusy(true);
    setError("");
    try {
      await saveProfessionalReportLetterhead({
        version: settings.version,
        display_name: name.trim(),
        logo: file,
        remove_logo: removed,
        reset,
      });
      onSaved();
      onOpenChange(false);
    } catch (failure) {
      const fields = isApiError(failure)
        ? Object.values(failure.data?.errors ?? {}).flat()
        : [];
      setError(
        String(
          fields[0] ??
            (isApiError(failure) ? failure.data?.message : null) ??
            "Não foi possível salvar a timbragem.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!busy) onOpenChange(value);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Timbragem dos relatórios</DialogTitle>
        </DialogHeader>
        {!settings ? (
          <div className="py-6" role="status">
            {loadError ? (
              <Button
                variant="outline"
                onClick={() => setAttempt((value) => value + 1)}
              >
                Tentar novamente
              </Button>
            ) : (
              "Carregando timbragem..."
            )}
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="letterhead-name">Nome no cabeçalho</Label>
              <Input
                id="letterhead-name"
                maxLength={100}
                placeholder="Sementes da Fala"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={busy}
              />
            </div>
            <div className="space-y-3">
              <Label>Logo ou foto</Label>
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                aria-label="Selecionar logo ou foto"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void chooseFile(selected);
                  event.target.value = "";
                }}
                disabled={busy || reading}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => picker.current?.click()}
                  disabled={busy || reading}
                >
                  {reading ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <ImagePlus size={16} className="mr-2" />
                  )}
                  Selecionar imagem
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  title="Usar logo padrão"
                  aria-label="Usar logo padrão"
                  disabled={busy || reading || !preview}
                  onClick={() => {
                    readVersion.current++;
                    setFile(null);
                    setPreview(null);
                    setRemoved(true);
                  }}
                >
                  <Trash2 size={16} />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                PNG, JPG ou WebP, até 2 MB. Imagem entre 32 e 2048 pixels por
                lado.
              </p>
            </div>
            <section
              className="border-y border-border py-5"
              aria-label="Prévia do cabeçalho"
            >
              <div className="mb-4 text-xs font-medium text-muted-foreground">
                Prévia
              </div>
              <ReportLetterheadIdentity
                letterhead={{ display_name: name, logo_data_url: preview }}
              />
            </section>
            <p className="text-xs text-muted-foreground">
              A timbragem será usada nos seus relatórios e PDFs, inclusive nos
              já criados. Documentos de outros profissionais não serão
              alterados.
            </p>
            <div className="flex flex-wrap justify-between gap-3">
              <Button
                variant="outline"
                onClick={() => void save(true)}
                disabled={busy || reading}
              >
                <RotateCcw size={16} className="mr-2" />
                Restaurar padrão
              </Button>
              <Button
                onClick={() => void save()}
                disabled={busy || reading || name.trim().length > 100}
              >
                <Save size={16} className="mr-2" />
                {busy ? "Salvando..." : "Salvar timbragem"}
              </Button>
            </div>
          </>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
