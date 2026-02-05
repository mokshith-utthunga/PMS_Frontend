import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, AlertCircle, Settings2 } from 'lucide-react';
import { useState } from 'react';
import type { KRA, Goal } from '@/types';

interface KRACardProps {
  kra: KRA;
  kpis: Goal[];
  canEdit: boolean;
  onEditKRA: (kra: KRA) => void;
  onDeleteKRA: (id: string) => void;
  onAddKPI: (kraId: string) => void;
  onEditKPI: (kpi: Goal) => void;
  onDeleteKPI: (id: string) => void;
}

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline' | 'statusSuccess'> = {
  draft: 'secondary',
  submitted: 'statusSuccess',
  approved: 'outline',
  returned: 'destructive',
  locked: 'outline',
};

const metricTypeLabels: Record<string, string> = {
  number: 'Numeric',
  percentage: 'Percentage',
  milestone: 'Milestone',
  qualitative: 'Qualitative',
};

const getRatingLabel = (rating: number) => {
  switch (rating) {
    case 5: return 'Exceptional';
    case 4: return 'Exceeds';
    case 3: return 'Meets';
    case 2: return 'Needs Improvement';
    case 1: return 'Unsatisfactory';
    default: return '';
  }
};

const getRatingColor = (rating: number) => {
  switch (rating) {
    case 5: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 4: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 3: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 2: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 1: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return '';
  }
};

export function KRACard({
  kra,
  kpis,
  canEdit,
  onEditKRA,
  onDeleteKRA,
  onAddKPI,
  onEditKPI,
  onDeleteKPI,
}: KRACardProps) {
  const [expanded, setExpanded] = useState(true);
  const [expandedCalibrations, setExpandedCalibrations] = useState<Record<string, boolean>>({});
  
  const totalKPIWeight = kpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
  const isKPIWeightValid = totalKPIWeight === 100;

  const toggleCalibration = (kpiId: string) => {
    setExpandedCalibrations(prev => ({
      ...prev,
      [kpiId]: !prev[kpiId],
    }));
  };

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
              {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                
                <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
                </div>
                <div><Badge variant={statusColors[kra.status]}>{kra.status}</Badge></div>
              </div>
              <CardTitle className="text-lg">{kra.title}</CardTitle>
              {kra.description && (
                <CardDescription className="mt-1">{kra.description}</CardDescription>
              )}
            </div>
          </div>
          {canEdit && (
            <div className="flex gap-1 ml-2">
              <Button variant="ghost" size="icon" onClick={() => onEditKRA(kra)}>
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDeleteKRA(kra.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {kra.status === 'returned' && kra.manager_comments && (
          <Alert variant="destructive" className="mt-3">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Manager feedback:</strong> {kra.manager_comments}
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* KPI Weight Progress */}
          <div className="bg-muted/50 rounded-lg p-3 mb-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">KPI Weight Total</span>
              <span className={`text-sm font-medium ${isKPIWeightValid ? 'text-primary' : 'text-destructive'}`}>
                {totalKPIWeight}% / 100%
              </span>
            </div>
            <Progress value={totalKPIWeight} className="h-2 [&>div]:bg-[#00562c]" />
            {!isKPIWeightValid && kpis.length > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {totalKPIWeight < 100
                  ? `Add ${100 - totalKPIWeight}% more KPI weight`
                  : `Reduce ${totalKPIWeight - 100}% KPI weight`}
              </p>
            )}
          </div>

          {/* KPIs List */}
          <div className="space-y-2">
            {kpis.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No KPIs added yet. Add at least one KPI.
              </div>
            ) : (
              kpis.map((kpi) => {
                const hasCalibration = kpi.calibration && kpi.calibration.length > 0;
                // Sort by threshold ascending for range generation
                const sortedCalibration = hasCalibration 
                  ? [...kpi.calibration!].sort((a, b) => a.threshold - b.threshold)
                  : [];
                
                // Generate range descriptions in the new format
                const calibrationRanges: Array<{ range: string; rating: number }> = [];
                if (sortedCalibration.length > 0) {
                  const unit = kpi.metric_type === 'percentage' ? '%' : '';
                  for (let i = 0; i < sortedCalibration.length; i++) {
                    const current = sortedCalibration[i];
                    const previous = sortedCalibration[i - 1];
                    
                    if (i === 0) {
                      // First (lowest) threshold: < threshold
                      calibrationRanges.push({
                        range: `< ${current.threshold}${unit}`,
                        rating: current.rating,
                      });
                    } else {
                      // Middle and last thresholds: previous_threshold+1 - current_threshold
                      const startValue = previous.threshold + 1;
                      const endValue = current.threshold;
                      
                      if (startValue === endValue) {
                        // If start and end are the same, just show the value
                        calibrationRanges.push({
                          range: `${startValue}${unit}`,
                          rating: current.rating,
                        });
                      } else {
                        calibrationRanges.push({
                          range: `${startValue}-${endValue}${unit}`,
                          rating: current.rating,
                        });
                      }
                    }
                  }
                }
                
                return (
                  <div
                    key={kpi.id}
                    className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge variant="secondary" className="text-xs">KPI</Badge>
                          <span className="text-xs text-muted-foreground">Weight: {kpi.weight}%</span>
                          {hasCalibration && (
                            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                              <Settings2 className="h-3 w-3 mr-1" />
                              Rating Correlation Analysis
                            </Badge>
                          )}
                          </div>
                          <div><Badge variant={statusColors[kpi.status]}>{kpi.status}</Badge></div>
                        </div>
                        <p className="font-medium text-sm">{kpi.title}</p>
                        {kpi.description && (
                          <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                          <span>Metric: {metricTypeLabels[kpi.metric_type] || kpi.metric_type}</span>
                          {kpi.target_value && <span>Target: {kpi.target_value}</span>}
                        </div>

                        {/* Calibration Display (Collapsible) */}
                        {hasCalibration && (
                          <Collapsible 
                            open={expandedCalibrations[kpi.id]} 
                            onOpenChange={() => toggleCalibration(kpi.id)}
                            className="mt-2"
                          >
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                                {expandedCalibrations[kpi.id] ? (
                                  <ChevronDown className="h-3 w-3 mr-1" />
                                ) : (
                                  <ChevronRight className="h-3 w-3 mr-1" />
                                )}
                                View Rating Scale ({sortedCalibration.length} rules)
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="mt-2">
                              <div className="bg-muted/50 rounded-lg p-2 space-y-1">
                                <div className="grid grid-cols-2 gap-2 text-xs font-medium text-muted-foreground mb-1 px-2">
                                  <span>Value {kpi.metric_type === 'percentage' ? '(%)' : ''}</span>
                                  <span>Rating</span>
                                </div>
                                {calibrationRanges.map((range, idx) => (
                                  <div 
                                    key={idx} 
                                    className="grid grid-cols-2 gap-2 text-xs px-2 py-1 rounded bg-background"
                                  >
                                    <span className="font-mono">
                                      {range.range}
                                    </span>
                                    <Badge variant="secondary" className={`text-xs w-fit ${getRatingColor(range.rating)}`}>
                                      {range.rating} - {getRatingLabel(range.rating)}
                                    </Badge>
                                  </div>
                                ))}
                                <p className="text-[10px] text-muted-foreground px-2 pt-1">
                                  Rating is based on the value range your achievement falls into.
                                </p>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        )}

                        {kpi.status === 'returned' && kpi.manager_comments && (
                          <Alert variant="destructive" className="mt-2 py-2">
                            <AlertDescription className="text-xs">
                              <strong>Feedback:</strong> {kpi.manager_comments}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      {canEdit && (kpi.status === 'draft' || kpi.status === 'returned') && (
                        <div className="flex gap-1 ml-2">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditKPI(kpi)}>
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDeleteKPI(kpi.id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Add KPI Button */}
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={() => onAddKPI(kra.id)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add KPI
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
