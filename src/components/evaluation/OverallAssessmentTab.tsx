// Overall Assessment Tab Content
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, AlertCircle, Star } from 'lucide-react';
import { formatRating } from '@/lib/ratingCalculations';

interface OverallAssessmentTabProps {
  quarter: number;
  calculatedRating: number | null;
  overallRating?: number;
  overallComments: string;
  canEdit: boolean;
  onRatingChange: (value: number | undefined) => void;
  onCommentsChange: (value: string) => void;
}

export function OverallAssessmentTab({
  quarter,
  calculatedRating,
  overallRating,
  overallComments,
  canEdit,
  onRatingChange,
  onCommentsChange,
}: OverallAssessmentTabProps) {
  return (
    <div className="space-y-4">
      {/* Calculated Rating Card */}
      <Card className="border-2 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculated Q{quarter} Rating
          </CardTitle>
          <CardDescription>
            Auto-calculated as weighted average of your KPI self-ratings
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 rounded-lg bg-background border-2 border-primary">
            <span className="font-medium text-lg">Overall Quarter Rating</span>
            <span className="text-3xl font-bold text-primary">
              {formatRating(calculatedRating)}
            </span>
          </div>
          {calculatedRating === null && (
            <Alert className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Rate all your KPIs to see the calculated overall rating.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Self Rating Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Your Overall Rating
          </CardTitle>
          <CardDescription>
            Select your overall self-assessment rating for this quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={overallRating?.toString() || ''}
            onValueChange={(value) => onRatingChange(value ? parseInt(value) : undefined)}
            disabled={!canEdit}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue placeholder="Select your overall rating" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5 - Exceptional</SelectItem>
              <SelectItem value="4">4 - Exceeds Expectations</SelectItem>
              <SelectItem value="3">3 - Meets Expectations</SelectItem>
              <SelectItem value="2">2 - Needs Improvement</SelectItem>
              <SelectItem value="1">1 - Unsatisfactory</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Overall Comments */}
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
