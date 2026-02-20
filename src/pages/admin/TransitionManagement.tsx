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
import { useAuth } from '@/contexts/AuthContext';
import { useActiveCycle } from '@/contexts/ActiveCycleContext';
import { employeeService, transitionService } from '@/services';
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
  X,
  Edit,
  Pencil
} from 'lucide-react';
import type { EmployeeQuarterTransition, CreateTransitionData, UpdateTransitionData, TransitionType } from '@/services/transition.service';
import type { Employee } from '@/types';

export default function TransitionManagement() {
  const { activeCycle } = useActiveCycle();
  const { toast } = useToast();
  const { hasAnyRole } = useAuth();
  const isHRAdmin = hasAnyRole(['hr_admin', 'hrbp', 'system_admin']);
  
  const [transitions, setTransitions] = useState<EmployeeQuarterTransition[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTransition, setEditingTransition] = useState<EmployeeQuarterTransition | null>(null);
  
  // Employee search state for create
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Employee[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [selectedEmployeeData, setSelectedEmployeeData] = useState<Employee | null>(null);
  const [searchPopoverOpen, setSearchPopoverOpen] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Manager search state for create
  const [createManagerSearchQuery, setCreateManagerSearchQuery] = useState<string>('');
  const [createManagerSearchResults, setCreateManagerSearchResults] = useState<Employee[]>([]);
  const [createManagerSearching, setCreateManagerSearching] = useState(false);
  const [createManagerPopoverOpen, setCreateManagerPopoverOpen] = useState(false);
  const [createSelectedManager, setCreateSelectedManager] = useState<Employee | null>(null);
  const createManagerDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Manager search state for edit
  const [editManagerSearchQuery, setEditManagerSearchQuery] = useState<string>('');
  const [editManagerSearchResults, setEditManagerSearchResults] = useState<Employee[]>([]);
  const [editManagerSearching, setEditManagerSearching] = useState(false);
  const [editManagerPopoverOpen, setEditManagerPopoverOpen] = useState(false);
  const [editSelectedManager, setEditSelectedManager] = useState<Employee | null>(null);
  const editManagerDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Form state for create
  const [createFormData, setCreateFormData] = useState<CreateTransitionData>({
    cycle_id: activeCycle?.id || '',
    quarter: 1,
    transition_type: 'promotion',
    transition_date: new Date().toISOString().split('T')[0],
    new_manager_id: null,
    new_department: null,
    new_grade: null,
    new_project: null,
  });
  
  // Form state for edit
  const [editFormData, setEditFormData] = useState<UpdateTransitionData>({
    transition_type: 'promotion',
    transition_date: '',
    new_manager_id: null,
    new_department: null,
    new_grade: null,
    new_project: null,
  });
  
  // Fetch all transitions
  const fetchTransitions = useCallback(async () => {
    if (!activeCycle?.id) {
      setTransitions([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const result = await transitionService.getAll(activeCycle.id, null);
      setTransitions(result || []);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load transitions',
        variant: 'destructive',
      });
      setTransitions([]);
    } finally {
      setLoading(false);
    }
  }, [activeCycle?.id, toast]);
  
  useEffect(() => {
    fetchTransitions();
  }, [fetchTransitions]);
  
  // Update formData when activeCycle changes
  useEffect(() => {
    if (activeCycle?.id) {
      setCreateFormData(prev => ({ ...prev, cycle_id: activeCycle.id }));
    }
  }, [activeCycle]);
  
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
  
  // Debounced search for managers (create)
  useEffect(() => {
    if (createManagerDebounceTimer.current) {
      clearTimeout(createManagerDebounceTimer.current);
    }

    if (createManagerSearchQuery.length < 2) {
      setCreateManagerSearchResults([]);
      return;
    }

    createManagerDebounceTimer.current = setTimeout(async () => {
      setCreateManagerSearching(true);
      try {
        const result = await employeeService.search(createManagerSearchQuery, 10);
        setCreateManagerSearchResults(result.data || []);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to search managers',
          variant: 'destructive',
        });
        setCreateManagerSearchResults([]);
      } finally {
        setCreateManagerSearching(false);
      }
    }, 300);

    return () => {
      if (createManagerDebounceTimer.current) {
        clearTimeout(createManagerDebounceTimer.current);
      }
    };
  }, [createManagerSearchQuery, toast]);
  
  // Debounced search for managers (edit)
  useEffect(() => {
    if (editManagerDebounceTimer.current) {
      clearTimeout(editManagerDebounceTimer.current);
    }

    if (editManagerSearchQuery.length < 2) {
      setEditManagerSearchResults([]);
      return;
    }

    editManagerDebounceTimer.current = setTimeout(async () => {
      setEditManagerSearching(true);
      try {
        const result = await employeeService.search(editManagerSearchQuery, 10);
        setEditManagerSearchResults(result.data || []);
      } catch (error: any) {
        toast({
          title: 'Error',
          description: error.message || 'Failed to search managers',
          variant: 'destructive',
        });
        setEditManagerSearchResults([]);
      } finally {
        setEditManagerSearching(false);
      }
    }, 300);

    return () => {
      if (editManagerDebounceTimer.current) {
        clearTimeout(editManagerDebounceTimer.current);
      }
    };
  }, [editManagerSearchQuery, toast]);
  
  // Handle employee selection
  const handleSelectEmployee = useCallback((employee: Employee) => {
    setSelectedEmployeeId(employee.id);
    setSelectedEmployeeData(employee);
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
  
  // Fetch selected employee details
  useEffect(() => {
    const fetchSelectedEmployee = async () => {
      if (!selectedEmployeeId) {
        setSelectedEmployeeData(null);
        return;
      }
      
      if (selectedEmployeeData?.id === selectedEmployeeId) {
        return;
      }
      
      const found = searchResults.find(e => e.id === selectedEmployeeId);
      if (found) {
        setSelectedEmployeeData(found);
        return;
      }
      
      try {
        const result = await employeeService.getById(selectedEmployeeId);
        if (result.data) {
          setSelectedEmployeeData(result.data);
        }
      } catch (error) {
        setSelectedEmployeeData(null);
      }
    };
    fetchSelectedEmployee();
  }, [selectedEmployeeId, searchResults]);
  
  const handleCreateTransition = useCallback(async () => {
    if (!selectedEmployeeId) {
      toast({
        title: 'Error',
        description: 'Please select an employee',
        variant: 'destructive',
      });
      return;
    }
    
    if (!createFormData.cycle_id || !createFormData.transition_date) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setCreating(true);
      await transitionService.create(selectedEmployeeId, createFormData);
      toast({
        title: 'Success',
        description: 'Transition created successfully',
      });
      setCreateDialogOpen(false);
      setCreateFormData({
        cycle_id: activeCycle?.id || '',
        quarter: 1,
        transition_type: 'promotion',
        transition_date: new Date().toISOString().split('T')[0],
        new_manager_id: null,
        new_department: null,
        new_grade: null,
        new_project: null,
      });
      setCreateSelectedManager(null);
      setCreateManagerSearchQuery('');
      setCreateManagerSearchResults([]);
      handleClearSelection();
      setTimeout(() => {
        fetchTransitions();
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
  }, [selectedEmployeeId, createFormData, activeCycle, toast, fetchTransitions, handleClearSelection]);
  
  // Handle edit transition
  const handleEditTransition = useCallback((transition: EmployeeQuarterTransition) => {
    setEditingTransition(transition);
    setEditFormData({
      transition_type: transition.transition_type,
      transition_date: transition.transition_date.split('T')[0],
      new_manager_id: transition.new_manager_id,
      new_department: transition.new_department,
      new_grade: transition.new_grade,
      new_project: transition.new_project,
    });
    setEditDialogOpen(true);
    // Reset manager search
    setEditSelectedManager(null);
    setEditManagerSearchQuery('');
    setEditManagerSearchResults([]);
  }, []);
  
  // Fetch manager details for edit form
  useEffect(() => {
    const fetchManagerForEdit = async () => {
      if (editDialogOpen && editingTransition?.new_manager_id && !editSelectedManager) {
        try {
          const result = await employeeService.getById(editingTransition.new_manager_id);
          if (result.data) {
            setEditSelectedManager(result.data);
            setEditManagerSearchQuery(`${result.data.full_name} (${result.data.emp_code || result.data.email})`);
          }
        } catch (error) {
          // Manager not found or error - ignore
        }
      }
    };
    fetchManagerForEdit();
  }, [editDialogOpen, editingTransition?.new_manager_id]);
  
  const handleUpdateTransition = useCallback(async () => {
    if (!editingTransition) return;
    
    if (!editFormData.transition_date) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setUpdating(true);
      await transitionService.update(editingTransition.employee_id, editingTransition.id, editFormData);
      toast({
        title: 'Success',
        description: 'Transition updated successfully',
      });
      setEditDialogOpen(false);
      setEditingTransition(null);
      setTimeout(() => {
        fetchTransitions();
      }, 500);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update transition',
        variant: 'destructive',
      });
    } finally {
      setUpdating(false);
    }
  }, [editingTransition, editFormData, toast, fetchTransitions]);
  
  // Filter transitions by search (if needed in future)
  const filteredTransitions = useMemo(() => {
    return transitions;
  }, [transitions]);
  
  const renderManagerSearch = (
    value: string | null,
    onChange: (managerId: string | null) => void,
    searchQuery: string,
    setSearchQuery: (query: string) => void,
    selectedManager: Employee | null,
    setSelectedManager: (manager: Employee | null) => void,
    popoverOpen: boolean,
    setPopoverOpen: (open: boolean) => void,
    searching: boolean,
    searchResults: Employee[]
  ) => (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email or employee code..."
            value={selectedManager ? `${selectedManager.full_name} (${selectedManager.emp_code || selectedManager.email})` : searchQuery}
            onChange={(e) => {
              const val = e.target.value;
              setSearchQuery(val);
              if (val.length >= 2) {
                setPopoverOpen(true);
              } else {
                setPopoverOpen(false);
                setSelectedManager(null);
                onChange(null);
              }
            }}
            onFocus={() => {
              if (searchQuery.length >= 2 || searchResults.length > 0) {
                setPopoverOpen(true);
              }
            }}
            className="pl-9 pr-10"
          />
          {selectedManager && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedManager(null);
                setSearchQuery('');
                onChange(null);
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
              Type at least 2 characters to search by email or employee code
            </div>
          )}
          {!searching && searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No managers found
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div className="max-h-60 overflow-y-auto space-y-1">
              <button
                type="button"
                onClick={() => {
                  setSelectedManager(null);
                  setSearchQuery('');
                  onChange(null);
                  setPopoverOpen(false);
                }}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
              >
                <div className="font-medium text-muted-foreground">None</div>
              </button>
              {searchResults.map((manager) => (
                <button
                  key={manager.id}
                  type="button"
                  onClick={() => {
                    setSelectedManager(manager);
                    onChange(manager.id);
                    setPopoverOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors ${
                    value === manager.id ? 'bg-accent' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{manager.full_name}</div>
                      <div className="text-sm text-muted-foreground">
                        {manager.emp_code && <span>{manager.emp_code}</span>}
                        {manager.emp_code && manager.email && <span> • </span>}
                        {manager.email && <span>{manager.email}</span>}
                      </div>
                    </div>
                    {value === manager.id && (
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
  );
  
  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transition Management</h1>
          <p className="text-muted-foreground">View and manage all employee transitions</p>
        </div>
        
        {!activeCycle && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No active performance cycle. Please create or activate a cycle first.</AlertDescription>
          </Alert>
        )}
        
        <Card className="">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Transitions</CardTitle>
                <CardDescription>View and manage transitions for all employees</CardDescription>
              </div>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button disabled={!activeCycle}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Transition
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create Transition</DialogTitle>
                    <DialogDescription>
                      Create a mid-quarter transition for an employee
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Employee *</Label>
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
                          Selected: {selectedEmployeeData?.full_name || 'Loading...'}
                        </div>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Cycle *</Label>
                        <Input value={activeCycle?.name || ''} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Quarter *</Label>
                        <Select
                          value={createFormData.quarter.toString()}
                          onValueChange={(value) => setCreateFormData({ ...createFormData, quarter: parseInt(value) })}
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
                        value={createFormData.transition_type}
                        onValueChange={(value) => setCreateFormData({ ...createFormData, transition_type: value as TransitionType })}
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
                        value={createFormData.transition_date}
                        onChange={(e) => setCreateFormData({ ...createFormData, transition_date: e.target.value })}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>New Manager</Label>
                      {renderManagerSearch(
                        createFormData.new_manager_id,
                        (id) => setCreateFormData({ ...createFormData, new_manager_id: id }),
                        createManagerSearchQuery,
                        setCreateManagerSearchQuery,
                        createSelectedManager,
                        setCreateSelectedManager,
                        createManagerPopoverOpen,
                        setCreateManagerPopoverOpen,
                        createManagerSearching,
                        createManagerSearchResults
                      )}
                      <p className="text-xs text-muted-foreground">
                        Search by email or employee code to find the new manager
                      </p>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>New Department</Label>
                        <Input
                          value={createFormData.new_department || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, new_department: e.target.value || null })}
                          placeholder="Enter new department"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>New Grade</Label>
                        <Input
                          value={createFormData.new_grade || ''}
                          onChange={(e) => setCreateFormData({ ...createFormData, new_grade: e.target.value || null })}
                          placeholder="Enter new grade"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>New Project</Label>
                      <Input
                        value={createFormData.new_project || ''}
                        onChange={(e) => setCreateFormData({ ...createFormData, new_project: e.target.value || null })}
                        placeholder="Enter new project"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreateTransition} disabled={creating || !selectedEmployeeId}>
                      {creating ? 'Creating...' : 'Create Transition'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading transitions...</span>
              </div>
            ) : filteredTransitions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No Transitions</h3>
                <p className="text-muted-foreground">
                  No transitions found for the active cycle
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee Name</TableHead>
                    <TableHead>Employee Code</TableHead>
                    <TableHead>Quarter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Transition Date</TableHead>
                    <TableHead>Details</TableHead>
                    {isHRAdmin && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransitions.map((transition) => (
                    <TableRow key={transition.id}>
                      <TableCell className="font-medium">{transition.name || 'N/A'}</TableCell>
                      <TableCell>{transition.emp_code || 'N/A'}</TableCell>
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
                      {isHRAdmin && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTransition(transition)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Edit
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        
        {/* Edit Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Transition</DialogTitle>
              <DialogDescription>
                Edit transition for {editingTransition?.name || 'employee'}
              </DialogDescription>
            </DialogHeader>
            {editingTransition && (
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Input value={editingTransition.name || 'N/A'} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>Quarter</Label>
                    <Input value={`Q${editingTransition.quarter}`} disabled />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Transition Type *</Label>
                  <Select
                    value={editFormData.transition_type}
                    onValueChange={(value) => setEditFormData({ ...editFormData, transition_type: value as TransitionType })}
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
                    value={editFormData.transition_date}
                    onChange={(e) => setEditFormData({ ...editFormData, transition_date: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>New Manager</Label>
                  {renderManagerSearch(
                    editFormData.new_manager_id,
                    (id) => setEditFormData({ ...editFormData, new_manager_id: id }),
                    editManagerSearchQuery,
                    setEditManagerSearchQuery,
                    editSelectedManager,
                    setEditSelectedManager,
                    editManagerPopoverOpen,
                    setEditManagerPopoverOpen,
                    editManagerSearching,
                    editManagerSearchResults
                  )}
                  <p className="text-xs text-muted-foreground">
                    Search by email or employee code to find the new manager
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>New Department</Label>
                    <Input
                      value={editFormData.new_department || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, new_department: e.target.value || null })}
                      placeholder="Enter new department"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>New Grade</Label>
                    <Input
                      value={editFormData.new_grade || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, new_grade: e.target.value || null })}
                      placeholder="Enter new grade"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>New Project</Label>
                  <Input
                    value={editFormData.new_project || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, new_project: e.target.value || null })}
                    placeholder="Enter new project"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateTransition} disabled={updating}>
                {updating ? 'Updating...' : 'Update Transition'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
