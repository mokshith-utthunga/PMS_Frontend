import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateService, settingsService } from '@/services';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { CalibrationConfig, CalibrationRule, validateCalibrationRules, sortCalibrationRules } from '@/components/admin/CalibrationConfig';

interface KPITemplateForm {
  id?: string;
  title: string;
  description: string;
  metric_type: string;
  suggested_target: string;
  suggested_weight: number;
  calibration?: CalibrationRule[] | null;
}

interface KRATemplateForm {
  title: string;
  description: string;
  suggested_weight: number;
  department: string;
  grade: string;
  is_active: boolean;
  kpi_templates: KPITemplateForm[];
}

const emptyKPI: KPITemplateForm = {
  title: '',
  description: '',
  metric_type: 'number',
  suggested_target: '',
  suggested_weight: 50,
  calibration: null,
};

export default function TemplateForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [formData, setFormData] = useState<KRATemplateForm>({
    title: '',
    description: '',
    suggested_weight: 25,
    department: '',
    grade: '',
    is_active: true,
    kpi_templates: [{ ...emptyKPI }],
  });

  const { data: existingTemplate, isLoading: loadingTemplate, error: templateError } = useQuery({
    queryKey: ['kra-template', id],
    queryFn: async () => {
      if (!id) return null;
      const result = await templateService.kra.getById(id);
      
      if (result.data) {
        const kpisResult = await templateService.kpi.getByKRATemplate(id);
        return { ...result.data, kpi_templates: kpisResult.data || [] };
      }
      return null;
    },
    enabled: isEditing,
    retry: 1,
  });

  const { data: departments, error: departmentsError } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const result = await settingsService.departments.getAll();
      return result.data;
    },
    retry: 1,
  });

  const { data: grades, error: gradesError } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const result = await settingsService.grades.getAll();
      return result.data;
    },
    retry: 1,
  });

  useEffect(() => {
    if (existingTemplate) {
      setFormData({
        title: existingTemplate.title,
        description: existingTemplate.description || '',
        suggested_weight: existingTemplate.suggested_weight,
        department: existingTemplate.department || '',
        grade: existingTemplate.grade || '',
        is_active: existingTemplate.is_active,
        kpi_templates: existingTemplate.kpi_templates.length > 0
          ? existingTemplate.kpi_templates.map((kpi: any) => ({
              id: kpi.id,
              title: kpi.title,
              description: kpi.description || '',
              metric_type: kpi.metric_type,
              suggested_target: kpi.suggested_target || '',
              suggested_weight: kpi.suggested_weight,
              calibration: kpi.calibration || null,
            }))
          : [{ ...emptyKPI }],
      });
    }
  }, [existingTemplate]);

  // Show error toasts for query errors
  useEffect(() => {
    if (templateError) {
      const errorMessage = templateError instanceof Error 
        ? templateError.message 
        : 'Failed to load template. Please try again.';
      toast.error(`Error loading template: ${errorMessage}`);
    }
  }, [templateError]);

  useEffect(() => {
    if (departmentsError) {
      const errorMessage = departmentsError instanceof Error 
        ? departmentsError.message 
        : 'Failed to load departments.';
      toast.error(`Error loading departments: ${errorMessage}`);
    }
  }, [departmentsError]);

  useEffect(() => {
    if (gradesError) {
      const errorMessage = gradesError instanceof Error 
        ? gradesError.message 
        : 'Failed to load grades.';
      toast.error(`Error loading grades: ${errorMessage}`);
    }
  }, [gradesError]);

  // Track previous totalKPIWeight to show toast only when it changes
  const prevTotalWeightRef = useRef<number | null>(null);
  
  // Calculate total KPI weight for display and validation
  const totalKPIWeight = formData.kpi_templates
    .filter(kpi => kpi.title.trim())
    .reduce((sum, kpi) => sum + Number(kpi.suggested_weight || 0), 0);

  // Show toast when KPI weights don't total 100%
  useEffect(() => {
    const hasKPIs = formData.kpi_templates.some(kpi => kpi.title.trim());
    
    // Only show toast if:
    // 1. There are KPIs with titles
    // 2. Total is not 100%
    // 3. The total has changed (not on initial render)
    if (hasKPIs && totalKPIWeight !== 100 && prevTotalWeightRef.current !== null) {
      if (prevTotalWeightRef.current !== totalKPIWeight) {
        toast.error(`KPI weights total ${totalKPIWeight}%. They must total exactly 100%.`, {
          duration: 4000,
        });
      }
    }
    
    // Update the ref for next comparison
    prevTotalWeightRef.current = totalKPIWeight;
  }, [totalKPIWeight, formData.kpi_templates]);

  const saveMutation = useMutation({
    mutationFn: async (data: KRATemplateForm) => {
      const kraPayload = {
        title: data.title,
        description: data.description || null,
        suggested_weight: data.suggested_weight,
        department: data.department || null,
        grade: data.grade || null,
        is_active: data.is_active,
      };

      let kraId: string;

      if (isEditing && id) {
        try {
          await templateService.kra.update(id, kraPayload);
          kraId = id;
        } catch (updateError: any) {
          const errorMessage = updateError?.response?.data?.error || updateError?.message || 'Failed to update template';
          throw new Error(`Error updating template: ${errorMessage}`);
        }

        // Get existing KPIs to compare
        const existingKPIsResult = await templateService.kpi.getByKRATemplate(id);
        const existingKPIs = existingKPIsResult.data || [];
        const existingKPIIds = new Set(existingKPIs.map(kpi => kpi.id).filter(Boolean));
        
        // Track which KPIs are being kept
        const updatedKPIIds = new Set<string>();
        
        // Update or create KPIs
        for (const kpi of data.kpi_templates.filter(k => k.title.trim())) {
          try {
            if (kpi.id && existingKPIIds.has(kpi.id)) {
              // Update existing KPI
              await templateService.kpi.update(kpi.id, {
                title: kpi.title,
                description: kpi.description || undefined,
                metric_type: kpi.metric_type,
                suggested_target: kpi.suggested_target || undefined,
                suggested_weight: kpi.suggested_weight,
                calibration: kpi.calibration || null,
              });
              updatedKPIIds.add(kpi.id);
            } else {
              // Create new KPI
              await templateService.kpi.create({
                kra_template_id: kraId,
                title: kpi.title,
                description: kpi.description || undefined,
                metric_type: kpi.metric_type,
                target_value: kpi.suggested_target || undefined,
                weight: kpi.suggested_weight,
                calibration: kpi.calibration || null,
              });
            }
          } catch (kpiError: any) {
            const errorMessage = kpiError?.response?.data?.error || kpiError?.message || 'Failed to save KPI';
            throw new Error(`Error saving KPI "${kpi.title}": ${errorMessage}`);
          }
        }
        
        // Delete KPIs that were removed
        for (const existingKPI of existingKPIs) {
          if (existingKPI.id && !updatedKPIIds.has(existingKPI.id)) {
            try {
              await templateService.kpi.delete(existingKPI.id);
            } catch (deleteError: any) {
              const errorMessage = deleteError?.response?.data?.error || deleteError?.message || 'Failed to delete KPI';
              throw new Error(`Error deleting KPI: ${errorMessage}`);
            }
          }
        }
      } else {
        try {
          const result = await templateService.kra.create(kraPayload);
          kraId = result.data.id;
        } catch (createError: any) {
          const errorMessage = createError?.response?.data?.error || createError?.message || 'Failed to create template';
          throw new Error(`Error creating template: ${errorMessage}`);
        }

        // Create KPI templates
        for (const kpi of data.kpi_templates.filter(k => k.title.trim())) {
          try {
            await templateService.kpi.create({
              kra_template_id: kraId,
              title: kpi.title,
              description: kpi.description || undefined,
              metric_type: kpi.metric_type,
              target_value: kpi.suggested_target || undefined,
              weight: kpi.suggested_weight,
              calibration: kpi.calibration || null,
            });
          } catch (kpiError: any) {
            const errorMessage = kpiError?.response?.data?.error || kpiError?.message || 'Failed to create KPI';
            throw new Error(`Error creating KPI "${kpi.title}": ${errorMessage}`);
          }
        }
      }

      return kraId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      toast.success(isEditing ? 'Template updated successfully' : 'Template created successfully');
      navigate('/admin/templates');
    },
    onError: (error: any) => {
      const errorMessage = error?.response?.data?.error || error?.message || 'An unexpected error occurred';
      toast.error(`Failed to save template: ${errorMessage}`);
      console.error('Template save error:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast.error('Please enter a template title');
      return;
    }

    const totalKPIWeight = formData.kpi_templates
      .filter(kpi => kpi.title.trim())
      .reduce((sum, kpi) => sum + Number(kpi.suggested_weight || 0), 0);

    if (totalKPIWeight !== 100 && formData.kpi_templates.some(kpi => kpi.title.trim())) {
      toast.error('KPI weights must total 100%');
      return;
    }

    // Validate calibration rules for each KPI
    const kpisWithTitles = formData.kpi_templates.filter(kpi => kpi.title.trim());
    for (let i = 0; i < kpisWithTitles.length; i++) {
      const kpi = kpisWithTitles[i];
      if (kpi.calibration && kpi.calibration.length > 0) {
        const calibrationErrors = validateCalibrationRules(kpi.calibration);
        if (calibrationErrors.length > 0) {
          toast.error(`KPI "${kpi.title}" calibration error: ${calibrationErrors[0]}`);
          return;
        }
      }
    }

    // Sort calibration rules before saving (highest threshold first)
    const processedFormData = {
      ...formData,
      kpi_templates: formData.kpi_templates.map(kpi => ({
        ...kpi,
        calibration: sortCalibrationRules(kpi.calibration),
      })),
    };

    saveMutation.mutate(processedFormData);
  };

  const addKPI = () => {
    setFormData((prev) => ({
      ...prev,
      kpi_templates: [...prev.kpi_templates, { ...emptyKPI }],
    }));
  };

  const removeKPI = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      kpi_templates: prev.kpi_templates.filter((_, i) => i !== index),
    }));
  };

  const updateKPI = (index: number, field: keyof KPITemplateForm, value: string | number | CalibrationRule[] | null) => {
    setFormData((prev) => ({
      ...prev,
      kpi_templates: prev.kpi_templates.map((kpi, i) =>
        i === index ? { ...kpi, [field]: value } : kpi
      ),
    }));
  };

  if (loadingTemplate) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  // Show error state if template not found or failed to load
  if (isEditing && !loadingTemplate && !existingTemplate) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-destructive mb-2">Template Not Found</h2>
            <p className="text-muted-foreground mb-4">
              {templateError 
                ? 'Failed to load template. Please try again later.'
                : 'The template you\'re trying to edit doesn\'t exist or you don\'t have permission to access it.'}
            </p>
            <Button onClick={() => navigate('/admin/templates')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Templates
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/templates')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {isEditing ? 'Edit Template' : 'Create Template'}
            </h1>
            <p className="text-muted-foreground">
              {isEditing ? 'Update the KRA/KPI template' : 'Create a new KRA template with KPIs'}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>KRA Template Details</CardTitle>
              <CardDescription>
                Define the Key Result Area that employees can use
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Sales Revenue Growth"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe this KRA..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select
                    value={formData.department || 'all'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, department: value === 'all' ? '' : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departments?.map((dept) => (
                        <SelectItem key={dept.name} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="grade">Grade</Label>
                  <Select
                    value={formData.grade || 'all'}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, grade: value === 'all' ? '' : value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Grades</SelectItem>
                      {grades?.map((grade) => (
                        <SelectItem key={grade.name} value={grade.name}>
                          {grade.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="weight">Suggested Weight (%)</Label>
                  <Input
                    id="weight"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.suggested_weight}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        suggested_weight: parseInt(e.target.value) || 0,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="active">Active</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Switch
                      id="active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_active: checked }))
                      }
                    />
                    <span className="text-sm text-muted-foreground">
                      {formData.is_active ? 'Available to employees' : 'Hidden from employees'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>KPI Templates</CardTitle>
                  <CardDescription>
                    Define the KPIs that will be created with this KRA. Weights must total 100%.
                    {totalKPIWeight > 0 && (
                      <span className={totalKPIWeight === 100 ? 'text-green-600' : 'text-destructive'}>
                        {' '}Current total: {totalKPIWeight}%
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addKPI}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add KPI
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.kpi_templates.map((kpi, index) => (
                <Card key={index} className="bg-muted/50">
                  <CardContent className="pt-4 space-y-4">
                    <div className="flex items-start justify-between">
                      <Label className="text-base font-medium">KPI {index + 1}</Label>
                      {formData.kpi_templates.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeKPI(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={kpi.title}
                        onChange={(e) => updateKPI(index, 'title', e.target.value)}
                        placeholder="e.g., Quarterly Sales Target"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Textarea
                        value={kpi.description}
                        onChange={(e) => updateKPI(index, 'description', e.target.value)}
                        placeholder="Describe this KPI..."
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Metric Type</Label>
                        <Select
                          value={kpi.metric_type}
                          onValueChange={(value) => updateKPI(index, 'metric_type', value)}
                        >
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

                      <div className="space-y-2">
                        <Label>Suggested Target</Label>
                        <Input
                          value={kpi.suggested_target}
                          onChange={(e) => updateKPI(index, 'suggested_target', e.target.value)}
                          placeholder="e.g., 100000"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Weight (%)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={kpi.suggested_weight}
                          onChange={(e) =>
                            updateKPI(index, 'suggested_weight', parseInt(e.target.value) || 0)
                          }
                        />
                      </div>
                    </div>

                    {/* Calibration Configuration */}
                    <div className="mt-4">
                      <CalibrationConfig
                        value={kpi.calibration}
                        onChange={(calibration) => updateKPI(index, 'calibration', calibration)}
                        disabled={false}
                        targetValue={kpi.suggested_target}
                        metricType={kpi.metric_type}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/templates')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
