import { useState, useEffect } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/services';
import { Link } from 'react-router-dom';
import { 
  Search, 
  Shield, 
  ArrowLeft, 
  Loader2,
  Users
} from 'lucide-react';

type AppRole = 'employee' | 'manager' | 'dept_head' | 'hr_admin' | 'hrbp' | 'system_admin';

interface UserWithRoles {
  id: string;
  email: string;
  roles: AppRole[];
  employee?: {
    first_name: string;
    last_name: string;
    emp_id: string;
  };
}

const ALL_ROLES: { role: AppRole; label: string; description: string }[] = [
  { role: 'employee', label: 'Employee', description: 'Basic access to own goals and evaluations' },
  { role: 'manager', label: 'Manager', description: 'Can manage direct reports' },
  { role: 'dept_head', label: 'Dept Head', description: 'Department-level visibility' },
  { role: 'hr_admin', label: 'HR Admin', description: 'Full HR administration access' },
  { role: 'hrbp', label: 'HRBP', description: 'HR Business Partner / Calibrator' },
  { role: 'system_admin', label: 'System Admin', description: 'Full system access' },
];

export default function RoleManagement() {
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Fetch users with roles from backend
      const result = await employeeService.roles.getUsersWithRoles();
      setUsers(result.data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleRole = async (userId: string, role: AppRole, hasRole: boolean) => {
    setSaving(userId);
    try {
      if (hasRole) {
        // Remove role
        await employeeService.roles.removeRole(userId, role);
      } else {
        // Add role
        await employeeService.roles.addRole(userId, role);
      }

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          roles: hasRole 
            ? u.roles.filter(r => r !== role)
            : [...u.roles, role]
        };
      }));

      toast({
        title: hasRole ? 'Role removed' : 'Role added',
        description: `${role.replace('_', ' ')} ${hasRole ? 'removed from' : 'added to'} user`
      });
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update role',
        variant: 'destructive'
      });
    } finally {
      setSaving(null);
    }
  };

  const filteredUsers = users.filter(user => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.email.toLowerCase().includes(searchLower) ||
      user.employee?.first_name.toLowerCase().includes(searchLower) ||
      user.employee?.last_name.toLowerCase().includes(searchLower) ||
      user.employee?.emp_id.toLowerCase().includes(searchLower)
    );
  });

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
            <h1 className="text-3xl font-bold tracking-tight">Role Management</h1>
            <p className="text-muted-foreground">
              Assign roles and permissions to users
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          {ALL_ROLES.map(({ role, label, description }) => (
            <Card key={role} className="p-3">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-sm">{label}</span>
              </div>
              <p className="text-xs text-muted-foreground">{description}</p>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No users found</h3>
                <p className="text-muted-foreground">
                  {search ? 'Try adjusting your search' : 'Users will appear when they sign up'}
                </p>
              </div>
            ) : (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">User</TableHead>
                      {ALL_ROLES.map(({ role, label }) => (
                        <TableHead key={role} className="text-center w-[100px]">
                          {label}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            {user.employee ? (
                              <>
                                <p className="font-medium">
                                  {user.employee.first_name} {user.employee.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                              </>
                            ) : (
                              <p className="font-medium">{user.email}</p>
                            )}
                          </div>
                        </TableCell>
                        {ALL_ROLES.map(({ role }) => {
                          const hasRole = user.roles.includes(role);
                          return (
                            <TableCell key={role} className="text-center">
                              <Checkbox
                                checked={hasRole}
                                onCheckedChange={() => toggleRole(user.id, role, hasRole)}
                                disabled={saving === user.id}
                              />
                            </TableCell>
                          );
                        })}
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
