// Single source of truth for the school's WAEC grading scale.
// Every screen and printout must use these helpers so grades and
// remarks never disagree between the marks register, class result
// sheets, report cards, student profile, and portals.

export function getWAECGrade(score: number): { grade: string; remark: string } {
  if (score >= 75) return { grade: 'A1', remark: 'Excellent' };
  if (score >= 70) return { grade: 'B2', remark: 'Very Good' };
  if (score >= 65) return { grade: 'B3', remark: 'Good' };
  if (score >= 60) return { grade: 'C4', remark: 'Credit' };
  if (score >= 55) return { grade: 'C5', remark: 'Credit' };
  if (score >= 50) return { grade: 'C6', remark: 'Credit' };
  if (score >= 45) return { grade: 'D7', remark: 'Pass' };
  if (score >= 40) return { grade: 'E8', remark: 'Poor' };
  return { grade: 'F9', remark: 'Fail' };
}

const GRADE_REMARKS: Record<string, string> = {
  A1: 'Excellent',
  B2: 'Very Good',
  B3: 'Good',
  C4: 'Credit',
  C5: 'Credit',
  C6: 'Credit',
  D7: 'Pass',
  E8: 'Poor',
  F9: 'Fail',
};

/** Remark for a stored grade code (e.g. "B3" -> "Good"), consistent with getWAECGrade. */
export function remarkForGrade(grade: string | null | undefined): string {
  if (!grade) return '';
  const g = grade.toUpperCase().trim();
  if (GRADE_REMARKS[g]) return GRADE_REMARKS[g];
  // Fallback for legacy single-letter grades
  if (g.startsWith('A')) return 'Excellent';
  if (g.startsWith('B')) return 'Good';
  if (g.startsWith('C')) return 'Credit';
  if (g.startsWith('D')) return 'Pass';
  if (g.startsWith('E')) return 'Poor';
  return 'Fail';
}

/**
 * Auto-generated principal's remark based on the term average.
 * Used on report cards when the principal has not written a manual comment.
 */
export function principalRemarkForAvg(avg: number): string {
  if (avg >= 80) return 'An outstanding performance. Keep up the excellent work.';
  if (avg >= 70) return 'A very good result. Keep aiming higher.';
  if (avg >= 60) return 'A good performance. There is room for improvement.';
  if (avg >= 50) return 'A fair result. Work harder next term.';
  if (avg >= 40) return 'A poor performance. Serious improvement is needed.';
  return 'A very poor result. Must sit up and work much harder.';
}

/** Overall remark for a term average percentage. */
export function getOverallRemark(avg: number): string {
  if (avg >= 80) return 'Excellent';
  if (avg >= 70) return 'Very Good';
  if (avg >= 60) return 'Good';
  if (avg >= 50) return 'Pass';
  if (avg >= 40) return 'Poor';
  return 'Fail';
}
