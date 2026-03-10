import { NextResponse } from 'next/server';

// ── Cache ──────────────────────────────────────────────────────────────────────
const telemetryCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_LIFESPAN = 5 * 60 * 1000; // 5 minutes

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

function cached(key: string): any | null {
  const entry = telemetryCache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_LIFESPAN) return entry.data;
  return null;
}
function cache(key: string, data: any) {
  telemetryCache.set(key, { timestamp: Date.now(), data });
}

// ── Shared CF fetcher with retry ───────────────────────────────────────────────
async function fetchCF(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { next: { revalidate: 0 } });
      const data = await res.json();
      if (data.status === 'OK') return data;
      // CF returned an error (e.g. handle not found) — don't retry
      if (data.comment?.includes('not found') || data.comment?.includes('Illegal')) return data;
    } catch {
      if (i < retries - 1) await delay(600 * (i + 1));
    }
  }
  throw new Error('CF API unreachable after retries');
}

// ── Route handler ──────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle');
  const proxyUrl = searchParams.get('url');

  // ── MODE A: ?url= — transparent proxy for any CF endpoint ────────────────────
  // Used by TitanTab, GrindMode, etc. for targeted fetches (user.info, user.rating…)
  if (proxyUrl) {
    // Whitelist: only allow codeforces.com API calls
    let decoded: string;
    try {
      decoded = decodeURIComponent(proxyUrl);
    } catch {
      return NextResponse.json({ error: 'Malformed url parameter.' }, { status: 400 });
    }

    if (!decoded.startsWith('https://codeforces.com/api/')) {
      return NextResponse.json({ error: 'Only Codeforces API URLs are allowed.' }, { status: 403 });
    }

    const cacheKey = `url:${decoded}`;
    const hit = cached(cacheKey);
    if (hit) {
      console.log(`[CACHE HIT] proxy: ${decoded.slice(35, 80)}`);
      return NextResponse.json(hit);
    }

    console.log(`[CACHE MISS] proxy: ${decoded.slice(35, 80)}`);
    try {
      const data = await fetchCF(decoded);
      cache(cacheKey, data);
      return NextResponse.json(data);
    } catch (err) {
      console.error('[PROXY FAILURE]', err);
      return NextResponse.json({ error: 'Failed to reach Codeforces.' }, { status: 500 });
    }
  }

  // ── MODE B: ?handle= — full bundle (info + submissions + ratingHistory) ───────
  // Used by SquadClash and legacy callers that expect the combined payload.
  if (handle) {
    const cacheKey = `handle:${handle.toLowerCase()}`;
    const hit = cached(cacheKey);
    if (hit) {
      console.log(`[CACHE HIT] bundle: ${handle}`);
      return NextResponse.json(hit);
    }

    console.log(`[CACHE MISS] bundle: ${handle}`);
    try {
      const [infoData, statusData, ratingData] = await Promise.all([
        fetchCF(`https://codeforces.com/api/user.info?handles=${handle}`).then(async d => { await delay(200); return d; }),
        fetchCF(`https://codeforces.com/api/user.status?handle=${handle}`).then(async d => { await delay(200); return d; }),
        fetchCF(`https://codeforces.com/api/user.rating?handle=${handle}`),
      ]);

      if (infoData.status !== 'OK' || statusData.status !== 'OK') {
        return NextResponse.json({ error: 'Codeforces rejected the request.', detail: infoData.comment || statusData.comment }, { status: 400 });
      }

      const payload = {
        info: infoData.result[0],
        submissions: statusData.result,
        ratingHistory: ratingData.status === 'OK' ? ratingData.result : [],
      };

      cache(cacheKey, payload);
      return NextResponse.json(payload);
    } catch (err) {
      console.error(`[BUNDLE FAILURE] ${handle}:`, err);
      return NextResponse.json({ error: 'Server failed to reach Codeforces.' }, { status: 500 });
    }
  }

  // ── Neither param provided ────────────────────────────────────────────────────
  return NextResponse.json(
    { error: 'Provide either ?handle=<cf_handle> or ?url=<encoded_cf_api_url>' },
    { status: 400 }
  );
}
