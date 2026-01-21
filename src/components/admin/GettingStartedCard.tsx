// Getting Started Guide Card
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Step {
  number: number;
  title: string;
  description: string;
  link?: string;
  buttonText: string;
  isComplete: boolean;
  disabled?: boolean;
}

interface GettingStartedCardProps {
  departmentCount: number;
  employeeCount: number;
  activeCyclesCount: number;
}

export function GettingStartedCard({
  departmentCount,
  employeeCount,
  activeCyclesCount,
}: GettingStartedCardProps) {
  const steps: Step[] = [
    {
      number: 1,
      title: 'Set up master data',
      description: 'Configure departments, business units, grades, and locations',
      link: '/admin/settings/departments',
      buttonText: 'Configure',
      isComplete: departmentCount > 0,
    },
    {
      number: 2,
      title: 'Import employees',
      description: 'Upload employee data via CSV with org hierarchy',
      link: '/admin/employees/import',
      buttonText: 'Import',
      isComplete: employeeCount > 0,
    },
    {
      number: 3,
      title: 'Create performance cycle',
      description: 'Define dates for goal setting, evaluations, and calibration',
      link: '/admin/cycles/new',
      buttonText: 'Create',
      isComplete: activeCyclesCount > 0,
    },
    {
      number: 4,
      title: 'Activate and monitor',
      description: 'Launch the cycle and track progress through reports',
      buttonText: activeCyclesCount > 0 ? 'Active' : 'Activate',
      isComplete: activeCyclesCount > 0,
      disabled: activeCyclesCount === 0,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting Started</CardTitle>
        <CardDescription>
          Follow these steps to set up your Performance Management System
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {steps.map(step => (
            <div key={step.number} className="flex items-start gap-4">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                  step.isComplete
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step.number}
              </div>
              <div className="flex-1">
                <p className="font-medium">{step.title}</p>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {step.link ? (
                <Link to={step.link}>
                  <Button variant="outline" size="sm">
                    {step.buttonText}
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" disabled={step.disabled}>
                  {step.buttonText}
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
