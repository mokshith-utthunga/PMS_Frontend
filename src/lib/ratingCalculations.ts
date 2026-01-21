// Rating calculation utilities for auto-calculating KRA and year-end ratings

export interface KPIForCalculation {
  id: string;
  kra_id: string;
  weight: number;
}

export interface KRAForCalculation {
  id: string;
  weight: number;
}

// Bonus Rating to Points mapping
export const BONUS_RATING_POINTS: Record<number, number> = {
  5: 5,  // Exceeded
  4: 3,  // Above expectations
  3: 0,  // Meets expectations
  2: -3, // Below expectations
  1: -5, // Poor
};

export const BONUS_RATING_LABELS: Record<number, string> = {
  5: 'Exceeded',
  4: 'Above Expectations',
  3: 'Meets Expectations',
  2: 'Below Expectations',
  1: 'Poor',
};

/**
 * Calculate KRA rating from KPI ratings (weighted average)
 * KRA Rating = Σ (KPI Rating × KPI Weight) / 100
 */
export function calculateKRARating(
  kraId: string,
  kpis: KPIForCalculation[],
  kpiRatings: Record<string, number | null>
): number | null {
  const kraKpis = kpis.filter(k => k.kra_id === kraId);
  
  if (kraKpis.length === 0) return null;
  
  let totalWeightedRating = 0;
  let totalWeight = 0;
  let hasAnyRating = false;
  
  for (const kpi of kraKpis) {
    const rating = kpiRatings[kpi.id];
    if (rating !== null && rating !== undefined) {
      const kpiWeight = Number(kpi.weight || 0);
      totalWeightedRating += Number(rating) * kpiWeight;
      totalWeight += kpiWeight;
      hasAnyRating = true;
    }
  }
  
  if (!hasAnyRating || totalWeight === 0) return null;
  
  // Return weighted average based on actual weights used
  return totalWeightedRating / totalWeight;
}

/**
 * Calculate all KRA ratings from KPI ratings
 */
export function calculateAllKRARatings(
  kras: KRAForCalculation[],
  kpis: KPIForCalculation[],
  kpiRatings: Record<string, number | null>
): Record<string, number | null> {
  const kraRatings: Record<string, number | null> = {};
  
  for (const kra of kras) {
    kraRatings[kra.id] = calculateKRARating(kra.id, kpis, kpiRatings);
  }
  
  return kraRatings;
}

/**
 * Calculate overall quarter rating from KRA ratings (weighted average)
 * Quarter Rating = Σ (KRA Rating × KRA Weight) / 100
 */
export function calculateQuarterRating(
  kras: KRAForCalculation[],
  kraRatings: Record<string, number | null>
): number | null {
  let totalWeightedRating = 0;
  let totalWeight = 0;
  let hasAnyRating = false;
  
  for (const kra of kras) {
    const rating = kraRatings[kra.id];
    if (rating !== null && rating !== undefined) {
      const kraWeight = Number(kra.weight || 0);
      totalWeightedRating += Number(rating) * kraWeight;
      totalWeight += kraWeight;
      hasAnyRating = true;
    }
  }
  
  if (!hasAnyRating || totalWeight === 0) return null;
  
  return totalWeightedRating / totalWeight;
}

/**
 * Calculate year-end rating as average of quarterly ratings
 * Year-End Rating = (Q1 + Q2 + Q3 + Q4) / count of available quarters
 */
export function calculateYearEndRating(
  quarterlyRatings: { q1?: number | null; q2?: number | null; q3?: number | null; q4?: number | null }
): number | null {
  const ratings = [
    quarterlyRatings.q1,
    quarterlyRatings.q2,
    quarterlyRatings.q3,
    quarterlyRatings.q4
  ].filter((r): r is number => r !== undefined && r !== null);
  
  if (ratings.length === 0) return null;
  
  return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
}

/**
 * Format rating to display string
 */
export function formatRating(rating: number | string | null | undefined, maxRating: number = 5): string {
  if (rating === null || rating === undefined) return '-';
  
  // Convert string to number if needed (PostgreSQL NUMERIC can return as string)
  const numRating = typeof rating === 'string' ? parseFloat(rating) : rating;
  
  if (isNaN(numRating)) return '-';
  return `${numRating.toFixed(2)}/${maxRating}`;
}

/**
 * Calculate total bonus points from bonus KRA ratings
 */
export function calculateBonusPoints(
  bonusKraRatings: { rating: number | null }[]
): { totalPoints: number; breakdown: { rating: number; points: number }[] } {
  const breakdown: { rating: number; points: number }[] = [];
  let totalPoints = 0;

  for (const item of bonusKraRatings) {
    if (item.rating !== null && item.rating !== undefined) {
      const points = BONUS_RATING_POINTS[item.rating] ?? 0;
      breakdown.push({ rating: item.rating, points });
      totalPoints += points;
    }
  }

  return { totalPoints, breakdown };
}

/**
 * Get bonus points for a specific rating
 */
export function getBonusPointsForRating(rating: number | null): number {
  if (rating === null || rating === undefined) return 0;
  return BONUS_RATING_POINTS[rating] ?? 0;
}

/**
 * Calculate final rating with bonus adjustment
 * Final = Base KRA Rating + (Bonus Points / 100)
 * Note: This converts bonus points to a decimal adjustment on the 5-point scale
 */
export function calculateFinalRatingWithBonus(
  baseRating: number | null,
  bonusPoints: number,
  maxRating: number = 5
): number | null {
  if (baseRating === null) return null;
  
  // Convert bonus points to rating scale adjustment
  // e.g., +5 points = +0.05 on 5-point scale
  const adjustment = bonusPoints / 100;
  const finalRating = Math.min(maxRating, Math.max(0, baseRating + adjustment));
  
  return finalRating;
}
