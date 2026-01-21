// Team Member Goals Page - Manager view for goal approval
import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Target } from 'lucide-react';
import { PageLoader } from '@/loaders';
import { useTeamMemberGoals, useGoalApproval } from '@/hooks';
import { TOTAL_WEIGHT } from '@/utils/constants';
import { TeamMemberHeader } from '@/components/goals/TeamMemberHeader';
import { TeamMemberKRACard } from '@/components/goals/TeamMemberKRACard';
import { TeamMemberBonusSection } from '@/components/goals/TeamMemberBonusSection';
import { ReturnDialog } from '@/components/goals/ReturnDialog';

type ReturnItemType = 'kra' | 'kpi' | 'bonus_kra' | 'bonus_kpi';

interface ReturnDialogState {
  open: boolean;
  type: ReturnItemType | null;
  id: string | null;
}

export default function TeamMemberGoals() {
  const { employeeId } = useParams();
  
  // Fetch team member goals data
  const goalsData = useTeamMemberGoals(employeeId);
  const { employee, kras, kpis, bonusKras, bonusKpis, loading, refetch } = goalsData;

  // Return dialog state
  const [returnDialog, setReturnDialog] = useState<ReturnDialogState>({
    open: false,
    type: null,
    id: null,
  });

  // Goal approval operations
  const approval = useGoalApproval({
    employee,
    kras,
    kpis,
    bonusKras,
    bonusKpis,
    onSuccess: refetch,
  });

  // Computed values
  const submittedCount = useMemo(() => 
    kras.filter(k => k.status === 'submitted').length +
    kpis.filter(k => k.status === 'submitted').length +
    bonusKras.filter(k => k.status === 'submitted').length +
    bonusKpis.filter(k => k.status === 'submitted').length,
    [kras, kpis, bonusKras, bonusKpis]
  );

  const totalKRAWeight = useMemo(() => 
    kras.reduce((sum, k) => sum + Number(k.weight || 0), 0),
    [kras]
  );

  // Handlers
  const handleOpenReturnDialog = (type: ReturnItemType, id: string) => {
    setReturnDialog({ open: true, type, id });
  };

  const handleCloseReturnDialog = () => {
    setReturnDialog({ open: false, type: null, id: null });
  };

  const handleReturn = async (comments: string) => {
    if (!returnDialog.type || !returnDialog.id) return false;
    return approval.returnItem(returnDialog.type, returnDialog.id, comments);
  };

  // Loading state
  if (loading) {
    return (
      <MainLayout>
        <PageLoader />
      </MainLayout>
    );
  }

  // Employee not found
  if (!employee) {
    return (
      <MainLayout>
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Employee not found</AlertDescription>
        </Alert>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <TeamMemberHeader
          employee={employee}
          submittedCount={submittedCount}
          processing={approval.processing}
          onApproveAll={approval.approveAll}
        />

        {/* Weight Summary */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-medium">Total KRA Weight: </span>
                <span className={`font-bold ${totalKRAWeight === TOTAL_WEIGHT ? 'text-primary' : 'text-destructive'}`}>
                  {totalKRAWeight}%
                </span>
              </div>
              <div className="flex gap-4 text-sm">
                <span>
                  Submitted: <Badge variant="default">{kras.filter(k => k.status === 'submitted').length} KRAs</Badge>
                </span>
                <span>
                  Approved: <Badge variant="outline">{kras.filter(k => k.status === 'approved').length} KRAs</Badge>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KRAs List */}
        {kras.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="font-semibold text-lg">No KRAs submitted</h3>
              <p className="text-muted-foreground">
                This employee hasn't submitted any KRAs for the current cycle
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {kras.map(kra => (
              <TeamMemberKRACard
                key={kra.id}
                kra={kra}
                kpis={approval.getKPIsForKRA(kra.id)}
                processing={approval.processing}
                onApprove={approval.approveKRA}
                onReturn={handleOpenReturnDialog}
              />
            ))}
          </div>
        )}

        {/* Bonus KRAs Section */}
        <TeamMemberBonusSection
          bonusKras={bonusKras}
          getBonusKPIsForKRA={approval.getBonusKPIsForKRA}
          processing={approval.processing}
          onApprove={approval.approveBonusKRA}
          onReturn={handleOpenReturnDialog}
        />

        {/* Return Dialog */}
        <ReturnDialog
          open={returnDialog.open}
          type={returnDialog.type}
          processing={approval.processing}
          onClose={handleCloseReturnDialog}
          onSubmit={handleReturn}
        />
      </div>
    </MainLayout>
  );
}
