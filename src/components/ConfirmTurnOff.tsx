import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Asked every time before notifications are turned off (never when turning on).
 * "Turn off" (red outline) on the left, "Keep on" (solid green) on the right, side by side on phones too.
 */
export function ConfirmTurnOff({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-sm rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <AlertDialogAction
            onClick={onConfirm}
            className="rounded-full border border-destructive bg-transparent text-destructive shadow-none hover:bg-destructive/10"
          >
            Turn off
          </AlertDialogAction>
          <AlertDialogCancel className="mt-0 rounded-full border-success bg-success text-white hover:bg-success/90 hover:text-white dark:text-success-foreground dark:hover:text-success-foreground">
            Keep on
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
