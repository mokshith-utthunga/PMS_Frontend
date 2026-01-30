// Team Member Goals Header Component
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import type { Employee } from '@/types';

interface TeamMemberHeaderProps {
  employee: Employee;
  submittedCount: number;
  processing: boolean;
  onApproveAll: () => void;
}

// Helper function to get initials from employee name
const getInitials = (employee: Employee): string => {
  if (employee.full_name) {
    const parts = employee.full_name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`;
    }
    return parts[0][0] || '';
  }
  return '??';
};

// Helper function to get display name
const getDisplayName = (employee: Employee): string => {
  return employee.full_name || 'Unknown';
};

export function TeamMemberHeader({
  employee,
  submittedCount,
  processing,
  onApproveAll,
}: TeamMemberHeaderProps) {
  return (
    <div className="flex items-center gap-4">
      <Link to="/team">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div className="flex-1 flex items-center gap-4">
        <Avatar className="h-12 w-12">
          <AvatarFallback className="bg-primary text-primary-foreground">
            {getInitials(employee)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {getDisplayName(employee)}'s Goals
          </h1>
          <div className="flex gap-2 mt-1">
            <Badge variant="outline">{employee.department}</Badge>
            <Badge variant="secondary">{employee.grade}</Badge>
          </div>
        </div>
      </div>
      {submittedCount > 0 && (
        <Button onClick={onApproveAll} disabled={processing}>
          <CheckCircle className=" h-4 w-4" />
          Approve All 
        </Button>
      )}
    </div>
  );
}
