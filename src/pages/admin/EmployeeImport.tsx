import { useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { employeeService } from '@/services';
import { 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface ParsedEmployee {
  emp_id: string;
  first_name: string;
  last_name: string;
  email: string;
  manager_emp_id: string;
  department: string;
  business_unit: string;
  grade: string;
  location: string;
  date_of_joining: string;
  status: string;
  isValid: boolean;
  errors: string[];
}

export default function EmployeeImport() {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedEmployee[]>([]);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const headers = [
      'emp_id',
      'first_name',
      'last_name',
      'email',
      'manager_emp_id',
      'department',
      'business_unit',
      'grade',
      'location',
      'date_of_joining',
      'status'
    ];
    const sampleData = [
      'EMP001,John,Doe,john.doe@company.com,,Engineering,Technology,M3,Mumbai,2020-01-15,active',
      'EMP002,Jane,Smith,jane.smith@company.com,EMP001,Engineering,Technology,M2,Mumbai,2021-03-20,active',
      'EMP003,Bob,Wilson,bob.wilson@company.com,EMP001,Engineering,Technology,M1,Bangalore,2022-06-01,active'
    ];
    
    const csvContent = [headers.join(','), ...sampleData].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'employee_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const parseCSV = (text: string): ParsedEmployee[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const employee: any = {};
      const errors: string[] = [];

      headers.forEach((header, i) => {
        employee[header] = values[i] || '';
      });

      if (!employee.emp_id) errors.push('Employee ID is required');
      if (!employee.first_name) errors.push('First name is required');
      if (!employee.last_name) errors.push('Last name is required');
      if (!employee.email) errors.push('Email is required');
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(employee.email)) {
        errors.push('Invalid email format');
      }
      if (!employee.department) errors.push('Department is required');
      if (!employee.business_unit) errors.push('Business unit is required');
      if (!employee.grade) errors.push('Grade is required');
      if (!employee.location) errors.push('Location is required');
      if (!employee.date_of_joining) errors.push('Date of joining is required');
      else if (!/^\d{4}-\d{2}-\d{2}$/.test(employee.date_of_joining)) {
        errors.push('Date format should be YYYY-MM-DD');
      }

      return {
        ...employee,
        isValid: errors.length === 0,
        errors
      } as ParsedEmployee;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImported(false);
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        setParsedData(parsed);
      };
      reader.readAsText(selectedFile);
    }
  };

  const handleImport = async () => {
    const validEmployees = parsedData.filter(e => e.isValid);
    if (validEmployees.length === 0) {
      toast({
        title: 'No valid records',
        description: 'Please fix the errors in your CSV file and try again.',
        variant: 'destructive'
      });
      return;
    }

    setImporting(true);

    try {
      // Use the bulk import endpoint
      const result = await employeeService.import({
        employees: validEmployees.map(emp => ({
          emp_id: emp.emp_id,
          first_name: emp.first_name,
          last_name: emp.last_name,
          email: emp.email,
          manager_emp_id: emp.manager_emp_id,
          department: emp.department,
          business_unit: emp.business_unit,
          grade: emp.grade,
          location: emp.location,
          date_of_joining: emp.date_of_joining,
          status: emp.status || 'active'
        }))
      });

      setImported(true);
      toast({
        title: 'Import successful',
        description: `${validEmployees.length} employees have been imported.`
      });
    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error.message || 'An error occurred during import.',
        variant: 'destructive'
      });
    } finally {
      setImporting(false);
    }
  };

  const validCount = parsedData.filter(e => e.isValid).length;
  const invalidCount = parsedData.filter(e => !e.isValid).length;

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
            <h1 className="text-3xl font-bold tracking-tight">Import Employees</h1>
            <p className="text-muted-foreground">
              Upload a CSV file to bulk import employee data
            </p>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>CSV Format</CardTitle>
              <CardDescription>
                Your CSV file should contain these columns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm space-y-2">
                <p><strong>Required columns:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>emp_id - Unique employee identifier</li>
                  <li>first_name - Employee's first name</li>
                  <li>last_name - Employee's last name</li>
                  <li>email - Employee's email address</li>
                  <li>department - Department name</li>
                  <li>business_unit - Business unit name</li>
                  <li>grade - Grade level (e.g., M1, M2, M3)</li>
                  <li>location - Office location</li>
                  <li>date_of_joining - Join date (YYYY-MM-DD)</li>
                </ul>
                <p className="mt-4"><strong>Optional columns:</strong></p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>manager_emp_id - Manager's employee ID</li>
                  <li>status - active/inactive/on_leave/terminated</li>
                </ul>
              </div>
              
              <Button variant="outline" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload File</CardTitle>
              <CardDescription>
                Select your CSV file to preview and import
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground" />
                <div className="mt-4">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload">
                    <Button variant="secondary" asChild>
                      <span className="cursor-pointer">
                        <Upload className="mr-2 h-4 w-4" />
                        Select CSV File
                      </span>
                    </Button>
                  </label>
                </div>
                {file && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {parsedData.length > 0 && (
                <div className="flex gap-4">
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {validCount} valid
                  </Badge>
                  {invalidCount > 0 && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {invalidCount} errors
                    </Badge>
                  )}
                </div>
              )}

              {parsedData.length > 0 && !imported && (
                <Button 
                  onClick={handleImport} 
                  disabled={importing || validCount === 0}
                  className="w-full"
                >
                  {importing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Import {validCount} Employees
                    </>
                  )}
                </Button>
              )}

              {imported && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Success!</AlertTitle>
                  <AlertDescription>
                    Employees have been imported successfully.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>

        {parsedData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                Review the data before importing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Emp ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>DOJ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 10).map((emp, i) => (
                      <TableRow key={i} className={emp.isValid ? '' : 'bg-destructive/10'}>
                        <TableCell>
                          {emp.isValid ? (
                            <CheckCircle className="h-4 w-4 text-primary" />
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <span className="text-xs text-destructive">
                                {emp.errors.join(', ')}
                              </span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{emp.emp_id}</TableCell>
                        <TableCell>{emp.first_name} {emp.last_name}</TableCell>
                        <TableCell>{emp.email}</TableCell>
                        <TableCell>{emp.manager_emp_id || '-'}</TableCell>
                        <TableCell>{emp.department}</TableCell>
                        <TableCell>{emp.grade}</TableCell>
                        <TableCell>{emp.location}</TableCell>
                        <TableCell>{emp.date_of_joining}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedData.length > 10 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing 10 of {parsedData.length} records
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
