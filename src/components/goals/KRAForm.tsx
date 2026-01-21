import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import type { KRA } from '@/types';

interface KRAFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { title: string; description: string; weight: number }) => Promise<void>;
  editingKRA?: KRA | null;
  availableWeight: number;
}

export function KRAForm({ open, onOpenChange, onSubmit, editingKRA, availableWeight }: KRAFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    weight: '',
  });

  // Sync form data when editingKRA changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: editingKRA?.title || '',
        description: editingKRA?.description || '',
        weight: editingKRA?.weight?.toString() || '',
      });
    }
  }, [open, editingKRA]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        title: formData.title,
        description: formData.description,
        weight: parseFloat(formData.weight),
      });
      onOpenChange(false);
      setFormData({ title: '', description: '', weight: '' });
    } catch (error) {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  // Ensure numeric addition by converting editingKRA.weight to number
  const maxWeight = editingKRA 
    ? availableWeight + Number(editingKRA.weight || 0) 
    : availableWeight;
  
  // Ensure maxWeight is at least 1 to avoid HTML validation error (min > max)
  const effectiveMaxWeight = Math.max(1, maxWeight);
  const noWeightAvailable = maxWeight < 1 && !editingKRA;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingKRA ? 'Edit KRA' : 'Add New KRA'}</DialogTitle>
          <DialogDescription>
            Key Result Area - a major outcome area for your role. Weight available: {maxWeight}%
          </DialogDescription>
        </DialogHeader>
        {noWeightAvailable ? (
          <div className="py-4 text-center text-muted-foreground">
            <p>No weight available. Total KRA weight is already 100%.</p>
            <p className="text-sm mt-2">Edit or remove existing KRAs to free up weight.</p>
            <Button className="mt-4" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kra-title">KRA Title</Label>
            <Input
              id="kra-title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Revenue Growth"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kra-description">Description</Label>
            <Textarea
              id="kra-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this Key Result Area..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kra-weight">Weight (%)</Label>
            <Input
              id="kra-weight"
              type="number"
              min="1"
              max={effectiveMaxWeight}
              value={formData.weight}
              onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
              placeholder={`Max: ${maxWeight}%`}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingKRA ? (
                'Update KRA'
              ) : (
                'Create KRA'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
