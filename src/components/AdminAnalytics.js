import {
  getDailyTraffic,
  getTopPages,
  getVisitorTotals,
  isAnalyticsConfigured,
} from "@/lib/analytics";

export default async function AdminAnalytics() {
  if (!isAnalyticsConfigured()) {
    return (
      <p className="text-sm text-ink-faint">
        Not connected. Add VERCEL_TOKEN and VERCEL_PROJECT_ID to your
        environment variables to see visitor stats here. The rest of the
        site works fine without it.
      </p>
    );
  }

  const [totals, daily, topPages] = await Promise.all([
    getVisitorTotals(),
    getDailyTraffic(30),
    getTopPages(5),
  ]);

  if (!totals && !daily && !topPages) {
    return (
      <p className="text-sm text-ink-faint">
        Couldn&rsquo;t reach Vercel Analytics just now. Everything else in
        the dashboard is unaffected.
      </p>
    );
  }

  const maxViews = daily?.length
    ? Math.max(...daily.map((d) => d.pageviews), 1)
    : 1;

  return (
    <div className="space-y-8">
      <div className="flex gap-10">
        <Stat label="Visitors" value={totals?.visitors} />
        <Stat label="Page views" value={totals?.pageviews} />
      </div>

      {daily?.length > 0 && (
        <div>
          <p className="text-sm text-ink-muted">Traffic, last 30 days</p>
          <div className="mt-3 flex h-20 items-end gap-0.5">
            {daily.map((d) => (
              <div
                key={d.timestamp}
                title={`${new Date(d.timestamp).toLocaleDateString()}: ${
                  d.pageviews
                } views`}
                className="flex-1 rounded-t-sm bg-accent/40"
                style={{
                  height: `${Math.max(4, (d.pageviews / maxViews) * 100)}%`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {topPages?.length > 0 && (
        <div>
          <p className="text-sm text-ink-muted">Top pages</p>
          <ul className="mt-3 space-y-2">
            {topPages.map((p) => (
              <li
                key={p.route}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="truncate text-ink">{p.route}</span>
                <span className="shrink-0 text-ink-faint">
                  {p.pageviews}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="font-display text-2xl text-ink">{value ?? "N/A"}</p>
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}
