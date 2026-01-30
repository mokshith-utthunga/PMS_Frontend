import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { calibrationService, settingsService, employeeService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import type { CalibrationEntry as BaseCalibrationEntry } from '@/types';
import type { QuotaRuleData } from '@/services/calibration.service';
import { 
  ArrowLeft, 
  Loader2, 
  Save,
  Check,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CalibrationEntry extends BaseCalibrationEntry {
  original_rating: number | null;
  calibrated_rating?: number | null;
  final_rating?: number | null;
  is_exception?: boolean;
  exception_reason?: string | null;
  exception_status?: string | null;
  employee?: {
    emp_id: string;
    first_name: string;
    last_name: string;
    department: string;
    grade: string;
  };
}

interface QuotaRule extends QuotaRuleData {
  max_count?: number | null;
}

interface RatingScale {
  value: number;
  name: string;
  color: string | null;
}

export default function CalibrationSession() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [group, setGroup] = useState<any>(null);
  const [entries, setEntries] = useState<CalibrationEntry[]>([]);
  const [quotaRules, setQuotaRules] = useState<QuotaRule[]>([]);
  const [ratingScales, setRatingScales] = useState<RatingScale[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<CalibrationEntry | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = useState(false);
  const [exceptionReason, setExceptionReason] = useState('');

  useEffect(() => {
    fetchData();
  }, [groupId]);

  const fetchData = async () => {
    if (!groupId) return;

    try {
      // Get group
      const groupResult = await calibrationService.groups.getById(groupId);

      if (!groupResult.data) {
        setLoading(false);
        return;
      }
      setGroup(groupResult.data);

      // Get rating scales
      const scalesResult = await settingsService.ratingScales.getDefault();
      setRatingScales(scalesResult.data || []);

      // Get quota rules
      const quotasResult = await calibrationService.quotaRules.getByGroup(groupId);
      const quotaRulesWithMaxCount: QuotaRule[] = (quotasResult.data || []).map(q => ({
        ...q,
        max_count: null
      }));
      setQuotaRules(quotaRulesWithMaxCount);

      // Get calibration entries with employee data
      const entriesResult = await calibrationService.entries.getByGroup(groupId);

      // Fetch employee details for each entry
      const entriesWithEmployees: CalibrationEntry[] = await Promise.all(
        (entriesResult.data || []).map(async (entry) => {
          const empResult = await employeeService.getById(entry.employee_id);
          const emp = empResult.data;

          return {
            ...entry,
            original_rating: entry.original_rating ?? null,
            calibrated_rating: entry.calibrated_rating ?? null,
            final_rating: undefined,
            is_exception: false,
            exception_reason: null,
            exception_status: null,
            employee: emp ? {
              emp_id: emp.emp_id || '',
              first_name: emp.first_name || '',
              last_name: emp.last_name || '',
              department: emp.department || '',
              grade: emp.grade || ''
            } : undefined
          };
        })
      );

      setEntries(entriesWithEmployees);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getRatingDistribution = () => {
    const distribution: Record<number, number> = {};
    ratingScales.forEach(s => distribution[s.value] = 0);
    
    entries.forEach(entry => {
      const rating = entry.calibrated_rating || entry.original_rating;
      if (rating) {
        distribution[rating] = (distribution[rating] || 0) + 1;
      }
    });
    
    return distribution;
  };

  const distribution = getRatingDistribution();
  const totalEntries = entries.length;

  const handleRatingChange = async (entry: CalibrationEntry, newRating: number) => {
    try {
      await calibrationService.entries.update(entry.id, { calibrated_rating: newRating });

      setEntries(prev => 
        prev.map(e => 
          e.id === entry.id 
            ? { ...e, calibrated_rating: newRating }
            : e
        )
      );
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleMarkException = async () => {
    if (!selectedEntry) return;

    try {
      await calibrationService.entries.update(selectedEntry.id, { 
        justification: exceptionReason
      } as Partial<BaseCalibrationEntry>);

      setEntries(prev => 
        prev.map(e => 
          e.id === selectedEntry.id 
            ? { ...e, is_exception: true, exception_reason: exceptionReason, exception_status: 'pending' }
            : e
        )
      );

      setExceptionDialogOpen(false);
      setExceptionReason('');
      setSelectedEntry(null);
      toast({ title: 'Exception marked' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update group status if still draft
      if (group.status === 'draft' && groupId) {
        await calibrationService.groups.update(groupId, { status: 'in_progress' });
      }

      toast({ title: 'Progress saved' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    // Check quota compliance
    const violations: string[] = [];
    
    quotaRules.forEach(rule => {
      const count = distribution[rule.rating_value] || 0;
      const targetCount = Math.round((rule.percentage / 100) * totalEntries);
      const tolerance = Math.max(1, Math.round(totalEntries * 0.05)); // 5% tolerance
      
      if (Math.abs(count - targetCount) > tolerance) {
        const scale = ratingScales.find(s => s.value === rule.rating_value);
        violations.push(`Rating ${rule.rating_value} (${scale?.name}): ${count} vs target ${targetCount}`);
      }
    });

    if (violations.length > 0) {
      toast({
        title: 'Quota violations',
        description: `Please adjust ratings: ${violations.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    setSaving(true);
    try {
      // Set final ratings (using calibrated_rating as the final value)
      for (const entry of entries) {
        await calibrationService.entries.update(entry.id, { 
          calibrated_rating: entry.calibrated_rating || entry.original_rating 
        } as Partial<BaseCalibrationEntry>);
      }

      // Update group status
      if (groupId) {
        await calibrationService.groups.update(groupId, { status: 'completed' });
      }

      toast({ title: 'Calibration completed' });
      navigate('/calibration');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
  };

  const getRatingChange = (entry: CalibrationEntry) => {
    if (!entry.original_rating || !entry.calibrated_rating) return null;
    if (entry.calibrated_rating > entry.original_rating) return 'up';
    if (entry.calibrated_rating < entry.original_rating) return 'down';
    return 'same';
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </MainLayout>
    );
  }

  if (!group) {
    return (
      <MainLayout>
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Calibration group not found.</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/calibration')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{group.name}</h1>
              <p className="text-muted-foreground">Calibration Session</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            {group.status !== 'completed' && (
              <Button onClick={handleComplete} disabled={saving}>
                <Check className="mr-2 h-4 w-4" />
                Complete
              </Button>
            )}
          </div>
        </div>

        {/* Distribution Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Rating Distribution</CardTitle>
            <CardDescription>Current vs target distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {ratingScales.map((scale) => {
                const quota = quotaRules.find(r => r.rating_value === scale.value);
                const count = distribution[scale.value] || 0;
                const percentage = totalEntries > 0 ? (count / totalEntries) * 100 : 0;
                const targetPercentage = quota?.percentage || 0;
                const isOverTarget = percentage > targetPercentage + 5;
                const isUnderTarget = percentage < targetPercentage - 5;

                return (
                  <div key={scale.value} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: scale.color || '#888' }} 
                        />
                        <span>{scale.value} - {scale.name}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={
                          isOverTarget ? 'text-destructive' : 
                          isUnderTarget ? 'text-orange-500' : ''
                        }>
                          {count} ({percentage.toFixed(1)}%)
                        </span>
                        <span className="text-muted-foreground">
                          Target: {targetPercentage}%
                        </span>
                      </div>
                    </div>
                    <div className="relative">
                      <Progress value={percentage} className="h-2" />
                      <div 
                        className="absolute top-0 h-2 w-0.5 bg-primary"
                        style={{ left: `${targetPercentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Entries Table */}
        <Card>
          <CardHeader>
            <CardTitle>Employees ({entries.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Original</TableHead>
                  <TableHead className="text-center">Calibrated</TableHead>
                  <TableHead className="text-center">Change</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const change = getRatingChange(entry);
                  return (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {entry.employee?.first_name} {entry.employee?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {entry.employee?.emp_id}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{entry.employee?.department}</TableCell>
                      <TableCell>{entry.employee?.grade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{entry.original_rating || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Select
                          value={entry.calibrated_rating?.toString() || ''}
                          onValueChange={(v) => handleRatingChange(entry, parseInt(v))}
                          disabled={group.status === 'completed'}
                        >
                          <SelectTrigger className="w-20 mx-auto">
                            <SelectValue placeholder="-" />
                          </SelectTrigger>
                          <SelectContent>
                            {ratingScales.map(s => (
                              <SelectItem key={s.value} value={s.value.toString()}>
                                {s.value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-center">
                        {change === 'up' && <ArrowUp className="h-4 w-4 text-green-500 mx-auto" />}
                        {change === 'down' && <ArrowDown className="h-4 w-4 text-red-500 mx-auto" />}
                        {change === 'same' && <Minus className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell>
                        {entry.is_exception ? (
                          <Badge variant="secondary">Exception</Badge>
                        ) : entry.final_rating ? (
                          <Badge variant="outline">Finalized</Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {!entry.is_exception && group.status !== 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setExceptionDialogOpen(true);
                            }}
                          >
                            Mark Exception
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Exception Dialog */}
        <Dialog open={exceptionDialogOpen} onOpenChange={setExceptionDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Mark as Exception</DialogTitle>
              <DialogDescription>
                Provide a reason for this rating exception
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  placeholder="Explain why this employee's rating should be an exception..."
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setExceptionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleMarkException} disabled={!exceptionReason.trim()}>
                Submit Exception
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
