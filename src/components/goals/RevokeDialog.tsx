// Revoke Dialog Component for deleting approved goals
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ButtonLoader } from '@/loaders';
import { AlertTriangle } from 'lucide-react';

type ItemType = 'kra' | 'kpi' | 'bonus_kra' | 'bonus_kpi';

interface RevokeDialogProps {
  open: boolean;
  type: ItemType | null;
  processing: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const TYPE_LABELS: Record<ItemType, string> = {
  kra: 'KRA',
  kpi: 'KPI',
  bonus_kra: 'Bonus KRA',
  bonus_kpi: 'Bonus KPI',
};

export function RevokeDialog({
  open,
  type,
  processing,
  onClose,
  onConfirm,
}: RevokeDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onClose();
  };

  const label = type ? TYPE_LABELS[type] : '';
  const showKPINote = type === 'kra' || type === 'bonus_kra';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Revoke Approved {label}
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to revoke and permanently delete this approved {label}?
            {showKPINote && ' This will also delete all associated KPIs.'}
            <br />
            <strong className="text-destructive">This action cannot be undone.</strong>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={processing}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={processing}>
            {processing && <ButtonLoader className="mr-2" />}
            Revoke & Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
