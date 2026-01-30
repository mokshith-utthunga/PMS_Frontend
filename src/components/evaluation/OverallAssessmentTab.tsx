// Overall Assessment Tab Content
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Calculator, AlertCircle, TrendingUp, Target } from 'lucide-react';
import { formatRating } from '@/lib/ratingCalculations';

interface OverallAssessmentTabProps {
  quarter: number;
  calculatedRating: number | null;
  overallComments: string;
  canEdit: boolean;
  onCommentsChange: (value: string) => void;
}

// Get rating label and color
const getRatingLabel = (rating: number | null) => {
  if (rating === null) return null;
  const rounded = Math.round(rating);
  switch (rounded) {
    case 5: return 'Exceptional';
    case 4: return 'Exceeds Expectations';
    case 3: return 'Meets Expectations';
    case 2: return 'Needs Improvement';
    case 1: return 'Unsatisfactory';
    default: return '';
  }
};

const getRatingColor = (rating: number | null) => {
  if (rating === null) return 'bg-muted text-muted-foreground';
  const rounded = Math.round(rating);
  switch (rounded) {
    case 5: return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    case 4: return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 3: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    case 2: return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400';
    case 1: return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    default: return 'bg-muted text-muted-foreground';
  }
};

export function OverallAssessmentTab({
  quarter,
  calculatedRating,
  overallComments,
  canEdit,
  onCommentsChange,
}: OverallAssessmentTabProps) {
  return (
    <div className="space-y-4">
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Q{quarter} Overall Rating
          </CardTitle>
          <CardDescription>
            Automatically calculated as weighted average of your KRA ratings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-6 rounded-lg bg-background border-2 border-primary">
            <div>
              <span className="font-medium text-lg block">Overall Quarter Rating</span>
              <span className="text-sm text-muted-foreground">
                Based on weighted average of all KRAs
              </span>
            </div>
            <div className="text-right">
              <span className="text-4xl font-bold text-primary block">
                {formatRating(calculatedRating)}
              </span>
              {calculatedRating !== null && (
                <Badge className={`mt-2 ${getRatingColor(calculatedRating)}`}>
                  {getRatingLabel(calculatedRating)}
                </Badge>
              )}
            </div>
          </div>
          
          {calculatedRating === null && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Enter your achievement values for all KPIs to see the calculated overall rating.
                The rating is automatically derived from calibration scales configured for each KPI.
              </AlertDescription>
            </Alert>
          )}

          {/* Calculation explanation */}
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              How your rating is calculated
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                <span><strong>KPI Rating</strong> = Derived from calibration scale based on achievement</span>
              </li>
              <li className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                <span><strong>KRA Rating</strong> = Weighted average of its KPIs</span>
              </li>
              <li className="flex items-center gap-2">
                <Target className="h-3 w-3" />
                <span><strong>Overall Rating</strong> = Weighted average of all KRAs</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Overall Comments</CardTitle>
          <CardDescription>
            Share any additional thoughts about your performance this quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Summarize your key achievements, challenges faced, and learnings..."
            value={overallComments}
            onChange={e => onCommentsChange(e.target.value)}
            disabled={!canEdit}
            rows={4}
          />
        </CardContent>
      </Card>
    </div>
  );
}
