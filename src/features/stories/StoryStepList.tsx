import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type Announcements, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Film, Gamepad2, GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { normalizeMediaUrl } from "@/lib/normalize-media-url";

export type StorySequenceItem = {
  key: string;
  title: string;
  category: string;
  image?: string | null;
  source?: string;
  isGame: boolean;
};

const rowClass = "relative flex min-h-20 min-w-0 items-center gap-2 rounded-md border border-border bg-card p-2 sm:gap-3 sm:p-3";

function StepContents({ item, index, handle, action }: { item: StorySequenceItem; index: number; handle: ReactNode; action?: ReactNode }) {
  return <>
    <div className="flex w-9 shrink-0 flex-col items-center gap-0.5">{handle}<span className="text-xs font-semibold text-muted-foreground">{index + 1}</span></div>
    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted sm:w-20">
      {item.image ? <img src={normalizeMediaUrl(item.image)} alt="" draggable={false} className="h-full w-full object-cover" /> : item.isGame ? <Gamepad2 className="h-5 w-5" /> : <Film className="h-5 w-5" />}
    </div>
    <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium" title={item.title}>{item.title}</div><div className="text-xs text-muted-foreground">{item.category}</div>{item.source && <div className="truncate text-xs text-primary" title={item.source}>{item.source}</div>}</div>
    {action}
  </>;
}

function SortableStep({ item, index, disabled, onRemove }: { item: StorySequenceItem; index: number; disabled: boolean; onRemove: (key: string) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key, disabled });
  return <li ref={setNodeRef} data-story-step={item.key} style={{ transform: CSS.Transform.toString(transform), transition }}
    className={`${rowClass} ${isDragging ? "opacity-30 border-primary bg-primary/5" : ""}`}>
    <StepContents item={item} index={index} handle={<button type="button" ref={setActivatorNodeRef} {...attributes} {...listeners} disabled={disabled}
      aria-label={`Mover etapa ${index + 1}: ${item.title}`} title="Arrastar etapa" style={{ touchAction: "none" }} onContextMenu={event => event.preventDefault()}
      className="flex h-9 w-9 cursor-grab select-none items-center justify-center rounded text-muted-foreground hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing disabled:cursor-default disabled:opacity-50">
      <GripVertical className="h-5 w-5" />
    </button>} action={<Button type="button" variant="ghost" size="icon" className="shrink-0" title="Remover etapa" aria-label={`Remover etapa ${index + 1}: ${item.title}`} disabled={disabled} onClick={() => onRemove(item.key)}><Trash2 className="h-4 w-4" /></Button>} />
  </li>;
}

export default function StoryStepList({ items, disabled, onMove, onRemove, onDraggingChange }: {
  items: StorySequenceItem[];
  disabled: boolean;
  onMove: (activeKey: string, targetKey: string) => void;
  onRemove: (key: string) => void;
  onDraggingChange: (dragging: boolean) => void;
}) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const activeIndex = items.findIndex(item => item.key === activeKey);
  const active = items[activeIndex];
  const position = (id: string | number) => items.findIndex(item => item.key === id) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Etapa ${position(active.id)} selecionada.`,
    onDragOver: ({ over }) => over ? `Nova posição: ${position(over.id)} de ${items.length}.` : "Fora da sequência.",
    onDragEnd: ({ active, over }) => over ? `Etapa ${position(active.id)} movida para a posição ${position(over.id)}.` : "Movimento cancelado.",
    onDragCancel: () => "Movimento cancelado. A sequência não foi alterada.",
  };
  const finish = () => { setActiveKey(null); onDraggingChange(false); };
  const end = ({ active, over }: DragEndEvent) => {
    finish();
    if (!disabled && over) onMove(String(active.id), String(over.id));
  };
  return <DndContext sensors={sensors} collisionDetection={closestCenter}
    accessibility={{ announcements, screenReaderInstructions: { draggable: "Pressione espaço para mover a etapa, use as setas para escolher a posição e espaço para soltar. Escape cancela." } }}
    onDragStart={({ active }) => { setActiveKey(String(active.id)); onDraggingChange(true); }} onDragEnd={end} onDragCancel={finish}>
    <SortableContext items={items.map(item => item.key)} strategy={verticalListSortingStrategy}>
      <ol aria-label="Etapas da história" className="space-y-2">{items.map((item, index) => <SortableStep key={item.key} item={item} index={index} disabled={disabled} onRemove={onRemove} />)}</ol>
    </SortableContext>
    {createPortal(<DragOverlay dropAnimation={null}>{active ? <div aria-hidden="true" className={`${rowClass} pointer-events-none border-primary shadow-lg ring-2 ring-primary/15`}>
      <StepContents item={active} index={activeIndex} handle={<GripVertical className="h-5 w-5 text-primary" />} />
    </div> : null}</DragOverlay>, document.body)}
  </DndContext>;
}
