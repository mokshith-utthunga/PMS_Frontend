// Bonus KRA Section Component
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, Plus, Send } from 'lucide-react';
import { BonusKRACard } from './BonusKRACard';
import { BONUS_RATING_DESCRIPTION } from '@/utils/constants';
import type { BonusKRA, BonusKPI } from '@/types';

interface BonusKRASectionProps {
  bonusKras: BonusKRA[];
  bonusKpis: BonusKPI[];
  canAddBonus: boolean;
  canEdit: (status: string) => boolean;
  getBonusKPIsForKRA: (bonusKraId: string) => BonusKPI[];
  onAddBonusKRA: () => void;
  onEditBonusKRA: (bonusKra: BonusKRA) => void;
  onDeleteBonusKRA: (id: string) => void;
  onAddBonusKPI: (bonusKraId: string) => void;
  onEditBonusKPI: (kpi: BonusKPI) => void;
  onDeleteBonusKPI: (id: string) => void;
  onSubmitBonusKRAs: () => void;
}

export function BonusKRASection({
  bonusKras,
  canAddBonus,
  canEdit,
  getBonusKPIsForKRA,
  onAddBonusKRA,
  onEditBonusKRA,
  onDeleteBonusKRA,
  onAddBonusKPI,
  onEditBonusKPI,
  onDeleteBonusKPI,
  onSubmitBonusKRAs,
}: BonusKRASectionProps) {
  const hasDraftBonusKRAs = bonusKras.some(b => b.status === 'draft' || b.status === 'returned');
  const draftBonusKRAs = bonusKras.filter(b => b.status === 'draft' || b.status === 'returned');
  const allHaveKPIs = draftBonusKRAs.every(bkra => getBonusKPIsForKRA(bkra.id).length > 0);

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="h-5 w-5 text-amber-500" />
            <CardTitle className="text-lg">Bonus KRAs</CardTitle>
          </div>
          {canAddBonus && (
            <Button
              variant="outline"
              size="sm"
              onClick={onAddBonusKRA}
              className="border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Bonus KRA
            </Button>
          )}
        </div>
        <CardDescription>{BONUS_RATING_DESCRIPTION}</CardDescription>
      </CardHeader>
      <CardContent>
        {bonusKras.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Award className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No bonus KRAs yet. Add extra achievements for potential bonus points.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bonusKras.map(bkra => (
              <BonusKRACard
                key={bkra.id}
                bonusKra={bkra}
                bonusKpis={getBonusKPIsForKRA(bkra.id)}
                canEdit={canEdit(bkra.status)}
                onEdit={onEditBonusKRA}
                onDelete={onDeleteBonusKRA}
                onAddKPI={onAddBonusKPI}
                onEditKPI={onEditBonusKPI}
                onDeleteKPI={onDeleteBonusKPI}
              />
            ))}

            {hasDraftBonusKRAs && (
              <Button
                variant="outline"
                className="w-full border-amber-500/50 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                disabled={!allHaveKPIs}
                onClick={onSubmitBonusKRAs}
              >
                <Send className="mr-2 h-4 w-4" />
                Submit Bonus KRAs for Approval
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
