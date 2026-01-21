import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronDown, ChevronRight, Edit2, Trash2, Plus, AlertCircle } from 'lucide-react';
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

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  submitted: 'default',
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
  
  const totalKPIWeight = kpis.reduce((sum, kpi) => sum + Number(kpi.weight || 0), 0);
  const isKPIWeightValid = totalKPIWeight === 100;

  return (
    <Card className="border-l-4 border-l-primary">
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
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Badge variant="outline" className="bg-primary/10">KRA</Badge>
                <Badge variant={statusColors[kra.status]}>{kra.status}</Badge>
                <span className="text-sm font-medium text-primary">Weight: {kra.weight}%</span>
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
            <Progress value={totalKPIWeight} className="h-2" />
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
              kpis.map((kpi) => (
                <div
                  key={kpi.id}
                  className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="text-xs">KPI</Badge>
                        <Badge variant={statusColors[kpi.status]} className="text-xs">{kpi.status}</Badge>
                        <span className="text-xs text-muted-foreground">Weight: {kpi.weight}%</span>
                      </div>
                      <p className="font-medium text-sm">{kpi.title}</p>
                      {kpi.description && (
                        <p className="text-xs text-muted-foreground mt-1">{kpi.description}</p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                        <span>Metric: {metricTypeLabels[kpi.metric_type] || kpi.metric_type}</span>
                        {kpi.target_value && <span>Target: {kpi.target_value}</span>}
                        {kpi.due_date && <span>Due: {new Date(kpi.due_date).toLocaleDateString()}</span>}
                      </div>
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
              ))
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
