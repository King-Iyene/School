interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

/**
 * Confirms domain ownership by checking, via public DNS-over-HTTPS (no
 * backend of our own needed), that a TXT record at _ogs-verify.<domain>
 * carries the expected token. TXT record values come back quoted, so strip
 * surrounding quotes before comparing.
 */
export async function verifyCustomDomainDns(domain: string, expectedToken: string): Promise<boolean> {
  const host = `_ogs-verify.${domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`);
  if (!res.ok) throw new Error('DNS lookup failed. Please try again.');
  const data: DohResponse = await res.json();
  const records = (data.Answer ?? []).map(a => a.data.replace(/^"|"$/g, ''));
  return records.includes(expectedToken);
}
