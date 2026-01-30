// Team Member KRA Card for Manager Review
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { STATUS_COLORS, METRIC_TYPE_LABELS, TOTAL_WEIGHT } from '@/utils/constants';
import type { KRA, Goal } from '@/types';

interface TeamMemberKRACardProps {
  kra: KRA;
  kpis: Goal[];
  processing: boolean;
  onApprove: (kraId: string) => void;
  onReturn: (type: 'kra', id: string) => void;
}

export function TeamMemberKRACard({
  kra,
  kpis,
  processing,
  onApprove,
  onReturn,
}: TeamMemberKRACardProps) {
  const [expanded, setExpanded] = useState(true);
  const totalKPIWeight = kpis.reduce((sum, k) => sum + Number(k.weight || 0), 0);

  return (
    <Card className="border-l-4 border-l-card-border">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0 mt-1"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronDown className="h-4 w-4 text-[hsl(var(--card-arrow))]" /> : <ChevronRight className="h-4 w-4 text-[hsl(var(--card-arrow))]" />}
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                <Badge variant={STATUS_COLORS[kra.status]}>{kra.status}</Badge>
                <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
              </div>
              <CardTitle className="text-lg">{kra.title}</CardTitle>
              {kra.description && <CardDescription className="mt-1">{kra.description}</CardDescription>}
            </div>
          </div>
          {kra.status === 'submitted' && (
            <div className="flex gap-2 ml-2">
              <Button size="sm" onClick={() => onApprove(kra.id)} disabled={processing}>
                <CheckCircle className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReturn('kra', kra.id)}
                disabled={processing}
              >
                <XCircle className="mr-1 h-4 w-4" />
                Return
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium">KPI Weight Total</span>
              <span className={`text-sm font-medium ${totalKPIWeight === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}`}>
                {totalKPIWeight}% / {TOTAL_WEIGHT}%
              </span>
            </div>
            <Progress value={totalKPIWeight} className="h-2 [&>div]:bg-[#00562c]" />
          </div>

          <div className="space-y-2">
            {kpis.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No KPIs under this KRA
              </div>
            ) : (
              kpis.map(kpi => {
                // Parse calibration - handle both array and JSONB string formats
                // PostgreSQL returns JSONB as JavaScript objects/arrays automatically
                let calibrationArray: Array<{ threshold: number; rating: number }> = [];
                if (kpi.calibration) {
                  if (typeof kpi.calibration === 'string') {
                    try {
                      const parsed = JSON.parse(kpi.calibration);
                      calibrationArray = Array.isArray(parsed) ? parsed : [];
                    } catch {
                      calibrationArray = [];
                    }
                  } else if (Array.isArray(kpi.calibration)) {
                    calibrationArray = kpi.calibration;
                  } else if (typeof kpi.calibration === 'object' && kpi.calibration !== null) {
                    // Handle case where it might be an object instead of array
                    calibrationArray = [];
                  }
                }

                // Sort calibrations by threshold descending
                const sortedCalibrations = calibrationArray.length > 0
                  ? [...calibrationArray].sort((a, b) => b.threshold - a.threshold)
                  : [];
                const unit = kpi.metric_type === 'percentage' ? '%' : '';

                // Generate range descriptions similar to CalibrationDisplay
                const rangeDescriptions: Array<{ range: string; rating: number }> = [];
                if (sortedCalibrations.length > 0) {
                  // Highest threshold: >= threshold
                  rangeDescriptions.push({
                    range: `≥ ${sortedCalibrations[0].threshold}${unit}`,
                    rating: sortedCalibrations[0].rating,
                  });

                  // Middle ranges: >= next.threshold and < current.threshold
                  for (let i = 0; i < sortedCalibrations.length - 1; i++) {
                    const current = sortedCalibrations[i];
                    const next = sortedCalibrations[i + 1];
                    rangeDescriptions.push({
                      range: `≥ ${next.threshold}${unit} and < ${current.threshold}${unit}`,
                      rating: next.rating,
                    });
                  }

                  // Below lowest threshold (fallback)
                  const lowest = sortedCalibrations[sortedCalibrations.length - 1];
                  rangeDescriptions.push({
                    range: `< ${lowest.threshold}${unit}`,
                    rating: lowest.rating,
                  });
                }

                return (
                  <div
                    key={kpi.id}
                    className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">KPI</Badge>
                          <Badge variant={STATUS_COLORS[kpi.status]} className="text-xs">{kpi.status}</Badge>
                          <span className="text-xs text-muted-foreground">Weight: {kpi.weight}%</span>
                        </div>
                        <p className="font-medium text-sm">{kpi.title}</p>
                        {kpi.description && (
                          <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Metric: {METRIC_TYPE_LABELS[kpi.metric_type] || kpi.metric_type}</span>
                          {kpi.target_value && <span>Target: {kpi.target_value}</span>}
                          {kpi.due_date && <span>Due: {new Date(kpi.due_date).toLocaleDateString()}</span>}
                        </div>
                      </div>
                      
                      {/* Calibrations Column */}
                      {rangeDescriptions.length > 0 && (
                        <div className="flex-shrink-0 border-l pl-4 ml-4 min-w-[200px]">
                          <div className="text-xs font-medium text-muted-foreground mb-2">Calibration</div>
                          <div className="space-y-1.5">
                            {rangeDescriptions.map((desc, idx) => (
                              <div
                                key={idx}
                                className="flex flex-col gap-1 py-1.5 px-2 rounded bg-muted/50"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[10px] text-muted-foreground">{desc.range}</span>
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                    Rating {desc.rating}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
