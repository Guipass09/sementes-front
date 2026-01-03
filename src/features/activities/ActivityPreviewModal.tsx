import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ActivityRow } from "@/lib/laravel-api";
import ActivityContent from "@/features/activities/ActivityContent";

export function ActivityPreviewModal(props: {
  open: boolean;
  activity: ActivityRow | null;
  onOpenChange: (open: boolean) => void;
}): JSX.Element {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Atividade</DialogTitle>
        </DialogHeader>

        {props.activity ? (
          <>
            <ActivityContent activity={props.activity} />
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => props.onOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </>
        ) : (
          <div className="py-10 text-center text-muted-foreground">Nenhuma atividade selecionada.</div>
        )}
      </DialogContent>
    </Dialog>
  );
}


