// Transition Management Page - HR/Admin interface for managing mid-quarter transitions
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { employeeService, transitionService } from '@/services';
import { useTransition } from '@/hooks';
import { getPeriodLabel, getPeriodBadgeVariant, formatPeriodDateRange } from '@/utils/periodHelpers';
import { formatDateShort } from '@/utils/quarterHelpers';
import { 
  Plus, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ArrowRight,
  Calendar,
  User,
  Building2,
  Briefcase,
  TrendingUp,
  Search,
  Loader2,
  X
} from 'lucide-react';
import type { EmployeeQuarterTransition, CreateTransitionData, TransitionType } from '@/services/transition.service';
import type { Employee } from '@/types';

export default function TransitionManagement() {
  const { activeCycle } = useActiveCycle();
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [transitions, setTransitions] = useState<EmployeeQuarterTransition[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<CreateTransitionData>({
    cycle_id: activeCycle?.id || '',
    quarter: 1,
    transition_type: 'promotion',
    transition_date: new Date().toISOString().split('T')[0],
    new_manager_id: null,
    new_department: null,
    new_grade: null,
    new_project: null,
  });
  
  // Debounced search for employees
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    debounceTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await employeeService.search(searchQuery, 10);
        setSearchResults(result.data || []);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to search employees',
          variant: 'destructive',
        });
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery, toast]);
  
  // Update formData when activeCycle changes
  useEffect(() => {
    if (activeCycle?.id) {
      setFormData(prev => ({ ...prev, cycle_id: activeCycle.id }));
    }
  }, [activeCycle]);
  
  // Handle employee selection
  const handleSelectEmployee = useCallback((employee: Employee) => {
    setSelectedEmployeeId(employee.id);
    setSelectedEmployeeData(employee); // Set employee data immediately
    setSearchQuery(`${employee.full_name} (${employee.emp_code || employee.email})`);
    setSearchPopoverOpen(false);
    setSearchResults([]);
  }, []);
  
  // Clear selection
  const handleClearSelection = useCallback(() => {
    setSelectedEmployeeId('');
    setSelectedEmployeeData(null);
    setSearchQuery('');
    setSearchResults([]);
  }, []);
  
  // Fetch transitions when employee is selected
  const { transition: selectedTransition, transitions: allTransitions, loading: transitionsLoading, refetch } = useTransition({
    employeeId: selectedEmployeeId || undefined,
    cycleId: activeCycle?.id,
    enabled: !!selectedEmployeeId && !!activeCycle,
  });
  
  useEffect(() => {
    // Always update transitions, even if empty array
    setTransitions(allTransitions || []);
  }, [allTransitions]);
  
  const handleCreateTransition = useCallback(async () => {
    if (!selectedEmployeeId) {
      toast({
        title: 'Error',
        description: 'Please select an employee',
        variant: 'destructive',
      });
      return;
    }
    
    if (!formData.cycle_id || !formData.transition_date) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setCreating(true);
      await transitionService.create(selectedEmployeeId, formData);
      toast({
        title: 'Success',
        description: 'Transition created successfully',
      });
      setDialogOpen(false);
      setFormData({
        cycle_id: activeCycle?.id || '',
        quarter: 1,
        transition_type: 'promotion',
        transition_date: new Date().toISOString().split('T')[0],
        new_manager_id: null,
        new_department: null,
        new_grade: null,
        new_project: null,
      });
      // Refetch transitions after a short delay to ensure backend has processed
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create transition',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  }, [selectedEmployeeId, formData, activeCycle, toast, refetch]);
  
  const getStatusBadge = (transition: EmployeeQuarterTransition) => {
    if (transition.old_period_closed && transition.old_period_reviewed && transition.new_period_goals_set && transition.new_period_approved) {
      return <Badge variant="default" className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Complete</Badge>;
    }
    if (transition.old_period_closed && transition.old_period_reviewed) {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />In Progress</Badge>;
    }
    return <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
  };
  
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<Employee | null>(null);
  
  // Fetch selected employee details (only if not already set and ID changed)
  useEffect(() => {
    const fetchSelectedEmployee = async () => {
      if (!selectedEmployeeId) {
        setSelectedEmployeeData(null);
        return;
      }
      
      // If we already have the correct employee data, don't refetch
      if (selectedEmployeeData?.id === selectedEmployeeId) {
        return;
      }
      
      // Check if already in search results
      const found = searchResults.find(e => e.id === selectedEmployeeId);
      if (found) {
        setSelectedEmployeeData(found);
        return;
      }
      
      // Fetch from API if not in search results
      try {
        const result = await employeeService.getById(selectedEmployeeId);
        if (result.data) {
          setSelectedEmployeeData(result.data);
        }
      } catch (error) {
        // Employee not found or error - ignore
        setSelectedEmployeeData(null);
      }
    };
    fetchSelectedEmployee();
  }, [selectedEmployeeId, searchResults]);
  
  const selectedEmployee = selectedEmployeeData;
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transition Management</h1>
          <p className="text-muted-foreground">Manage mid-quarter employee transitions</p>
        </div>
        
        {!activeCycle && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No active performance cycle. Please create or activate a cycle first.</AlertDescription>
          </Alert>
        )}
        
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Employee Transitions</CardTitle>
                <CardDescription>Select an employee to view and manage their transitions</CardDescription>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!activeCycle || !selectedEmployeeId}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Transition
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Transition</DialogTitle>
                    <DialogDescription>
                      Create a mid-quarter transition for {selectedEmployee?.full_name || 'selected employee'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cycle *</Label>
                        <Input value={activeCycle?.name || ''} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Quarter *</Label>
                        <Select
                          value={formData.quarter.toString()}
                          onValueChange={(value) => setFormData({ ...formData, quarter: parseInt(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Q1</SelectItem>
                            <SelectItem value="2">Q2</SelectItem>
                            <SelectItem value="3">Q3</SelectItem>
                            <SelectItem value="4">Q4</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Transition Type *</Label>
                      <Select
                        value={formData.transition_type}
                        onValueChange={(value) => setFormData({ ...formData, transition_type: value as TransitionType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="promotion">Promotion</SelectItem>
                          <SelectItem value="project_change">Project Change</SelectItem>
                          <SelectItem value="role_change">Role Change</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Transition Date *</Label>
                      <Input
                        type="date"
                        value={formData.transition_date}
                        onChange={(e) => setFormData({ ...formData, transition_date: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>New Manager</Label>
                      <Select
                        value={formData.new_manager_id || undefined}
                        onValueChange={(value) => setFormData({ ...formData, new_manager_id: value === 'none' ? null : value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select new manager (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {searchResults.length > 0 ? (
                            searchResults.map(emp => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.full_name}</SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              Search for an employee first
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        You can search for managers in the employee search above
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>New Department</Label>
                        <Input
                          value={formData.new_department || ''}
                          onChange={(e) => setFormData({ ...formData, new_department: e.target.value || null })}
                          placeholder="Enter new department"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>New Grade</Label>
                        <Input
                          value={formData.new_grade || ''}
                          onChange={(e) => setFormData({ ...formData, new_grade: e.target.value || null })}
                          placeholder="Enter new grade"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>New Project</Label>
                      <Input
                        value={formData.new_project || ''}
                        onChange={(e) => setFormData({ ...formData, new_project: e.target.value || null })}
                        placeholder="Enter new project"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTransition} disabled={creating}>
                      {creating ? 'Creating...' : 'Create Transition'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Search Employee</Label>
                <Popover open={searchPopoverOpen} onOpenChange={setSearchPopoverOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by employee code or email..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          if (e.target.value.length >= 2) {
                            setSearchPopoverOpen(true);
                          } else {
                            setSearchPopoverOpen(false);
                          }
                        }}
                        onFocus={() => {
                          if (searchQuery.length >= 2) {
                            setSearchPopoverOpen(true);
                          }
                        }}
                        className="pl-9 pr-10"
                      />
                      {selectedEmployeeId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearSelection();
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-2">
                      {searching && (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                        </div>
                      )}
                      {!searching && searchQuery.length < 2 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          Type at least 2 characters to search
                        </div>
                      )}
                      {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No employees found
                        </div>
                      )}
                      {!searching && searchResults.length > 0 && (
                        <div className="max-h-60 overflow-y-auto space-y-1">
                          {searchResults.map((employee) => (
                            <button
                              key={employee.id}
                              type="button"
                              onClick={() => handleSelectEmployee(employee)}
                              className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors ${
                                selectedEmployeeId === employee.id ? 'bg-accent' : ''
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="font-medium">{employee.full_name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {employee.emp_code && <span>{employee.emp_code}</span>}
                                    {employee.emp_code && employee.email && <span> • </span>}
                                    {employee.email && <span>{employee.email}</span>}
                                  </div>
                                </div>
                                {selectedEmployeeId === employee.id && (
                                  <CheckCircle2 className="h-4 w-4 text-primary" />
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
                {selectedEmployeeId && (
                  <div className="text-sm text-muted-foreground">
                    Selected: {selectedEmployee?.full_name || 'Loading...'}
                  </div>
                )}
              </div>
              
              {transitionsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading transitions...</div>
                </div>
              ) : transitions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="font-semibold text-lg">No Transitions</h3>
                  <p className="text-muted-foreground">
                    {selectedEmployeeId 
                      ? `${selectedEmployee?.full_name || 'This employee'} has no transitions`
                      : 'Select an employee to view transitions'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Quarter</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Transition Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transitions.map((transition) => (
                      <TableRow key={transition.id}>
                        <TableCell>Q{transition.quarter}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {transition.transition_type === 'promotion' && <TrendingUp className="h-3 w-3 mr-1" />}
                            {transition.transition_type === 'project_change' && <Briefcase className="h-3 w-3 mr-1" />}
                            {transition.transition_type === 'role_change' && <User className="h-3 w-3 mr-1" />}
                            {transition.transition_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            {formatDateShort(new Date(transition.transition_date))}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(transition)}</TableCell>
                        <TableCell>
                          <div className="space-y-1 text-sm">
                            {transition.old_manager_name && transition.new_manager_name && (
                              <div className="flex items-center gap-2">
                                <User className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{transition.old_manager_name}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{transition.new_manager_name}</span>
                              </div>
                            )}
                            {transition.old_department && transition.new_department && (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-3 w-3 text-muted-foreground" />
                                <span className="text-muted-foreground">{transition.old_department}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{transition.new_department}</span>
                              </div>
                            )}
                            {transition.old_grade && transition.new_grade && (
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">{transition.old_grade}</span>
                                <ArrowRight className="h-3 w-3" />
                                <span>{transition.new_grade}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
