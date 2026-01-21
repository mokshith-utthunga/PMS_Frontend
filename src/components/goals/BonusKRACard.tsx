import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2, Award, MessageSquare, ChevronDown, ChevronRight, Plus, Target, Calendar, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export interface BonusKRA {
  id: string;
  title: string;
  description?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'returned' | 'locked';
  manager_comments?: string | null;
}

export interface BonusKPI {
  id: string;
  bonus_kra_id: string;
  title: string;
  description?: string | null;
  metric_type: 'number' | 'percentage' | 'milestone' | 'qualitative';
  target_value?: string | null;
  due_date?: string | null;
  status: 'draft' | 'submitted' | 'approved' | 'returned' | 'locked';
  manager_comments?: string | null;
}

interface BonusKRACardProps {
  bonusKra: BonusKRA;
  bonusKpis: BonusKPI[];
  canEdit: boolean;
  onEdit: (bonusKra: BonusKRA) => void;
  onDelete: (id: string) => void;
  onAddKPI: (bonusKraId: string) => void;
  onEditKPI: (kpi: BonusKPI) => void;
  onDeleteKPI: (id: string) => void;
}

const statusColors: Record<string, string> = {
  draft: 'bg-secondary text-secondary-foreground',
  submitted: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30',
  approved: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30',
  returned: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30',
  locked: 'bg-muted text-muted-foreground',
};

const metricTypeLabels: Record<string, string> = {
  number: 'Number',
  percentage: 'Percentage',
  milestone: 'Milestone',
  qualitative: 'Qualitative',
};

export function BonusKRACard({ 
  bonusKra, 
  bonusKpis, 
  canEdit, 
  onEdit, 
  onDelete,
  onAddKPI,
  onEditKPI,
  onDeleteKPI,
}: BonusKRACardProps) {
  const [expanded, setExpanded] = useState(true);
  const canEditOrDelete = canEdit && (bonusKra.status === 'draft' || bonusKra.status === 'returned');
  const hasKpis = bonusKpis.length > 0;

  return (
    <Card className={cn(
      "border-l-4 border-l-amber-500 dark:border-l-amber-400",
      bonusKra.status === 'returned' && "border-orange-500"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 -ml-1"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <Award className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">
                BONUS
              </Badge>
              <Badge variant="outline" className={statusColors[bonusKra.status]}>
                {bonusKra.status.charAt(0).toUpperCase() + bonusKra.status.slice(1)}
              </Badge>
            </div>
            
            <h3 className="font-medium text-base truncate">{bonusKra.title}</h3>
            
            {bonusKra.description && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                {bonusKra.description}
              </p>
            )}

            {bonusKra.status === 'returned' && bonusKra.manager_comments && (
              <div className="mt-3 p-2 rounded-md bg-orange-500/10 border border-orange-500/30">
                <div className="flex items-start gap-2">
                  <MessageSquare className="h-4 w-4 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Manager Feedback</p>
                    <p className="text-sm text-orange-600 dark:text-orange-300">{bonusKra.manager_comments}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {canEditOrDelete && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onEdit(bonusKra)}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => onDelete(bonusKra.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* KPIs Section */}
        {expanded && (
          <div className="mt-4 border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">
                KPIs ({bonusKpis.length})
              </span>
              {canEditOrDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  onClick={() => onAddKPI(bonusKra.id)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add KPI
                </Button>
              )}
            </div>

            {!hasKpis && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm text-amber-700 dark:text-amber-400">
                  Add at least 1 KPI before submitting
                </span>
              </div>
            )}

            {hasKpis && (
              <div className="space-y-2">
                {bonusKpis.map((kpi) => {
                  const kpiCanEdit = canEdit && (kpi.status === 'draft' || kpi.status === 'returned');
                  
                  return (
                    <div
                      key={kpi.id}
                      className={cn(
                        "p-3 rounded-md border bg-card",
                        kpi.status === 'returned' && "border-orange-500/30 bg-orange-500/5"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm font-medium truncate">{kpi.title}</span>
                            <Badge variant="outline" className={cn("text-xs", statusColors[kpi.status])}>
                              {kpi.status.charAt(0).toUpperCase() + kpi.status.slice(1)}
                            </Badge>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{metricTypeLabels[kpi.metric_type]}</span>
                            {kpi.target_value && (
                              <span>Target: {kpi.target_value}{kpi.metric_type === 'percentage' ? '%' : ''}</span>
                            )}
                            {kpi.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(kpi.due_date), 'MMM d, yyyy')}
                              </span>
                            )}
                          </div>

                          {kpi.description && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {kpi.description}
                            </p>
                          )}

                          {kpi.status === 'returned' && kpi.manager_comments && (
                            <div className="mt-2 p-2 rounded bg-orange-500/10 text-xs">
                              <span className="font-medium text-orange-700 dark:text-orange-400">Feedback: </span>
                              <span className="text-orange-600 dark:text-orange-300">{kpi.manager_comments}</span>
                            </div>
                          )}
                        </div>

                        {kpiCanEdit && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => onEditKPI(kpi)}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:text-destructive"
                              onClick={() => onDeleteKPI(kpi.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
