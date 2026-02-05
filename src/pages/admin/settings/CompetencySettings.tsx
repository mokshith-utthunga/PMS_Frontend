import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsService } from '@/services';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
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

interface Competency {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  is_active: boolean;
  created_at: string;
}

export default function CompetencySettings() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Competency | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);

  const { data: competencies = [], isLoading } = useQuery({
    queryKey: ['competencies'],
    queryFn: async () => {
      const result = await settingsService.competencies.getAll();
      return result.data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string | null; category: string | null; is_active: boolean }) => {
      await settingsService.competencies.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Competency created successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to create competency: ' + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string | null; category: string | null; is_active: boolean }) => {
      const { id, ...rest } = data;
      await settingsService.competencies.update(id, rest);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Competency updated successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to update competency: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await settingsService.competencies.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['competencies'] });
      toast.success('Competency deleted successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to delete competency: ' + error.message);
    },
  });

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setCategory('');
    setIsActive(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    const data = {
      name,
      description: description.trim() || null,
      category: category.trim() || null,
      is_active: isActive,
    };
    if (editing) {
      updateMutation.mutate({ id: editing.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const openEdit = (competency: Competency) => {
    setEditing(competency);
    setName(competency.name);
    setDescription(competency.description || '');
    setCategory(competency.category || '');
    setIsActive(competency.is_active);
    setDialogOpen(true);
  };

  const categories = [...new Set(competencies.map(c => c.category).filter(Boolean))];

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
            <h1 className="text-3xl font-bold tracking-tight">Competencies</h1>
            <p className="text-muted-foreground">Define the competency framework</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Competency Framework</CardTitle>
              <CardDescription>Define competencies for employee assessment</CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Competency
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editing ? 'Edit Competency' : 'Add Competency'}</DialogTitle>
                  <DialogDescription>
                    {editing ? 'Update competency details' : 'Define a new competency for assessment'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="comp-name">Name</Label>
                    <Input
                      id="comp-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Leadership"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-category">Category</Label>
                    <Input
                      id="comp-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      placeholder="e.g., Core, Technical, Leadership"
                      list="categories"
                    />
                    <datalist id="categories">
                      {categories.map(cat => (
                        <option key={cat} value={cat || ''} />
                      ))}
                    </datalist>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comp-description">Description</Label>
                    <Textarea
                      id="comp-description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Describe what this competency measures..."
                      rows={3}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="comp-active">Active</Label>
                    <Switch
                      id="comp-active"
                      checked={isActive}
                      onCheckedChange={setIsActive}
                    />
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
            ) : competencies.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">No competencies yet</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {competencies.map((comp) => (
                    <TableRow key={comp.id}>
                      <TableCell className="font-medium">{comp.name}</TableCell>
                      <TableCell>
                        {comp.category && (
                          <Badge variant="outline">{comp.category}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{comp.description}</TableCell>
                      <TableCell>
                        <Badge variant={comp.is_active ? 'default' : 'secondary'}>
                          {comp.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(comp)}>
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
                                <AlertDialogTitle>Delete Competency</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{comp.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(comp.id)}>
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
