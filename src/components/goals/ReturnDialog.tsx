// Return Dialog Component for manager feedback
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { ButtonLoader } from '@/loaders';

type ItemType = 'kra' | 'kpi';

interface ReturnDialogProps {
  open: boolean;
  type: ItemType | null;
  processing: boolean;
  onClose: () => void;
  onSubmit: (comments: string) => Promise<boolean>;
}

const TYPE_LABELS: Record<ItemType, string> = {
  kra: 'KRA',
  kpi: 'KPI',
};

export function ReturnDialog({
  open,
  type,
  processing,
  onClose,
  onSubmit,
}: ReturnDialogProps) {
  const [comments, setComments] = useState('');

  const handleSubmit = async () => {
    const success = await onSubmit(comments);
    if (success) {
      setComments('');
      onClose();
    }
  };

  const handleClose = () => {
    setComments('');
    onClose();
  };

  const label = type ? TYPE_LABELS[type] : '';
  const showKPINote = type === 'kra';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return {label} for Revision</DialogTitle>
          <DialogDescription>
            Provide feedback on what needs to be changed
            {showKPINote && ' (all KPIs under this will also be returned)'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="comments">Feedback / Comments</Label>
            <Textarea
              id="comments"
              placeholder="Explain what changes are needed..."
              value={comments}
              onChange={e => setComments(e.target.value)}
              rows={4}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={processing || !comments.trim()}>
            {processing && <ButtonLoader className="mr-2" />}
            Return with Feedback
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
