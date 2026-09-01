/** Short uppercase code derived from a school's name, e.g. "Greenfield International School" -> "GIS". */
export function schoolCodeFromName(schoolName: string, fallback = 'SCH'): string {
  const code = schoolName
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 6);
  return code || fallback;
}
