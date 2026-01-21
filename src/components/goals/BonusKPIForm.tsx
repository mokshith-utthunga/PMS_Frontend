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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface BonusKPI {
  id: string;
  bonus_kra_id: string;
  title: string;
  description?: string | null;
  metric_type: 'number' | 'percentage' | 'milestone' | 'qualitative';
  target_value?: string | null;
  due_date?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'returned' | 'locked';
  manager_comments?: string | null;
}

interface BonusKPIFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    metric_type: 'number' | 'percentage' | 'milestone' | 'qualitative';
    target_value: string;
    due_date: string;
  }) => Promise<void>;
  editingBonusKPI?: BonusKPI | null;
  bonusKraTitle: string;
}

export function BonusKPIForm({
  open,
  onOpenChange,
  onSubmit,
  editingBonusKPI,
  bonusKraTitle,
}: BonusKPIFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [metricType, setMetricType] = useState<'number' | 'percentage' | 'milestone' | 'qualitative'>('milestone');
  const [targetValue, setTargetValue] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (editingBonusKPI) {
      setTitle(editingBonusKPI.title);
      setDescription(editingBonusKPI.description || '');
      setMetricType(editingBonusKPI.metric_type);
      setTargetValue(editingBonusKPI.target_value || '');
      setDueDate(editingBonusKPI.due_date || '');
    } else {
      setTitle('');
      setDescription('');
      setMetricType('milestone');
      setTargetValue('');
      setDueDate('');
    }
  }, [editingBonusKPI, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        metric_type: metricType,
        target_value: targetValue.trim(),
        due_date: dueDate,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by parent
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editingBonusKPI ? 'Edit' : 'Add'} Bonus KPI</DialogTitle>
          <DialogDescription>
            Add a KPI for: <span className="font-medium">{bonusKraTitle}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Complete innovation project"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the KPI in detail..."
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="metric_type">Metric Type</Label>
              <Select value={metricType} onValueChange={(v) => setMetricType(v as typeof metricType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="milestone">Milestone</SelectItem>
                  <SelectItem value="qualitative">Qualitative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="target_value">Target Value</Label>
              <Input
                id="target_value"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder={metricType === 'percentage' ? 'e.g., 100' : 'e.g., Complete by deadline'}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_date">Due Date</Label>
              <Input
                id="due_date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !title.trim()}>
              {isSubmitting ? 'Saving...' : editingBonusKPI ? 'Update' : 'Add'} KPI
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
