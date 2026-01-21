// Validation issues alert component
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import type { ValidationIssue } from '@/utils/goalsValidation';

interface ValidationAlertProps {
  issues: ValidationIssue[];
}

export function ValidationAlert({ issues }: ValidationAlertProps) {
  if (issues.length === 0) return null;

  return (
    <Alert variant="destructive" className="bg-destructive/5 border-destructive/30">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium mb-2">Please fix the following before submitting:</p>
        <ul className="list-disc list-inside space-y-1 text-sm">
          {issues.map((issue, idx) => (
            <li key={idx}>{issue.message}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
