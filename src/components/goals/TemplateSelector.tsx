import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { templateService } from '@/services';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, PenLine } from 'lucide-react';
import { KRAForm } from './KRAForm';

interface KPITemplate {
  id: string;
  title: string;
  description: string | null;
  metric_type: string;
  suggested_target: string | null;
  suggested_weight: number;
}

interface KRATemplate {
  id: string;
  title: string;
  description: string | null;
  suggested_weight: number;
  department: string | null;
  grade: string | null;
  kpi_templates: KPITemplate[];
  kpi_count?: number;
}

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeDepartment: string;
  employeeGrade: string;
  availableWeight: number;
  onSelectTemplate: (template: KRATemplate) => Promise<void>;
  onCreateCustom: (data: { title: string; description: string; weight: number }) => Promise<void>;
}

export function TemplateSelector({
  open,
  onOpenChange,
  employeeDepartment,
  employeeGrade,
  availableWeight,
  onSelectTemplate,
  onCreateCustom,
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<KRATemplate | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['available-templates', employeeDepartment, employeeGrade],
    queryFn: async () => {
      // Get KRA templates
      const kraResult = await templateService.kra.getAll({ is_active: true });
      const kraTemplates = kraResult.data || [];

      // Get KPI templates for each KRA template
      const templatesWithKPIs = await Promise.all(
        kraTemplates.map(async (kra) => {
          const kpiResult = await templateService.kpi.getByKRATemplate(kra.id);
          // Map KPITemplateData to KPITemplate format
          const kpiTemplates: KPITemplate[] = (kpiResult.data || []).map((kpi) => ({
            id: kpi.id || '',
            title: kpi.title,
            description: kpi.description || null,
            metric_type: kpi.metric_type,
            suggested_target: kpi.suggested_target || kpi.target_value || null,
            suggested_weight: kpi.suggested_weight || kpi.weight || 50,
          }));
          return {
            ...kra,
            kpi_templates: kpiTemplates,
          };
        })
      );

      // Sort by relevance
      const sorted = templatesWithKPIs.sort((a, b) => {
        const scoreA = getMatchScore(a, employeeDepartment, employeeGrade);
        const scoreB = getMatchScore(b, employeeDepartment, employeeGrade);
        return scoreB - scoreA;
      });

      return sorted;
    },
    enabled: open,
  });

  const getMatchScore = (template: KRATemplate, department: string, grade: string): number => {
    const deptMatch = template.department === department;
    const gradeMatch = template.grade === grade;
    const deptUniversal = template.department === null;
    const gradeUniversal = template.grade === null;

    if (deptMatch && gradeMatch) return 4;
    if (deptMatch && gradeUniversal) return 3;
    if (deptUniversal && gradeMatch) return 2;
    if (deptUniversal && gradeUniversal) return 1;
    return 0;
  };

  const getMatchLabel = (template: KRATemplate): string | null => {
    const deptMatch = template.department === employeeDepartment;
    const gradeMatch = template.grade === employeeGrade;

    if (deptMatch && gradeMatch) return 'Recommended';
    if (deptMatch) return 'Your Department';
    if (gradeMatch) return 'Your Grade';
    return null;
  };

  const handleSelectTemplate = async (template: KRATemplate) => {
    setSelectedTemplate(template);
    setIsApplying(true);
    try {
      await onSelectTemplate(template);
      onOpenChange(false);
    } catch (error) {
      // Error handled in parent
    } finally {
      setIsApplying(false);
      setSelectedTemplate(null);
    }
  };

  const handleCreateCustom = async (data: { title: string; description: string; weight: number }) => {
    await onCreateCustom(data);
    setShowCustomForm(false);
    onOpenChange(false);
  };

  if (showCustomForm) {
    return (
      <KRAForm
        open={open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShowCustomForm(false);
          }
          onOpenChange(isOpen);
        }}
        onSubmit={handleCreateCustom}
        availableWeight={availableWeight}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Key Result Area</DialogTitle>
          <DialogDescription>
            Choose from recommended templates or create a custom KRA
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="templates" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="templates" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              From Template
            </TabsTrigger>
            <TabsTrigger value="custom" className="flex items-center gap-2">
              <PenLine className="h-4 w-4" />
              Create Custom
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates" className="flex-1 overflow-auto mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : templates?.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No templates available</p>
                <Button onClick={() => setShowCustomForm(true)}>Create Custom KRA</Button>
              </div>
            ) : (
              <div className="space-y-3 pr-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Showing templates for: <strong>{employeeDepartment}</strong> department,{' '}
                  <strong>{employeeGrade}</strong> grade
                </p>
                {templates?.map((template) => {
                  const matchLabel = getMatchLabel(template);
                  return (
                    <Card
                      key={template.id}
                      className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                        selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.title}
                              {matchLabel && (
                                <Badge variant="secondary" className="text-xs">
                                  {matchLabel}
                                </Badge>
                              )}
                            </CardTitle>
                            {template.description && (
                              <CardDescription className="text-sm">
                                {template.description}
                              </CardDescription>
                            )}
                          </div>
                          <Badge variant="outline">{template.suggested_weight}%</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        {template.kpi_templates.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs font-medium text-muted-foreground">
                              Includes {template.kpi_templates.length} KPI
                              {template.kpi_templates.length !== 1 ? 's' : ''}:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {template.kpi_templates.map((kpi) => (
                                <Badge key={kpi.id} variant="outline" className="text-xs">
                                  {kpi.title} ({kpi.suggested_weight}%)
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          className="w-full mt-3"
                          onClick={() => handleSelectTemplate(template)}
                          disabled={isApplying}
                        >
                          {isApplying && selectedTemplate?.id === template.id ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Applying...
                            </>
                          ) : (
                            'Use This Template'
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="flex-1 overflow-auto mt-4">
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Create a custom KRA tailored to your specific needs
              </p>
              <Button onClick={() => setShowCustomForm(true)}>
                <PenLine className="mr-2 h-4 w-4" />
                Create Custom KRA
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
