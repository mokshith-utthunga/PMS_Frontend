// Team Member Bonus KRA Section for Manager Review
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Award, ChevronDown, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { STATUS_COLORS, METRIC_TYPE_LABELS } from '@/utils/constants';
import type { BonusKRA, BonusKPI } from '@/types';

interface BonusKRAItemProps {
  bonusKra: BonusKRA;
  bonusKpis: BonusKPI[];
  processing: boolean;
  onApprove: (id: string) => void;
  onReturn: (type: 'bonus_kra', id: string) => void;
}

function BonusKRAItem({
  bonusKra,
  bonusKpis,
  processing,
  onApprove,
  onReturn,
}: BonusKRAItemProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card className="border-l-4 border-l-amber-500">
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
                <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                  BONUS
                </Badge>
                <Badge variant={STATUS_COLORS[bonusKra.status]}>{bonusKra.status}</Badge>
              </div>
              <CardTitle className="text-lg">{bonusKra.title}</CardTitle>
              {bonusKra.description && (
                <CardDescription className="mt-1">{bonusKra.description}</CardDescription>
              )}
              {bonusKra.status === 'returned' && bonusKra.manager_comments && (
                <Alert className="mt-2 py-2 border-orange-500/30 bg-orange-500/10">
                  <AlertDescription className="text-xs">
                    <strong className="text-orange-700 dark:text-orange-400">Manager Feedback:</strong>{' '}
                    <span className="text-orange-600 dark:text-orange-300">{bonusKra.manager_comments}</span>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
          {bonusKra.status === 'submitted' && (
            <div className="flex gap-2 ml-2">
              <Button size="sm" onClick={() => onApprove(bonusKra.id)} disabled={processing}>
                <CheckCircle className="mr-1 h-4 w-4" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReturn('bonus_kra', bonusKra.id)}
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
          <div className="space-y-2">
            {bonusKpis.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">
                No KPIs under this Bonus KRA
              </div>
            ) : (
              bonusKpis.map(kpi => (
                <div
                  key={kpi.id}
                  className="border rounded-lg p-3 bg-background hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Badge variant="secondary" className="text-xs">KPI</Badge>
                      <Badge variant={STATUS_COLORS[kpi.status]} className="text-xs">{kpi.status}</Badge>
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
                    {kpi.status === 'returned' && kpi.manager_comments && (
                      <div className="mt-2 p-2 rounded bg-orange-500/10 text-xs">
                        <span className="font-medium text-orange-700 dark:text-orange-400">Feedback: </span>
                        <span className="text-orange-600 dark:text-orange-300">{kpi.manager_comments}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

interface TeamMemberBonusSectionProps {
  bonusKras: BonusKRA[];
  getBonusKPIsForKRA: (bonusKraId: string) => BonusKPI[];
  processing: boolean;
  onApprove: (id: string) => void;
  onReturn: (type: 'bonus_kra', id: string) => void;
}

export function TeamMemberBonusSection({
  bonusKras,
  getBonusKPIsForKRA,
  processing,
  onApprove,
  onReturn,
}: TeamMemberBonusSectionProps) {
  if (bonusKras.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Award className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-semibold">Bonus KRAs</h2>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
          {bonusKras.length}
        </Badge>
      </div>
      
      {bonusKras.map(bonusKra => (
        <BonusKRAItem
          key={bonusKra.id}
          bonusKra={bonusKra}
          bonusKpis={getBonusKPIsForKRA(bonusKra.id)}
          processing={processing}
          onApprove={onApprove}
          onReturn={onReturn}
        />
      ))}
    </div>
  );
}
