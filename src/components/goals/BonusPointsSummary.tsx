import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Award, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BONUS_RATING_POINTS, BONUS_RATING_LABELS, getBonusPointsForRating } from '@/lib/ratingCalculations';

interface BonusKRAWithRating {
  id: string;
  title: string;
  rating: number | null;
}

interface BonusPointsSummaryProps {
  bonusKras: BonusKRAWithRating[];
  showTitle?: boolean;
  compact?: boolean;
}

export function BonusPointsSummary({ bonusKras, showTitle = true, compact = false }: BonusPointsSummaryProps) {
  const totalPoints = bonusKras.reduce((sum, bk) => {
    return sum + getBonusPointsForRating(bk.rating);
  }, 0);

  const hasRatings = bonusKras.some(bk => bk.rating !== null);

  if (bonusKras.length === 0) {
    return null;
  }

  return (
    <Card className={cn(compact && "border-0 shadow-none")}>
      {showTitle && (
        <CardHeader className={cn("pb-3", compact && "px-0 pt-0")}>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Bonus KRA Points
          </CardTitle>
          <CardDescription>
            Additional points from bonus achievements
          </CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn(compact && "px-0 pb-0")}>
        <div className="space-y-2">
          {bonusKras.map((bk) => {
            const points = getBonusPointsForRating(bk.rating);
            const label = bk.rating ? BONUS_RATING_LABELS[bk.rating] : 'Not Rated';
            
            return (
              <div
                key={bk.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{bk.title}</p>
                  {bk.rating && (
                    <p className="text-xs text-muted-foreground">{label}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {bk.rating ? (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {bk.rating}/5
                      </Badge>
                      <span className={cn(
                        "text-sm font-semibold min-w-[3rem] text-right",
                        points > 0 && "text-green-600 dark:text-green-400",
                        points < 0 && "text-red-600 dark:text-red-400",
                        points === 0 && "text-muted-foreground"
                      )}>
                        {points > 0 ? `+${points}` : points}
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className={cn(
          "mt-4 pt-3 border-t flex items-center justify-between",
          totalPoints > 0 && "text-green-600 dark:text-green-400",
          totalPoints < 0 && "text-red-600 dark:text-red-400",
          totalPoints === 0 && "text-muted-foreground"
        )}>
          <div className="flex items-center gap-2">
            {totalPoints > 0 && <TrendingUp className="h-4 w-4" />}
            {totalPoints < 0 && <TrendingDown className="h-4 w-4" />}
            {totalPoints === 0 && <Minus className="h-4 w-4" />}
            <span className="font-medium">Total Bonus Points</span>
          </div>
          <span className="text-lg font-bold">
            {hasRatings ? (totalPoints > 0 ? `+${totalPoints}` : totalPoints) : '—'}
          </span>
        </div>

        {/* Legend */}
        <div className="mt-4 pt-3 border-t">
          <p className="text-xs text-muted-foreground mb-2">Point mapping:</p>
          <div className="flex flex-wrap gap-2">
            {[5, 4, 3, 2, 1].map((rating) => (
              <Badge
                key={rating}
                variant="outline"
                className={cn(
                  "text-xs",
                  BONUS_RATING_POINTS[rating] > 0 && "border-green-500/50 text-green-600",
                  BONUS_RATING_POINTS[rating] < 0 && "border-red-500/50 text-red-600",
                  BONUS_RATING_POINTS[rating] === 0 && "border-muted text-muted-foreground"
                )}
              >
                {rating}: {BONUS_RATING_POINTS[rating] > 0 ? '+' : ''}{BONUS_RATING_POINTS[rating]}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
