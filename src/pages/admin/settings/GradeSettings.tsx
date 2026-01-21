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
import { Plus, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';

interface Grade {
  id: string;
  name: string;
  level: number | null;
  created_at: string;
}

export default function GradeSettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState('');

  const { data: grades = [], isLoading } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const result = await settingsService.grades.getAll();
      return result.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, level }: { name: string; level: number | null }) => {
      await settingsService.grades.create({ name, level: level ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Grade created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create grade: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, level }: { id: string; name: string; level: number | null }) => {
      await settingsService.grades.update(id, { name, level: level ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Grade updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update grade: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await settingsService.grades.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['grades'] });
      toast.success('Grade deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete grade: ' + error.message);
    },
  });

  const resetForm = () => {
    setEditing(null);
    setName('');
    setLevel('');
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const levelNum = level ? parseInt(level, 10) : null;
    if (editing) {
      updateMutation.mutate({ id: editing.id, name, level: levelNum });
    } else {
      createMutation.mutate({ name, level: levelNum });
    }
  };

  const openEdit = (grade: Grade) => {
    setEditing(grade);
    setName(grade.name);
    setLevel(grade.level?.toString() || '');
    setDialogOpen(true);
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
            <h1 className="text-3xl font-bold tracking-tight">Grades</h1>
            <p className="text-muted-foreground">Manage employee grade levels</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Grade Levels</CardTitle>
              <CardDescription>Define the organizational grade hierarchy</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Grade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Grade' : 'Add Grade'}</DialogTitle>
                  <DialogDescription>
                    {editing ? 'Update grade details' : 'Enter details for the new grade'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="grade-name">Name</Label>
                    <Input
                      id="grade-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Senior Engineer"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="grade-level">Level (optional)</Label>
                    <Input
                      id="grade-level"
                      type="number"
                      value={level}
                      onChange={(e) => setLevel(e.target.value)}
                      placeholder="e.g., 5"
                    />
                    <p className="text-xs text-muted-foreground">Lower numbers indicate higher seniority</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleSubmit}
                    disabled={!name.trim() || createMutation.isPending || updateMutation.isPending}
                  >
                    {editing ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-4 text-muted-foreground">Loading...</div>
            ) : grades.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No grades yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Level</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>{grade.level ?? '-'}</TableCell>
                      <TableCell className="font-medium">{grade.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(grade)}>
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
                                <AlertDialogTitle>Delete Grade</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{grade.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(grade.id)}>
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
      </div>
    </MainLayout>
  );
}
