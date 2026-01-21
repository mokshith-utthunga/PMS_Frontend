// Calibration Form Page - Create calibration group
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Save, Users, AlertCircle } from 'lucide-react';
import { PageLoader, ButtonLoader } from '@/loaders';
import { TOTAL_WEIGHT } from '@/utils/constants';
import { useCalibrationFormData, useCalibrationFormOperations } from '@/hooks/useCalibrationForm';
import { QuotaRulesCard } from '@/components/calibration/QuotaRulesCard';

export default function CalibrationForm() {
  const navigate = useNavigate();

  // Fetch form data
  const formData = useCalibrationFormData();
  const { activeCycle, departments, grades, businessUnits, ratingScales, defaultQuotas, departmentQuotas, loading } = formData;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedBusinessUnit, setSelectedBusinessUnit] = useState('');

  // Form operations
  const operations = useCalibrationFormOperations(activeCycle, ratingScales, defaultQuotas, departmentQuotas);
  const {
    saving, previewCount, quotaRules, totalPercentage,
    updateQuotasForDepartment, fetchPreviewCount, handleQuotaChange, submitForm,
  } = operations;

  // Fetch preview count when filters change
  useEffect(() => {
    if (activeCycle) {
      fetchPreviewCount({
        department: selectedDepartment,
        grade: selectedGrade,
        businessUnit: selectedBusinessUnit,
      });
    }
  }, [selectedDepartment, selectedGrade, selectedBusinessUnit, activeCycle, fetchPreviewCount]);

  // Update quotas when department changes
  useEffect(() => {
    updateQuotasForDepartment(selectedDepartment);
  }, [selectedDepartment, updateQuotasForDepartment]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitForm({
      name,
      description,
      department: selectedDepartment,
      grade: selectedGrade,
      businessUnit: selectedBusinessUnit,
    });
  };

  // Loading state
  if (loading) {
    return <MainLayout><PageLoader /></MainLayout>;
  }

  // No active cycle
  if (!activeCycle) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No active performance cycle. Please activate a cycle first.
          </AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate('/calibration')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Calibration Group</h1>
          <p className="text-muted-foreground">
            Create a group of employees for rating calibration
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Details */}
          <Card>
            <CardHeader>
              <CardTitle>Group Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., Engineering Team Q4 2025"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Employee Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Employee Filters</CardTitle>
              <CardDescription>Filter employees to include in this calibration group</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={selectedDepartment || '__all__'} onValueChange={val => setSelectedDepartment(val === '__all__' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All departments" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All departments</SelectItem>
                      {departments.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Grade</Label>
                  <Select value={selectedGrade || '__all__'} onValueChange={val => setSelectedGrade(val === '__all__' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All grades" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All grades</SelectItem>
                      {grades.map(g => (
                        <SelectItem key={g} value={g}>{g}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Business Unit</Label>
                  <Select value={selectedBusinessUnit || '__all__'} onValueChange={val => setSelectedBusinessUnit(val === '__all__' ? '' : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="All units" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All units</SelectItem>
                      {businessUnits.map(b => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {previewCount !== null && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>Approximately {previewCount} employees with submitted evaluations</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quota Rules */}
          <QuotaRulesCard
            ratingScales={ratingScales}
            quotaRules={quotaRules}
            totalPercentage={totalPercentage}
            onQuotaChange={handleQuotaChange}
          />

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/calibration')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || totalPercentage !== TOTAL_WEIGHT}>
              {saving && <ButtonLoader className="mr-2" />}
              <Save className="mr-2 h-4 w-4" />
              Create Group
            </Button>
          </div>
        </form>
      </div>
    </MainLayout>
  );
}
