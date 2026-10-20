import { forwardRef, lazy, Suspense, useImperativeHandle, useRef, useState, type InputHTMLAttributes } from "react";
import { ImagePlus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const ImageSearchPicker = lazy(() => import("./ImageSearchPicker"));

// Preserve the native input, ref and change event used by every existing editor.
export const ImageSourceInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ onClick, ...props }, ref) => {
    const input = useRef<HTMLInputElement>(null);
    const nativePicker = useRef(false);
    const [mode, setMode] = useState<"source" | "search" | null>(null);
    useImperativeHandle(ref, () => input.current!);
    const upload = () => {
      setMode(null);
      nativePicker.current = true;
      input.current?.click();
      nativePicker.current = false;
    };
    const receive = (selected: File[]) => {
      if (!input.current || input.current.disabled) return;
      const files = new DataTransfer();
      selected.forEach(file => files.items.add(file));
      input.current.files = files.files;
      input.current.dispatchEvent(new Event("change", { bubbles: true }));
      setMode(null);
    };
    return <>
      <input {...props} className={props.className ?? "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"} ref={input} onClick={event => {
        onClick?.(event);
        if (event.defaultPrevented || nativePicker.current || !props.accept?.includes("image/")) return;
        event.preventDefault();
        setMode("source");
      }} />
      <Dialog open={mode === "source"} onOpenChange={open => { if (!open) setMode(null); }}>
        <DialogContent className="w-[calc(100%_-_2rem)] max-w-sm rounded-lg" aria-describedby={undefined}>
          <DialogTitle className="tracking-normal">Adicionar imagem</DialogTitle>
          <div className="grid gap-2 pt-1">
            <Button type="button" variant="outline" className="h-12 justify-start gap-3" onClick={upload}><Upload size={19} />Upload do dispositivo</Button>
            <Button type="button" variant="outline" className="h-12 justify-start gap-3" onClick={() => setMode("search")}><ImagePlus size={19} />Buscar imagens</Button>
          </div>
        </DialogContent>
      </Dialog>
      {mode === "search" && <Suspense fallback={null}><ImageSearchPicker multiple={props.multiple} onClose={() => setMode(null)} onSelect={receive} onUpload={upload} /></Suspense>}
    </>;
  },
);
ImageSourceInput.displayName = "ImageSourceInput";
