import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { calibrationService, cycleService, settingsService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, 
  Users,
  ChevronRight,
  BarChart3,
  Save,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';

interface CalibrationGroup {
  id: string;
  name: string;
  description: string | null;
  status: string;
  filters: any;
  cycle_id: string;
  cycle_name?: string;
  employee_count?: number;
}

interface QuotaRule {
  rating_value: number;
  percentage: number;
  rating_name?: string;
  rating_color?: string;
}

interface DepartmentOverride {
  department: string;
  quotas: QuotaRule[];
}

export default function CalibrationList() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<CalibrationGroup[]>([]);
  const [activeCycle, setActiveCycle] = useState<any>(null);
  
  // Settings state
  const [isEnabled, setIsEnabled] = useState(true);
  const [defaultQuotas, setDefaultQuotas] = useState<QuotaRule[]>([]);
  const [departmentOverrides, setDepartmentOverrides] = useState<DepartmentOverride[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [ratingScales, setRatingScales] = useState<any[]>([]);
  const [newDepartment, setNewDepartment] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get calibration settings
      const settingsResult = await calibrationService.settings.get();

      if (settingsResult.data) {
        setIsEnabled(settingsResult.data.is_enabled);
      }

      // Get active cycle
      const cycleResult = await cycleService.getActive();

      setActiveCycle(cycleResult.data);

      // Get calibration groups with counts
      const groupsResult = await calibrationService.groups.getAll();
      setGroups(groupsResult.data || []);

      // Get rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      
      setRatingScales(scalesResult.data || []);

      // Get default quotas
      const defaultQuotasResult = await calibrationService.settings.getDefaultQuotas();

      const quotasWithNames = (defaultQuotasResult.data || []).map(q => {
        const scale = (scalesResult.data as any[])?.find(s => (s.rating ?? s.value) === q.rating_value);
        return {
          ...q,
          rating_name: scale?.label ?? scale?.name ?? `Rating ${q.rating_value}`,
          rating_color: scale?.color || '#888'
        };
      });
      setDefaultQuotas(quotasWithNames);

      // Get departments
      const deptResult = await settingsService.departments.getAll();
      setDepartments(deptResult.data?.map(d => d.name) || []);

      // Get department overrides
      const deptQuotasResult = await calibrationService.settings.getDepartmentQuotas();

      // Group by department
      const overridesMap = new Map<string, QuotaRule[]>();
      (deptQuotasResult.data || []).forEach(dq => {
        const scale = (scalesResult.data as any[])?.find(s => (s.rating ?? s.value) === dq.rating_value);
        const quota: QuotaRule = {
          rating_value: dq.rating_value,
          percentage: Number(dq.percentage),
          rating_name: scale?.label ?? scale?.name ?? `Rating ${dq.rating_value}`,
          rating_color: scale?.color || '#888'
        };
        
        if (!overridesMap.has(dq.department)) {
          overridesMap.set(dq.department, []);
        }
        overridesMap.get(dq.department)!.push(quota);
      });

      const overrides: DepartmentOverride[] = [];
      overridesMap.forEach((quotas, department) => {
        quotas.sort((a, b) => b.rating_value - a.rating_value);
        overrides.push({ department, quotas });
      });
      setDepartmentOverrides(overrides);

    } catch (error: any) {
      toast({
        title: 'Error loading data',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDefaultQuotaChange = (ratingValue: number, percentage: number) => {
    setDefaultQuotas(prev => 
      prev.map(q => 
        q.rating_value === ratingValue 
          ? { ...q, percentage } 
          : q
      )
    );
  };

  const handleDeptQuotaChange = (deptIndex: number, ratingValue: number, percentage: number) => {
    setDepartmentOverrides(prev => {
      const updated = [...prev];
      updated[deptIndex].quotas = updated[deptIndex].quotas.map(q =>
        q.rating_value === ratingValue ? { ...q, percentage } : q
      );
      return updated;
    });
  };

  const addDepartmentOverride = () => {
    if (!newDepartment) return;
    
    if (departmentOverrides.some(o => o.department === newDepartment)) {
      toast({
        title: 'Department already exists',
        description: 'This department already has custom quotas',
        variant: 'destructive'
      });
      return;
    }

    const newQuotas = ratingScales.map(scale => ({
      rating_value: scale.value,
      percentage: defaultQuotas.find(q => q.rating_value === scale.value)?.percentage || 0,
      rating_name: scale.name,
      rating_color: scale.color
    }));

    setDepartmentOverrides(prev => [...prev, { department: newDepartment, quotas: newQuotas }]);
    setNewDepartment('');
  };

  const removeDepartmentOverride = (index: number) => {
    setDepartmentOverrides(prev => prev.filter((_, i) => i !== index));
  };

  const getTotalPercentage = (quotas: QuotaRule[]) => {
    return quotas.reduce((sum, q) => sum + Number(q.percentage), 0);
  };

  const handleSave = async () => {
    const defaultTotal = getTotalPercentage(defaultQuotas);
    if (defaultTotal !== 100) {
      toast({
        title: 'Invalid default quotas',
        description: 'Default quota percentages must total 100%',
        variant: 'destructive'
      });
      return;
    }

    for (const override of departmentOverrides) {
      const total = getTotalPercentage(override.quotas);
      if (total !== 100) {
        toast({
          title: 'Invalid department quotas',
          description: `${override.department} quota percentages must total 100%`,
          variant: 'destructive'
        });
        return;
      }
    }

    setSaving(true);
    try {
      // Update calibration settings
      await calibrationService.settings.update({ is_enabled: isEnabled });

      // Update default quotas
      await calibrationService.settings.updateDefaultQuotas(defaultQuotas);

      // Update department overrides - flatten the overrides structure
      const flatOverrides = departmentOverrides.flatMap(o => 
        o.quotas.map(q => ({
          department: o.department,
          rating_value: q.rating_value,
          percentage: q.percentage
        }))
      );
      await calibrationService.settings.updateDepartmentQuotas(flatOverrides);

      toast({ title: 'Settings saved successfully' });
    } catch (error: any) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'secondary';
      case 'in_progress': return 'default';
      case 'completed': return 'outline';
      default: return 'secondary';
    }
  };

  const availableDepartments = departments.filter(
    d => !departmentOverrides.some(o => o.department === d)
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calibration</h1>
          <p className="text-muted-foreground">
            Manage rating calibration across teams and departments
          </p>
        </div>

        {activeCycle && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Active Cycle</CardTitle>
                  <CardDescription>{activeCycle.name}</CardDescription>
                </div>
                <Badge>{activeCycle.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Calibration Period: </span>
                  {new Date(activeCycle.calibration_start).toLocaleDateString()} - {new Date(activeCycle.calibration_end).toLocaleDateString()}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Master Switch */}
        <Card>
          <CardHeader>
            <CardTitle>Master Switch</CardTitle>
            <CardDescription>
              Enable or disable the calibration system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="calibration-enabled" className="text-base font-medium">
                  Enable Calibration
                </Label>
                <p className="text-sm text-muted-foreground">
                  When enabled, calibration quotas are enforced during rating distribution
                </p>
              </div>
              <Switch
                id="calibration-enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Default Calibration Quotas */}
        <Card>
          <CardHeader>
            <CardTitle>Default Calibration Quotas</CardTitle>
            <CardDescription>
              These percentages apply to all departments unless overridden below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {defaultQuotas.map((quota) => (
              <div key={quota.rating_value} className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="flex items-center gap-2">
                    <span 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: quota.rating_color || '#888' }} 
                    />
                    {quota.rating_value} - {quota.rating_name}
                  </Label>
                </div>
                <div className="w-24">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={quota.percentage}
                    onChange={(e) => handleDefaultQuotaChange(quota.rating_value, parseInt(e.target.value) || 0)}
                    className="text-right"
                  />
                </div>
                <span className="text-sm text-muted-foreground w-8">%</span>
              </div>
            ))}
            
            <div className="flex items-center justify-end gap-4 pt-2 border-t">
              <span className="font-medium">Total:</span>
              <span className={getTotalPercentage(defaultQuotas) === 100 ? 'text-primary' : 'text-destructive'}>
                {getTotalPercentage(defaultQuotas)}%
              </span>
            </div>

            {getTotalPercentage(defaultQuotas) !== 100 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Default quota percentages must total 100%
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Department Overrides */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Department Overrides</CardTitle>
                <CardDescription>
                  Set custom quotas for specific departments that override the defaults
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {availableDepartments.length > 0 && (
              <div className="flex items-center gap-2">
                <Select value={newDepartment} onValueChange={setNewDepartment}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepartments.map(d => (
                      <SelectItem key={d} value={d}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={addDepartmentOverride} disabled={!newDepartment}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Override
                </Button>
              </div>
            )}

            {departmentOverrides.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No department overrides configured. All departments will use the default quotas.
              </p>
            ) : (
              departmentOverrides.map((override, deptIndex) => (
                <div key={override.department} className="border rounded-lg p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">{override.department}</h4>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeDepartmentOverride(deptIndex)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  
                  {override.quotas.map((quota) => (
                    <div key={quota.rating_value} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Label className="flex items-center gap-2 text-sm">
                          <span 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: quota.rating_color || '#888' }} 
                          />
                          {quota.rating_value} - {quota.rating_name}
                        </Label>
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={quota.percentage}
                          onChange={(e) => handleDeptQuotaChange(deptIndex, quota.rating_value, parseInt(e.target.value) || 0)}
                          className="text-right text-sm"
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-6">%</span>
                    </div>
                  ))}
                  
                  <div className="flex items-center justify-end gap-4 pt-2 border-t">
                    <span className="text-sm font-medium">Total:</span>
                    <span className={`text-sm ${getTotalPercentage(override.quotas) === 100 ? 'text-primary' : 'text-destructive'}`}>
                      {getTotalPercentage(override.quotas)}%
                    </span>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>

        {/* Calibration Groups - only if there are any */}
        {groups.length > 0 && (
          <>
            <div className="pt-6 border-t">
              <h2 className="text-xl font-semibold mb-4">Calibration Groups</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groups.map((group) => (
                <Card key={group.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        {group.description && (
                          <CardDescription className="mt-1">{group.description}</CardDescription>
                        )}
                      </div>
                      <Badge variant={getStatusColor(group.status)}>
                        {group.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>{group.employee_count} employees</span>
                      </div>
                    </div>

                    {group.filters && Object.keys(group.filters).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {group.filters.department && (
                          <Badge variant="outline" className="text-xs">
                            {group.filters.department}
                          </Badge>
                        )}
                        {group.filters.grade && (
                          <Badge variant="outline" className="text-xs">
                            {group.filters.grade}
                          </Badge>
                        )}
                        {group.filters.business_unit && (
                          <Badge variant="outline" className="text-xs">
                            {group.filters.business_unit}
                          </Badge>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Link to={`/calibration/${group.id}`} className="flex-1">
                        <Button variant="outline" size="sm" className="w-full">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          View
                        </Button>
                      </Link>
                      {group.status !== 'completed' && (
                        <Link to={`/calibration/${group.id}/session`} className="flex-1">
                          <Button size="sm" className="w-full">
                            Calibrate
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
