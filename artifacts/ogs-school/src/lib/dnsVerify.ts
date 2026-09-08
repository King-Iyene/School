interface DohAnswer {
  name: string;
  type: number;
  data: string;
}

interface DohResponse {
  Status: number;
  Answer?: DohAnswer[];
}

// Two independent DNS-over-HTTPS providers, tried in order. Some networks
// and browser extensions block one specific public resolver (most often
// Google's) to enforce their own DNS filtering — trying a second provider
// keeps a real, correctly-published record from failing verification just
// because the visitor's own network blocked the first lookup.
const DOH_PROVIDERS = [
  (host: string) => ({ url: `https://dns.google/resolve?name=${encodeURIComponent(host)}&type=TXT`, headers: undefined }),
  (host: string) => ({ url: `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=TXT`, headers: { accept: 'application/dns-json' } }),
];

async function queryProvider(host: string, provider: (typeof DOH_PROVIDERS)[number]): Promise<string[]> {
  const { url, headers } = provider(host);
  const res = await fetch(url, headers ? { headers } : undefined);
  if (!res.ok) throw new Error(`${new URL(url).hostname}: HTTP ${res.status}`);
  const data: DohResponse = await res.json();
  return (data.Answer ?? []).map(a => a.data.replace(/^"|"$/g, ''));
}

// Query every provider and merge whatever they find — a real record only
// needs to show up in ONE resolver's cache. Only throws if every provider
// failed outright (network/CORS block), never just because one came back
// empty (that just means its cache hasn't caught up yet).
async function lookupTxt(host: string): Promise<string[]> {
  const results = await Promise.allSettled(DOH_PROVIDERS.map(p => queryProvider(host, p)));
  const records = results.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
  if (records.length === 0 && results.every(r => r.status === 'rejected')) {
    const errors = results.map(r => (r as PromiseRejectedResult).reason?.message ?? 'unknown error');
    throw new Error(`DNS lookup failed on every provider (${errors.join('; ')}). Your network may be blocking DNS-over-HTTPS.`);
  }
  return records;
}

/**
 * Confirms domain ownership by checking, via public DNS-over-HTTPS (no
 * backend of our own needed), that a TXT record at _ogs-verify.<domain>
 * carries the expected token. TXT record values come back quoted, so strip
 * surrounding quotes before comparing.
 */
export async function verifyCustomDomainDns(domain: string, expectedToken: string): Promise<boolean> {
  const host = `_ogs-verify.${domain.trim().replace(/^https?:\/\//, '').replace(/\/$/, '')}`;
  const records = await lookupTxt(host);
  return records.includes(expectedToken);
}
