import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, ArrowLeft, Building2, Briefcase } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Department {
  id: string;
  name: string;
  created_at: string;
}

interface BusinessUnit {
  id: string;
  name: string;
  created_at?: string;
}

export default function DepartmentSettings() {
  const queryClient = useQueryClient();
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [businessUnitDialogOpen, setBusinessUnitDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [editingBusinessUnit, setEditingBusinessUnit] = useState<BusinessUnit | null>(null);
  const [departmentName, setDepartmentName] = useState('');
  const [businessUnitName, setBusinessUnitName] = useState('');

  const { data: departments = [], isLoading: loadingDepartments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => settingsService.departments.getAll().then(r => r.data || []),
  });

  const { data: businessUnits = [], isLoading: loadingBusinessUnits } = useQuery({
    queryKey: ['business_units'],
    queryFn: () => settingsService.businessUnits.getAll().then(r => r.data || []),
  });

  const createDepartmentMutation = useMutation({
    mutationFn: (name: string) => settingsService.departments.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDepartmentDialogOpen(false);
      setDepartmentName('');
      toast.success('Department created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create department: ' + error.message);
    },
  });

  const updateDepartmentMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      settingsService.departments.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      setDepartmentDialogOpen(false);
      setEditingDepartment(null);
      setDepartmentName('');
      toast.success('Department updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update department: ' + error.message);
    },
  });

  const deleteDepartmentMutation = useMutation({
    mutationFn: (id: string) => settingsService.departments.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast.success('Department deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete department: ' + error.message);
    },
  });

  const createBusinessUnitMutation = useMutation({
    mutationFn: (name: string) => settingsService.businessUnits.create({ name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_units'] });
      setBusinessUnitDialogOpen(false);
      setBusinessUnitName('');
      toast.success('Business unit created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create business unit: ' + error.message);
    },
  });

  const updateBusinessUnitMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => 
      settingsService.businessUnits.update(id, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_units'] });
      setBusinessUnitDialogOpen(false);
      setEditingBusinessUnit(null);
      setBusinessUnitName('');
      toast.success('Business unit updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update business unit: ' + error.message);
    },
  });

  const deleteBusinessUnitMutation = useMutation({
    mutationFn: (id: string) => settingsService.businessUnits.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['business_units'] });
      toast.success('Business unit deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete business unit: ' + error.message);
    },
  });

  const handleDepartmentSubmit = () => {
    if (!departmentName.trim()) return;
    if (editingDepartment) {
      updateDepartmentMutation.mutate({ id: editingDepartment.id, name: departmentName });
    } else {
      createDepartmentMutation.mutate(departmentName);
    }
  };

  const handleBusinessUnitSubmit = () => {
    if (!businessUnitName.trim()) return;
    if (editingBusinessUnit) {
      updateBusinessUnitMutation.mutate({ id: editingBusinessUnit.id, name: businessUnitName });
    } else {
      createBusinessUnitMutation.mutate(businessUnitName);
    }
  };

  const openEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setDepartmentName(dept.name);
    setDepartmentDialogOpen(true);
  };

  const openEditBusinessUnit = (bu: BusinessUnit) => {
    setEditingBusinessUnit(bu);
    setBusinessUnitName(bu.name);
    setBusinessUnitDialogOpen(true);
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
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Departments & Business Units</h1>
            <p className="text-muted-foreground">Manage organizational structure</p>
          </div>
        </div>

        <Tabs defaultValue="departments" className="space-y-4">
          <TabsList>
            <TabsTrigger value="departments" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Departments
            </TabsTrigger>
            <TabsTrigger value="business_units" className="flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Business Units
            </TabsTrigger>
          </TabsList>

          <TabsContent value="departments">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Departments</CardTitle>
                  <CardDescription>Manage department list</CardDescription>
                </div>
                <Dialog open={departmentDialogOpen} onOpenChange={(open) => {
                  setDepartmentDialogOpen(open);
                  if (!open) {
                    setEditingDepartment(null);
                    setDepartmentName('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Department
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingDepartment ? 'Edit Department' : 'Add Department'}</DialogTitle>
                      <DialogDescription>
                        {editingDepartment ? 'Update department name' : 'Enter a name for the new department'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="department-name">Name</Label>
                        <Input
                          id="department-name"
                          value={departmentName}
                          onChange={(e) => setDepartmentName(e.target.value)}
                          placeholder="e.g., Engineering"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleDepartmentSubmit}
                        disabled={!departmentName.trim() || createDepartmentMutation.isPending || updateDepartmentMutation.isPending}
                      >
                        {editingDepartment ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingDepartments ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : departments.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No departments yet</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {departments.map((dept) => (
                        <TableRow key={dept.id}>
                          <TableCell className="font-medium">{dept.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditDepartment(dept)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Department</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{dept.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteDepartmentMutation.mutate(dept.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business_units">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Business Units</CardTitle>
                  <CardDescription>Manage business unit list</CardDescription>
                </div>
                <Dialog open={businessUnitDialogOpen} onOpenChange={(open) => {
                  setBusinessUnitDialogOpen(open);
                  if (!open) {
                    setEditingBusinessUnit(null);
                    setBusinessUnitName('');
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Business Unit
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editingBusinessUnit ? 'Edit Business Unit' : 'Add Business Unit'}</DialogTitle>
                      <DialogDescription>
                        {editingBusinessUnit ? 'Update business unit name' : 'Enter a name for the new business unit'}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="bu-name">Name</Label>
                        <Input
                          id="bu-name"
                          value={businessUnitName}
                          onChange={(e) => setBusinessUnitName(e.target.value)}
                          placeholder="e.g., North America"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        onClick={handleBusinessUnitSubmit}
                        disabled={!businessUnitName.trim() || createBusinessUnitMutation.isPending || updateBusinessUnitMutation.isPending}
                      >
                        {editingBusinessUnit ? 'Update' : 'Create'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {loadingBusinessUnits ? (
                  <div className="text-center py-4 text-muted-foreground">Loading...</div>
                ) : businessUnits.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No business units yet</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-24">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {businessUnits.map((bu) => (
                        <TableRow key={bu.id}>
                          <TableCell className="font-medium">{bu.name}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openEditBusinessUnit(bu)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Business Unit</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{bu.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBusinessUnitMutation.mutate(bu.id)}>
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
