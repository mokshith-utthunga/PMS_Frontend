import { Link } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Upload, Users, ArrowLeft, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageLoader } from '@/loaders';
import { STATUS_COLORS, DEFAULT_PAGE_SIZE } from '@/utils/constants';
import { useEmployeeList } from '@/hooks/useEmployeeList';

export default function EmployeeList() {
  const navigate = useNavigate();
  const {
    employees, departments, totalCount, loading, filters, totalPages,
    setSearch, setDepartment, setStatus, nextPage, prevPage,
  } = useEmployeeList();

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight">Employees</h1>
            <p className="text-muted-foreground">{totalCount} employees in the system</p>
          </div>
          <Link to="/admin/employees/import">
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or employee ID..."
                  value={filters.search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <Select value={filters.department} onValueChange={setDepartment}>
                  <SelectTrigger className="w-[180px]">
                    <Filter className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {departments.map(dept => (
                      <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* <Select value={filters.status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                     <SelectItem value="inactive">Inactive</SelectItem> 
                     <SelectItem value="on_leave">On Leave</SelectItem>
                    <SelectItem value="terminated">Terminated</SelectItem> 
                  </SelectContent>
                </Select> */}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <PageLoader />
            ) : employees.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No employees found</h3>
                <p className="text-muted-foreground">
                  {filters.search ? 'Try adjusting your search' : 'Import employees to get started'}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Employee ID</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell>{emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`.trim()}</TableCell>
                          <TableCell >{emp.emp_code || emp.emp_id}</TableCell>
                          <TableCell>{emp.email}</TableCell>
                          <TableCell>{emp.department}</TableCell>
                          <TableCell>{emp.grade}</TableCell>
                          <TableCell>{emp.location}</TableCell>
                          <TableCell>
                            <Badge variant={STATUS_COLORS[emp.status] || 'secondary'}>
                              {emp.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/admin/employee/${emp.id}`)}
                              aria-label={`View employee ${emp.full_name || emp.emp_code}`}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Employee
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages >= 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {filters.page * DEFAULT_PAGE_SIZE + 1} to{' '}
                      {Math.min((filters.page + 1) * DEFAULT_PAGE_SIZE, totalCount)} of {totalCount}
                    </p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={prevPage} disabled={filters.page === 0}>
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <Button variant="outline" size="sm" onClick={nextPage} disabled={filters.page >= totalPages - 1}>
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
