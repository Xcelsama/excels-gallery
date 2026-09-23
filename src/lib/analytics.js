import "server-only";

/**
 * Thin wrapper around Vercel's Web Analytics API
 * (https://vercel.com/docs/analytics/web-analytics-api).
 *
 * This is read-only, server-side only, and entirely separate from Supabase:
 * per the brief, Vercel Web Analytics is the source of truth for visitor
 * data, so this app never keeps its own visitor-count table.
 *
 * Requires VERCEL_TOKEN + VERCEL_PROJECT_ID (and VERCEL_TEAM_ID if the
 * project lives under a team). If they're missing, every function below
 * resolves to `null` instead of throwing, so the rest of the admin
 * dashboard still works, see isAnalyticsConfigured().
 */

const API_BASE = "https://api.vercel.com/v1/query/web-analytics";

export function isAnalyticsConfigured() {
  return Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_PROJECT_ID);
}

function buildParams(extra = {}) {
  const params = new URLSearchParams({
    projectId: process.env.VERCEL_PROJECT_ID,
    ...extra,
  });
  if (process.env.VERCEL_TEAM_ID) {
    params.set("teamId", process.env.VERCEL_TEAM_ID);
  }
  return params;
}

async function query(path, extraParams) {
  if (!isAnalyticsConfigured()) return null;

  const params = buildParams(extraParams);
  const res = await fetch(`${API_BASE}/${path}?${params.toString()}`, {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    // Analytics don't need to be second-by-second fresh; this keeps the
    // admin dashboard fast and avoids hammering the API on every load.
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    console.error(`Vercel Analytics API ${path} failed: ${res.status}`);
    return null;
  }

  return res.json();
}

/** Lifetime (well, reporting-window) totals: { pageviews, visitors }. */
export async function getVisitorTotals() {
  const result = await query("visits/count", {});
  return result?.data ?? null;
}

/**
 * Daily pageviews/visitors for the last `days` days, oldest first.
 * Hobby-tier projects only retain about a month of reporting history.
 */
export async function getDailyTraffic(days = 30) {
  const until = new Date();
  const since = new Date(until.getTime() - days * 24 * 60 * 60 * 1000);

  const result = await query("visits/aggregate", {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
    by: "day",
  });
  return result?.data ?? null;
}

/** Top gallery routes by page views, e.g. [{ route: "/gallery/[id]", pageviews, visitors }]. */
export async function getTopPages(limit = 5) {
  const until = new Date();
  const since = new Date(until.getTime() - 30 * 24 * 60 * 60 * 1000);

  const result = await query("visits/aggregate", {
    since: since.toISOString().slice(0, 10),
    until: until.toISOString().slice(0, 10),
    by: "route",
    limit: String(limit),
  });
  return result?.data ?? null;
}
