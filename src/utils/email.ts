function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i: number, j: number;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

const COMMON_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'outlook.cl',
  'live.cl',
  'yahoo.es',
  'yahoo.com',
  'icloud.com',
];

export function getEmailSuggestion(email: string): string | null {
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  const local = parts[0];
  const domain = parts[1].toLowerCase().trim();

  if (COMMON_DOMAINS.includes(domain)) return null;

  for (const commonDomain of COMMON_DOMAINS) {
    const dist = getLevenshteinDistance(domain, commonDomain);
    if (dist > 0 && dist <= 2) {
      return `${local}@${commonDomain}`;
    }
  }
  return null;
}
