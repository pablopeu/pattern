/** Local time is intentional: the file reflects the user's working session. */
export function studyFileName(name: string, now = new Date()): string {
  const trimmed = name.trim();
  if (trimmed && trimmed !== 'Estudio sin título') return trimmed;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Estudio-${pad(now.getFullYear() % 100)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
}
