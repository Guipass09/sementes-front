import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ExternalLink, ImagePlus, Loader2, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { imageSearchError, importActivityImage, searchActivityImages, type ImageFilters, type ImageSearchResult, type SearchImage } from "./image-search";
import "./image-search.css";

const defaults: ImageFilters = { q: "", lang: "pt", image_type: "illustration", orientation: "all", colors: "", order: "popular" };

export default function ImageSearchPicker({ onClose, onSelect, onUpload, multiple = false }: { onClose: () => void; onSelect: (files: File[]) => void; onUpload: () => void; multiple?: boolean }) {
  const [filters, setFilters] = useState(defaults);
  const [applied, setApplied] = useState(defaults);
  const [result, setResult] = useState<ImageSearchResult | null>(null);
  const [selected, setSelected] = useState<SearchImage | null>(null);
  const [selections, setSelections] = useState<SearchImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const importingRef = useRef(false);
  const queryInput = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const close = () => { controller.current?.abort(); onClose(); };
  const search = async (page = 1, query = filters) => {
    if (!query.q.trim() || importingRef.current) { queryInput.current?.focus(); return; }
    controller.current?.abort();
    const current = new AbortController(); controller.current = current;
    setLoading(true); setError(""); setApplied(query);
    try {
      const next = await searchActivityImages({ ...query, q: query.q.trim() }, page, current.signal);
      if (!current.signal.aborted) setResult(next);
    } catch (e) {
      if (!current.signal.aborted) { setResult(null); setError(await imageSearchError(e)); }
    } finally { if (!current.signal.aborted) setLoading(false); }
  };
  const choose = async () => {
    if (!selections.length || importingRef.current) return;
    importingRef.current = true; setImporting(true); setError("");
    const current = new AbortController(); controller.current = current;
    try {
      const files: File[] = [];
      for (const image of selections) files.push(await importActivityImage(image, current.signal));
      if (!current.signal.aborted) onSelect(files);
    } catch (e) { if (!current.signal.aborted) setError(await imageSearchError(e)); }
    finally { importingRef.current = false; if (!current.signal.aborted) setImporting(false); }
  };
  const filter = (key: keyof ImageFilters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));
  const select = (image: SearchImage) => {
    setSelected(image);
    setSelections(previous => !multiple ? [image] : previous.some(item => item.id === image.id)
      ? previous.filter(item => item.id !== image.id) : [...previous, image].slice(0, 24));
  };
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="image-search-dialog" aria-describedby={undefined} onOpenAutoFocus={event => { event.preventDefault(); queryInput.current?.focus(); }}>
      <header className="image-search-header">
        <DialogTitle className="flex items-center gap-2 tracking-normal"><ImagePlus size={21} className="text-primary" />Buscar imagens</DialogTitle>
        <a href="https://pixabay.com/" target="_blank" rel="noreferrer" className="image-search-provider">Pixabay<ExternalLink size={13} /></a>
      </header>
      <div className="image-search-filters">
        <div className="image-search-query">
          <Input ref={queryInput} aria-label="Buscar imagem" maxLength={100} placeholder="Buscar imagem..." value={filters.q} disabled={importing} onChange={e => filter("q", e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); void search(); } }} />
          <Button type="button" disabled={importing || !filters.q.trim()} onClick={() => void search()} aria-label="Pesquisar"><Search size={19} /></Button>
        </div>
        <div className="image-search-options">
          <label>Tipo<select value={filters.image_type} disabled={importing} onChange={e => filter("image_type", e.target.value)}><option value="illustration">Ilustrações</option><option value="vector">Vetores</option><option value="photo">Fotos</option><option value="all">Todos</option></select></label>
          <label>Idioma<select value={filters.lang} disabled={importing} onChange={e => filter("lang", e.target.value)}><option value="pt">Português</option><option value="en">Inglês</option></select></label>
          <label>Orientação<select value={filters.orientation} disabled={importing} onChange={e => filter("orientation", e.target.value)}><option value="all">Todas</option><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></label>
          <label>Fundo<select value={filters.colors} disabled={importing} onChange={e => filter("colors", e.target.value)}><option value="">Qualquer</option><option value="transparent">Transparente</option><option value="white">Branco</option></select></label>
          <label>Ordem<select value={filters.order} disabled={importing} onChange={e => filter("order", e.target.value)}><option value="popular">Relevância</option><option value="latest">Mais recentes</option></select></label>
        </div>
      </div>
      <div className="image-search-body" aria-busy={loading || importing}>
        <div className="image-search-results">
          {error && <div role="alert" className="image-search-error">{error}<Button type="button" variant="outline" disabled={importing} onClick={() => void search(result?.page || 1, applied)}>Tentar novamente</Button></div>}
          {loading ? <div className="image-search-empty" role="status"><Loader2 className="animate-spin" size={27} />Buscando imagens...</div> : !result ? <div className="image-search-empty"><Search size={32} />Buscar no Pixabay</div> : !result.items.length ? <div className="image-search-empty">Nenhuma imagem encontrada.</div> : <>
            <div className="image-search-grid">
              {result.items.map(item => <button type="button" key={item.id} disabled={importing || (selections.length >= 24 && !selections.some(image => image.id === item.id))} aria-label={`Selecionar ${item.tags || item.id}`} aria-pressed={selections.some(image => image.id === item.id)} className="image-search-tile" onClick={() => select(item)}>
                <img src={item.preview} alt={item.tags} loading="lazy" referrerPolicy="no-referrer" onError={e => { e.currentTarget.style.visibility = "hidden"; }} />
                {selections.some(image => image.id === item.id) && <span className="image-search-check"><Check size={16} /></span>}
              </button>)}
            </div>
            <nav className="image-search-pagination" aria-label="Páginas de imagens">
              <Button type="button" variant="outline" size="icon" title="Página anterior" aria-label="Página anterior" disabled={result.page <= 1 || importing} onClick={() => void search(result.page - 1, applied)}><ArrowLeft size={17} /></Button>
              <span>{result.page} / {Math.max(1, Math.ceil(result.total / 24))}</span>
              <Button type="button" variant="outline" size="icon" title="Próxima página" aria-label="Próxima página" disabled={result.page * 24 >= result.total || importing} onClick={() => void search(result.page + 1, applied)}><ArrowRight size={17} /></Button>
            </nav>
          </>}
        </div>
        {selected && <aside className="image-search-selection">
          <div className="image-search-preview"><img key={selected.id} src={selected.preview} alt={selected.tags} referrerPolicy="no-referrer" /></div>
          <div className="image-search-details"><strong>{selected.tags}</strong><span>{selected.width} × {selected.height} px</span><a href={selected.page} target="_blank" rel="noreferrer">{selected.author} · Pixabay <ExternalLink size={12} /></a></div>
        </aside>}
      </div>
      <footer className="image-search-footer">
        <Button type="button" variant="outline" disabled={importing} onClick={() => { controller.current?.abort(); onUpload(); }}><Upload size={16} className="mr-2" /><span>Upload</span></Button>
        <a href="https://pixabay.com/service/license-summary/" target="_blank" rel="noreferrer" className="image-search-license">Licença Pixabay</a>
        <Button type="button" disabled={!selections.length || importing || loading} onClick={() => void choose()}>{importing ? <Loader2 size={17} className="mr-2 animate-spin" /> : <Check size={17} className="mr-2" />}{importing ? "Adicionando..." : multiple && selections.length ? `Usar (${selections.length})` : "Usar imagem"}</Button>
      </footer>
    </DialogContent>
  </Dialog>;
}
