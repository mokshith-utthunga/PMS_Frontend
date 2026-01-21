// Empty state component for Goals page
import { Card, CardContent } from '@/components/ui/card';
import { Target } from 'lucide-react';

export function GoalsEmptyState() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Target className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg">No KRAs yet</h3>
        <p className="text-muted-foreground text-center max-w-sm mt-1">
          Start by adding your Key Result Areas (3-5 required). Each KRA should have one or more KPIs.
        </p>
      </CardContent>
    </Card>
  );
}
