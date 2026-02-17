import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { CalibrationConfig, CalibrationRule, validateCalibrationRules, sortCalibrationRules } from '@/components/admin/CalibrationConfig';
import { toast } from 'sonner';
import type { Goal, MetricType } from '@/types';

interface KPIFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    title: string;
    description: string;
    metric_type: MetricType;
    target_value: string;
    weight: number;
    calibration?: CalibrationRule[] | null;
  }) => Promise<void>;
  editingKPI?: Goal | null;
  availableWeight: number;
  kraTitle: string;
}

const metricTypeLabels = {
  number: 'Numeric Value',
  percentage: 'Percentage',
  // milestone: 'Milestone',
  // qualitative: 'Qualitative',
};

export function KPIForm({ open, onOpenChange, onSubmit, editingKPI, availableWeight, kraTitle }: KPIFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [calibrationError, setCalibrationError] = useState<string>('');
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    metric_type: MetricType;
    target_value: string;
    weight: string;
    calibration: CalibrationRule[] | null;
  }>({
    title: '',
    description: '',
    metric_type: 'number',
    target_value: '',
    weight: '',
    calibration: null,
  });

  // Sync form data when editingKPI changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        title: editingKPI?.title || '',
        description: editingKPI?.description || '',
        metric_type: editingKPI?.metric_type || 'number',
        target_value: editingKPI?.target_value || '',
        weight: editingKPI?.weight?.toString() || '',
        calibration: editingKPI?.calibration || null,
      });
      setCalibrationError(''); // Clear error when dialog opens
    }
  }, [open, editingKPI]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    if (!formData.title.trim()) {
      toast.error('KPI Title is required');
      return;
    }

    if (!formData.description.trim()) {
      toast.error('Description is required');
      return;
    }

    if (!formData.metric_type) {
      toast.error('Metric Type is required');
      return;
    }

    if (!formData.target_value.trim()) {
      toast.error('Target Value is required');
      return;
    }

    if (!formData.weight.trim() || parseFloat(formData.weight) <= 0) {
      toast.error('Weight is required and must be greater than 0');
      return;
    }

    // Validate calibration is required
    if (!formData.calibration || formData.calibration.length === 0) {
      setCalibrationError('Please fill the Rating Correlation Analysis');
      toast.error('Please fill the Rating Correlation Analysis');
      return;
    } else {
      setCalibrationError('');
    }

    // Validate calibration rules if provided
    if (formData.calibration && formData.calibration.length > 0) {
      const calibrationErrors = validateCalibrationRules(formData.calibration);
      if (calibrationErrors.length > 0) {
        toast.error('Calibration Error', {
          description: calibrationErrors.join(', '),
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      // Sort calibration rules before submitting
      const sortedCalibration = sortCalibrationRules(formData.calibration);
      
      await onSubmit({
        title: formData.title,
        description: formData.description,
        metric_type: formData.metric_type,
        target_value: formData.target_value,
        weight: parseFloat(formData.weight),
        calibration: sortedCalibration,
      });
      onOpenChange(false);
      setFormData({
        title: '',
        description: '',
        metric_type: 'number',
        target_value: '',
        weight: '',
        calibration: null,
      });
      setCalibrationError(''); // Clear error on successful submit
    } catch (error) {
      // Error handled in parent
    } finally {
      setSubmitting(false);
    }
  };

  // Ensure numeric addition by converting editingKPI.weight to number
  const maxWeight = editingKPI 
    ? availableWeight + Number(editingKPI.weight || 0) 
    : availableWeight;
  
  // Ensure maxWeight is at least 1 to avoid HTML validation error (min > max)
  const effectiveMaxWeight = Math.max(1, maxWeight);
  const noWeightAvailable = maxWeight < 1 && !editingKPI;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingKPI ? 'Edit KPI' : 'Add New KPI'}</DialogTitle>
          <DialogDescription>
            Key Performance Indicator for "{kraTitle}". Weight available: {maxWeight}%
          </DialogDescription>
        </DialogHeader>
        {noWeightAvailable ? (
          <div className="py-4 text-center text-muted-foreground">
            <p>No weight available. Total KPI weight is already 100%.</p>
            <p className="text-sm mt-2">Edit or remove existing KPIs to free up weight.</p>
            <Button className="mt-4" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="kpi-title">KPI Title *</Label>
            <Input
              id="kpi-title"
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="e.g., Increase sales by 20%"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-description">Description *</Label>
            <Textarea
              id="kpi-description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe this KPI in detail..."
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Metric Type *</Label>
              <Select
                value={formData.metric_type}
                onValueChange={(value: MetricType) =>
                  setFormData((prev) => ({ ...prev, metric_type: value }))
                }
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select metric type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(metricTypeLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="kpi-target">Target Value *</Label>
              <Input
                id="kpi-target"
                value={formData.target_value}
                onChange={(e) => setFormData((prev) => ({ ...prev, target_value: e.target.value }))}
                placeholder="e.g., 100 or Complete"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="kpi-weight">Weight (%) *</Label>
            <Input
              id="kpi-weight"
              type="number"
              min="1"
              max={effectiveMaxWeight}
              value={formData.weight}
              onChange={(e) => setFormData((prev) => ({ ...prev, weight: e.target.value }))}
              placeholder={`Max: ${maxWeight}%`}
              required
            />
          </div>

          {/* Calibration Settings */}
          <div className="space-y-2">
            <Label className="text-base font-medium">
            Rating Correlation Analysis *
            </Label>
            {!formData.target_value.trim() || !formData.metric_type ? (
              <div className="p-4 border border-dashed rounded-md bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Please fill in <strong>Target Value</strong> and <strong>Metric Type</strong> before configuring calibration.
                </p>
              </div>
            ) : (
              <>
                <CalibrationConfig
                  value={formData.calibration}
                  onChange={(calibration) => {
                    setFormData((prev) => ({ ...prev, calibration }));
                    // Clear error when calibration is added
                    if (calibration && calibration.length > 0) {
                      setCalibrationError('');
                    }
                  }}
                  disabled={false}
                  targetValue={formData.target_value}
                  metricType={formData.metric_type}
                />
                {calibrationError && (
                  <p className="text-sm text-destructive mt-2">{calibrationError}</p>
                )}
              </>
            )}
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
              ) : editingKPI ? (
                'Update KPI'
              ) : (
                'Create KPI'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
