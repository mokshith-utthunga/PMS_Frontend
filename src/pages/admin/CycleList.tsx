import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cycleService } from '@/services';
import { Link } from 'react-router-dom';
import { 
  Plus, 
  Calendar, 
  ArrowLeft, 
  Loader2,
  MoreHorizontal,
  Play,
  Pause,
  Archive,
  Pencil
} from 'lucide-react';

interface PerformanceCycle {
  id: string;
  name: string;
  description: string | null;
  year: number;
  status: string;
  goal_submission_start: string;
  goal_submission_end: string;
  goal_approval_end: string;
  self_evaluation_start: string | null;
  self_evaluation_end: string | null;
  manager_evaluation_start: string;
  manager_evaluation_end: string;
  calibration_start: string;
  calibration_end: string;
  release_date: string;
  created_at: string;
  applicable_departments: string[] | null;
  applicable_business_units: string[] | null;
  q1_self_review_start: string | null;
  q1_self_review_end: string | null;
  q2_self_review_start: string | null;
  q2_self_review_end: string | null;
  q3_self_review_start: string | null;
  q3_self_review_end: string | null;
  q4_self_review_start: string | null;
  q4_self_review_end: string | null;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  active: 'default',
  closed: 'outline',
  archived: 'destructive'
};

export default function CycleList() {
  const [cycles, setCycles] = useState<PerformanceCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCycles();
  }, []);

  const fetchCycles = async () => {
    try {
      const result = await cycleService.getList();
      setCycles(result.data || []);
    } catch (error) {
      console.error('Error fetching cycles:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      if (newStatus === 'active') {
        const activeCycle = cycles.find(c => c.status === 'active' && c.id !== id);
        if (activeCycle) {
          toast({
            title: 'Cannot activate',
            description: 'Another cycle is already active. Please close it first.',
            variant: 'destructive'
          });
          return;
        }
      }

      await cycleService.update(id, { status: newStatus });

      toast({ title: `Cycle ${newStatus}` });
      fetchCycles();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const getApplicableTeamsDisplay = (cycle: PerformanceCycle) => {
    const depts = cycle.applicable_departments;
    const bus = cycle.applicable_business_units;
    
    if (!depts && !bus) {
      return <span className="text-muted-foreground">All Teams</span>;
    }

    const items: string[] = [];
    if (depts && depts.length > 0) {
      items.push(...depts);
    }
    if (bus && bus.length > 0) {
      items.push(...bus);
    }

    if (items.length <= 2) {
      return items.join(', ');
    }
    return (
      <span title={items.join(', ')}>
        {items.slice(0, 2).join(', ')} +{items.length - 2}
      </span>
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Performance Cycles</h1>
            <p className="text-muted-foreground">
              Manage review cycles and their phases
            </p>
          </div>
          <Link to="/admin/cycles/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Cycle
            </Button>
          </Link>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : cycles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No performance cycles</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first performance review cycle
                </p>
                <Link to="/admin/cycles/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Cycle
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cycle Name</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Applicable Teams</TableHead>
                      <TableHead>Goal Setting</TableHead>
                      <TableHead>Quarterly Reviews</TableHead>
                      <TableHead>Manager Eval</TableHead>
                      <TableHead>Release</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cycles.map((cycle) => (
                      <TableRow key={cycle.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{cycle.name}</p>
                            {cycle.description && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {cycle.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{cycle.year}</TableCell>
                        <TableCell>
                          <Badge variant={statusColors[cycle.status]}>
                            {cycle.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {getApplicableTeamsDisplay(cycle)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(cycle.goal_submission_start)} - {formatDate(cycle.goal_submission_end)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {cycle.q1_self_review_start ? (
                            <span title={`Q1-Q4 reviews configured`}>Q1-Q4 ✓</span>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(cycle.manager_evaluation_start)} - {formatDate(cycle.manager_evaluation_end)}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(cycle.release_date)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={`/admin/cycles/${cycle.id}/edit`}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </Link>
                              </DropdownMenuItem>
                              {cycle.status === 'draft' && (
                                <DropdownMenuItem onClick={() => updateStatus(cycle.id, 'active')}>
                                  <Play className="mr-2 h-4 w-4" />
                                  Activate
                                </DropdownMenuItem>
                              )}
                              {cycle.status === 'active' && (
                                <DropdownMenuItem onClick={() => updateStatus(cycle.id, 'closed')}>
                                  <Pause className="mr-2 h-4 w-4" />
                                  Close
                                </DropdownMenuItem>
                              )}
                              {cycle.status === 'closed' && (
                                <DropdownMenuItem onClick={() => updateStatus(cycle.id, 'archived')}>
                                  <Archive className="mr-2 h-4 w-4" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
