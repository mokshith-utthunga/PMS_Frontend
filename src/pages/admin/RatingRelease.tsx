import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cycleService, evaluationService, calibrationService, employeeService, notificationService } from '@/services';
import { useToast } from '@/hooks/use-toast';
import { 
  Send, 
  Loader2, 
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  Eye
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ReleaseEntry {
  id: string;
  employee_id: string;
  employee_name: string;
  emp_id: string;
  department: string;
  grade: string;
  overall_rating: number | null;
  final_rating: number | null;
  status: string;
  released_at: string | null;
  acknowledged_at: string | null;
  selected: boolean;
}

export default function RatingRelease() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState(false);
  const [cycles, setCycles] = useState<any[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [entries, setEntries] = useState<ReleaseEntry[]>([]);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchCycles();
  }, []);

  useEffect(() => {
    if (selectedCycleId) {
      fetchReleaseData();
    }
  }, [selectedCycleId]);

  const fetchCycles = async () => {
    const result = await cycleService.getList();

    const cycles = (result.data || []).filter(c => ['active', 'closed'].includes(c.status));
    setCycles(cycles);
    if (cycles.length > 0) {
      setSelectedCycleId(cycles[0].id);
    }
  };

  const fetchReleaseData = async () => {
    setLoading(true);
    try {
      // Get all employees to build the entries
      const empResult = await employeeService.getList({ status: 'active' });
      const allEmployees = empResult.data || [];

      // Get calibration entries for final ratings
      const calibrationGroupsResult = await calibrationService.groups.getAll(selectedCycleId, 'completed');
      const groupIds = (calibrationGroupsResult.data || []).map(g => g.id);
      
      let calibrationEntries: any[] = [];
      if (groupIds.length > 0) {
        const calibEntriesResult = await calibrationService.entries.getByGroupIds(groupIds);
        calibrationEntries = calibEntriesResult.data || [];
      }

      // Get quarterly manager reviews for each employee
      const mgrReviewsPromises = allEmployees.map(emp => evaluationService.managerReviews.get(emp.id, selectedCycleId));
      const mgrReviewsResults = await Promise.all(mgrReviewsPromises);
      const allMgrReviews = mgrReviewsResults.flatMap(r => r.data || [])
        .filter((r: any) => r.status === 'submitted' || r.status === 'approved');

      // Build release entries from quarterly manager reviews
      const releaseEntries: ReleaseEntry[] = allMgrReviews.map((review: any) => {
        const emp = allEmployees.find(e => e.id === review.employee_id);
        const calibEntry = calibrationEntries.find(c => c.employee_id === review.employee_id);

        return {
          id: review.id,
          employee_id: review.employee_id,
          employee_name: emp ? `${emp.first_name} ${emp.last_name}` : 'Unknown',
          emp_id: emp?.emp_id || '',
          department: emp?.department || '',
          grade: emp?.grade || '',
          overall_rating: review.calculated_overall_rating,
          final_rating: calibEntry?.final_rating || review.calculated_overall_rating,
          status: review.status,
          released_at: review.approved_at, // Use approved_at as released
          acknowledged_at: null,
          selected: false
        };
      });

      setEntries(releaseEntries);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setEntries(prev => prev.map(e => 
      e.id === id ? { ...e, selected: !e.selected } : e
    ));
  };

  const toggleSelectAll = () => {
    const filteredEntries = getFilteredEntries();
    const unreleasedEntries = filteredEntries.filter(e => !e.released_at);
    const allSelected = unreleasedEntries.every(e => e.selected);
    
    setEntries(prev => prev.map(e => {
      if (!e.released_at && filteredEntries.some(f => f.id === e.id)) {
        return { ...e, selected: !allSelected };
      }
      return e;
    }));
  };

  const handleReleaseSelected = async () => {
    const selectedEntries = entries.filter(e => e.selected && !e.released_at);
    
    if (selectedEntries.length === 0) {
      toast({ title: 'No entries selected', variant: 'destructive' });
      return;
    }

    setReleasing(true);
    try {
      const now = new Date().toISOString();

      // Update quarterly manager reviews with approved status
      for (const entry of selectedEntries) {
        await evaluationService.managerReviews.upsert({ 
          employee_id: entry.employee_id,
          cycle_id: selectedCycleId,
          quarter: 1, // Default quarter - would need to be passed in the entry
          reviewer_id: '', // Would need the reviewer ID from entry
          status: 'approved'
        });

        // Create notification for the employee
        const empResult = await employeeService.getById(entry.employee_id);

        if (empResult.data?.user_id) {
          await notificationService.create({
            user_id: empResult.data.user_id,
            type: 'results_released',
            title: 'Performance Rating Released',
            message: 'Your performance rating has been released. Please review and acknowledge.',
            link: '/my-rating'
          });
        }
      }

      toast({ title: `Released ${selectedEntries.length} ratings` });
      setConfirmDialogOpen(false);
      fetchReleaseData();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setReleasing(false);
    }
  };

  const getFilteredEntries = () => {
    switch (filterStatus) {
      case 'pending':
        return entries.filter(e => !e.released_at);
      case 'released':
        return entries.filter(e => e.released_at && !e.acknowledged_at);
      case 'acknowledged':
        return entries.filter(e => e.acknowledged_at);
      default:
        return entries;
    }
  };

  const filteredEntries = getFilteredEntries();
  const selectedCount = entries.filter(e => e.selected && !e.released_at).length;
  const pendingCount = entries.filter(e => !e.released_at).length;
  const releasedCount = entries.filter(e => e.released_at && !e.acknowledged_at).length;
  const acknowledgedCount = entries.filter(e => e.acknowledged_at).length;
  const acknowledgmentRate = entries.filter(e => e.released_at).length > 0
    ? (acknowledgedCount / entries.filter(e => e.released_at).length) * 100
    : 0;

  if (loading && entries.length === 0) {
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Rating Release</h1>
            <p className="text-muted-foreground">
              Release final ratings to employees
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedCycleId} onValueChange={setSelectedCycleId}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select cycle" />
              </SelectTrigger>
              <SelectContent>
                {cycles.map(cycle => (
                  <SelectItem key={cycle.id} value={cycle.id}>
                    {cycle.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              onClick={() => setConfirmDialogOpen(true)}
              disabled={selectedCount === 0}
            >
              <Send className="mr-2 h-4 w-4" />
              Release Selected ({selectedCount})
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Release</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Released</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{releasedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acknowledged</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acknowledgedCount}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Acknowledgment Rate</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{acknowledgmentRate.toFixed(1)}%</div>
              <Progress value={acknowledgmentRate} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Filter and Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Employees ({filteredEntries.length})</CardTitle>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending Release</SelectItem>
                  <SelectItem value="released">Released (Awaiting)</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredEntries.filter(e => !e.released_at).every(e => e.selected)}
                      onCheckedChange={toggleSelectAll}
                      disabled={filteredEntries.filter(e => !e.released_at).length === 0}
                    />
                  </TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead className="text-center">Manager Rating</TableHead>
                  <TableHead className="text-center">Final Rating</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Released</TableHead>
                  <TableHead>Acknowledged</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map(entry => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <Checkbox
                          checked={entry.selected}
                          onCheckedChange={() => toggleSelect(entry.id)}
                          disabled={!!entry.released_at}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.employee_name}</p>
                          <p className="text-sm text-muted-foreground">{entry.emp_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>{entry.department}</TableCell>
                      <TableCell>{entry.grade}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{entry.overall_rating || '-'}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge>{entry.final_rating || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        {entry.acknowledged_at ? (
                          <Badge variant="outline" className="bg-green-50">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Acknowledged
                          </Badge>
                        ) : entry.released_at ? (
                          <Badge variant="secondary">
                            <Eye className="mr-1 h-3 w-3" />
                            Released
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.released_at 
                          ? new Date(entry.released_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.acknowledged_at 
                          ? new Date(entry.acknowledged_at).toLocaleDateString()
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Confirm Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Release Ratings</DialogTitle>
              <DialogDescription>
                You are about to release ratings to {selectedCount} employees. 
                They will receive a notification and can view their final rating.
              </DialogDescription>
            </DialogHeader>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This action cannot be undone. Employees will immediately see their ratings.
              </AlertDescription>
            </Alert>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReleaseSelected} disabled={releasing}>
                {releasing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Release {selectedCount} Ratings
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
