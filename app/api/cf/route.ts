import { NextResponse } from 'next/server';

// THE SHIELD: In-Memory Cache Matrix
const telemetryCache = new Map<string, { timestamp: number, data: any }>();
const CACHE_LIFESPAN = 5 * 60 * 1000; // 5 Minutes 

// Helper function to prevent CF rate limits
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const handle = searchParams.get('handle');

  if (!handle) {
    return NextResponse.json({ error: "Handle parameter missing." }, { status: 400 });
  }

  const cacheKey = handle.toLowerCase();

  // 1. CHECK CACHE
  if (telemetryCache.has(cacheKey)) {
    const cached = telemetryCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_LIFESPAN)) {
      console.log(`[CACHE HIT] Serving ${handle} instantly.`);
      return NextResponse.json(cached.data);
    }
  }

  console.log(`[CACHE MISS] Fetching ${handle} from Codeforces...`);

  // 2. SAFE FETCH (Sequential to avoid 429 Too Many Requests)
  try {
    const infoRes = await fetch(`https://codeforces.com/api/user.info?handles=${handle}`);
    const infoData = await infoRes.json();
    await delay(500); // 0.5s safety buffer

    const statusRes = await fetch(`https://codeforces.com/api/user.status?handle=${handle}`);
    const statusData = await statusRes.json();
    await delay(500); // 0.5s safety buffer

    const ratingRes = await fetch(`https://codeforces.com/api/user.rating?handle=${handle}`);
    const ratingData = await ratingRes.json();

    if (infoData.status !== 'OK' || statusData.status !== 'OK') {
      return NextResponse.json({ error: "Codeforces API rejected the request." }, { status: 400 });
    }

    const payload = {
      info: infoData.result[0],
      submissions: statusData.result,
      ratingHistory: ratingData.status === 'OK' ? ratingData.result : []
    };

    // 3. LOCK INTO CACHE
    telemetryCache.set(cacheKey, { timestamp: Date.now(), data: payload });

    return NextResponse.json(payload);

  } catch (error) {
    console.error(`[ENGINE FAILURE] for ${handle}:`, error);
    return NextResponse.json({ error: "Server failed to reach Codeforces." }, { status: 500 });
  }
}