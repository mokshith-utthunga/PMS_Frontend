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
  empCode?: string;
  quarter?: number;
  year?: number;
  employeeId?: string;
  kraKpiRejections?: Record<string, any>; // Rejection data keyed by KPI ID
  hasActiveRejections?: boolean; // Whether there are any active rejections
}

export function KRAEvaluationCard({
  kra,
  kpis,
  goalRatings,
  kraRating,
  ratingScales,
  canEdit,
  onRatingChange,
  empCode,
  quarter,
  year,
  employeeId,
  kraKpiRejections = {},
  hasActiveRejections = false,
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
          {kpis.map(kpi => {
            const rejection = kraKpiRejections[kpi.id];
            const isRejected = rejection && !rejection.resubmitted_at;
            // If there are active rejections, only allow editing rejected KPIs
            // Otherwise, use the base canEdit value (normal editing flow)
            const kpiCanEdit = hasActiveRejections ? isRejected : canEdit;
            
            // Debug logging
            console.log('[KRAEvaluationCard] KPI editing check:', {
              kpiId: kpi.id,
              kpiTitle: kpi.title,
              hasActiveRejections,
              isRejected,
              rejection: rejection ? { 
                id: rejection.id, 
                goal_id: rejection.goal_id,
                kra_id: rejection.kra_id,
                resubmitted_at: rejection.resubmitted_at,
                rejection_reason: rejection.rejection_reason 
              } : null,
              canEdit,
              kpiCanEdit,
              allRejectionKeys: Object.keys(kraKpiRejections),
            });
            
            return (
              <KPIRatingForm
                key={kpi.id}
                kpi={kpi}
                rating={goalRatings[kpi.id]}
                ratingScales={ratingScales}
                canEdit={kpiCanEdit}
                onRatingChange={onRatingChange}
                empCode={empCode}
                quarter={quarter}
                year={year}
                employeeId={employeeId}
                rejection={rejection}
              />
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}
