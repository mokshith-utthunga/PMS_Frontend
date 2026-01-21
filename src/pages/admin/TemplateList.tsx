import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { templateService, settingsService } from '@/services';
import MainLayout from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { KRATemplate } from '@/types';

interface KPITemplate {
  id: string;
  title: string;
  metric_type: string;
  suggested_weight: number;
}

export default function TemplateList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ['kra-templates'],
    queryFn: async () => {
      const result = await templateService.kra.getAll();
      return result.data || [];
    },
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const result = await settingsService.departments.getAll();
      return result.data;
    },
  });

  const { data: grades } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const result = await settingsService.grades.getAll();
      return result.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await templateService.kra.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      toast.success('Template deleted successfully');
      setDeleteId(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete template: ' + error.message);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: KRATemplate) => {
      const result = await templateService.kra.duplicate(template.id);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kra-templates'] });
      toast.success('Template duplicated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to duplicate template: ' + error.message);
    },
  });

  const filteredTemplates = templates?.filter((template) => {
    if (departmentFilter !== 'all' && template.department !== departmentFilter) {
      if (departmentFilter === 'universal' && template.department !== null) return false;
      if (departmentFilter !== 'universal' && template.department !== departmentFilter) return false;
    }
    if (gradeFilter !== 'all' && template.grade !== gradeFilter) {
      if (gradeFilter === 'universal' && template.grade !== null) return false;
      if (gradeFilter !== 'universal' && template.grade !== gradeFilter) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Goal Templates</h1>
            <p className="text-muted-foreground">
              Create and manage KRA/KPI templates for different roles
            </p>
          </div>
          <Button onClick={() => navigate('/admin/templates/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Add Template
          </Button>
        </div>

        <div className="flex gap-4">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              <SelectItem value="universal">Universal (All)</SelectItem>
              {departments?.map((dept) => (
                <SelectItem key={dept.name} value={dept.name}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={gradeFilter} onValueChange={setGradeFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by grade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Grades</SelectItem>
              <SelectItem value="universal">Universal (All)</SelectItem>
              {grades?.map((grade) => (
                <SelectItem key={grade.name} value={grade.name}>
                  {grade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredTemplates?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <p className="text-muted-foreground mb-4">No templates found</p>
              <Button onClick={() => navigate('/admin/templates/new')}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Template
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredTemplates?.map((template) => (
              <Card key={template.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2">
                        {template.title}
                        {!template.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => duplicateMutation.mutate(template)}
                        disabled={duplicateMutation.isPending}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => navigate(`/admin/templates/${template.id}`)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setDeleteId(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <Badge variant="outline">
                      {template.department || 'All Departments'}
                    </Badge>
                    <Badge variant="outline">{template.grade || 'All Grades'}</Badge>
                    <Badge variant="outline">Weight: {template.suggested_weight}%</Badge>
                    <Badge variant="outline">
                      {template.kpi_count ?? template.kpi_templates?.length ?? 0} KPI
                      {(template.kpi_count ?? template.kpi_templates?.length ?? 0) !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                  {/* {((template.kpi_count ?? template.kpi_templates?.length ?? 0) > 0) && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">KPIs:</span>{' '}
                      {template.kpi_templates && template.kpi_templates.length > 0
                        ? template.kpi_templates.map((kpi) => kpi.title).join(', ')
                        : `${template.kpi_count ?? 0} KPI${(template.kpi_count ?? 0) !== 1 ? 's' : ''} configured`}
                    </div>
                  )} */}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
