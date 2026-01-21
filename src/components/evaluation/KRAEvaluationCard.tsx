// KRA Evaluation Card for Self Evaluation
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Calculator } from 'lucide-react';
import { formatRating } from '@/lib/ratingCalculations';
import { KPIRatingForm } from './KPIRatingForm';
import type { KRA, Goal, RatingScale } from '@/types';
import type { GoalRating } from '@/hooks/useEvaluationsData';

interface KRAEvaluationCardProps {
  kra: KRA;
  kpis: Goal[];
  goalRatings: Record<string, GoalRating>;
  kraRating: number | null;
  ratingScales: RatingScale[];
  canEdit: boolean;
  onRatingChange: (goalId: string, field: keyof GoalRating, value: unknown) => void;
}

export function KRAEvaluationCard({
  kra,
  kpis,
  goalRatings,
  kraRating,
  ratingScales,
  canEdit,
  onRatingChange,
}: KRAEvaluationCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="border-l-4 border-l-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 mt-1"
            onClick={() => setExpanded(!expanded)}
          >
              {expanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-primary/10">KRA</Badge>
              <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
            </div>
            <CardTitle className="text-lg">{kra.title}</CardTitle>
            {kra.description && <CardDescription className="mt-1">{kra.description}</CardDescription>}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Calculator className="h-3 w-3" />
              KRA Rating
            </div>
            <div className="text-xl font-bold text-primary">
              {formatRating(kraRating)}
            </div>
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {kpis.map(kpi => (
            <KPIRatingForm
              key={kpi.id}
              kpi={kpi}
              rating={goalRatings[kpi.id]}
              ratingScales={ratingScales}
              canEdit={canEdit}
              onRatingChange={onRatingChange}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
