import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

export interface BonusKRA {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'returned' | 'locked';
  manager_comments?: string | null;
}

interface BonusKRAFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string }) => Promise<void>;
  editingBonusKRA?: BonusKRA | null;
}

export function BonusKRAForm({ open, onOpenChange, onSubmit, editingBonusKRA }: BonusKRAFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingBonusKRA) {
      setTitle(editingBonusKRA.title);
      setDescription(editingBonusKRA.description || '');
    } else {
      setTitle('');
      setDescription('');
    }
  }, [editingBonusKRA, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), description: description.trim() });
      onOpenChange(false);
      setTitle('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {editingBonusKRA ? 'Edit Bonus KRA' : 'Add Bonus KRA'}
          </DialogTitle>
          <DialogDescription>
            Bonus KRAs are extra achievements that earn additional points based on rating.
            They don't affect your core KRA weight calculation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bonus-kra-title">Title *</Label>
            <Input
              id="bonus-kra-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Led Innovation Workshop"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bonus-kra-description">Description</Label>
            <Textarea
              id="bonus-kra-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the bonus achievement..."
              rows={3}
            />
          </div>

          <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Bonus Points:</strong> Rating 5 = +5 pts, Rating 4 = +3 pts, 
              Rating 3 = 0 pts, Rating 2 = -3 pts, Rating 1 = -5 pts
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBonusKRA ? 'Update' : 'Add'} Bonus KRA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
