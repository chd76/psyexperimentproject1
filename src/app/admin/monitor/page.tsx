import { supabase } from "@/lib/supabase";

interface TrackingRow {
  participant_id: string;
  event_type: string;
  stage: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

function getStatus(stage: string, eventType: string, secondsAgo: number) {
  if (stage === "debrief") return "COMPLETE";
  if (eventType === "error") return "ERROR";
  if (secondsAgo > 60) return "STALE";
  return "ACTIVE";
}

function statusColor(status: string) {
  switch (status) {
    case "ACTIVE":
      return "text-green-400";
    case "COMPLETE":
      return "text-blue-400";
    case "STALE":
      return "text-yellow-400";
    case "ERROR":
      return "text-red-400";
    default:
      return "text-neutral-400";
  }
}

function formatAgo(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s ago`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ago`;
  return `${Math.round(seconds / 3600)}h ago`;
}

function formatWatchTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const dynamic = "force-dynamic";

export default async function MonitorPage() {
  const { data: rows } = await supabase
    .from("participant_tracking")
    .select("participant_id, event_type, stage, timestamp, payload")
    .order("timestamp", { ascending: false });

  const now = Date.now();
  const seen = new Set<string>();
  const latest: (TrackingRow & { secondsAgo: number })[] = [];

  for (const row of (rows ?? []) as TrackingRow[]) {
    if (seen.has(row.participant_id)) continue;
    seen.add(row.participant_id);
    const secondsAgo = (now - new Date(row.timestamp).getTime()) / 1000;
    latest.push({ ...row, secondsAgo });
  }

  latest.sort((a, b) => a.secondsAgo - b.secondsAgo);

  return (
    <>
      <meta httpEquiv="refresh" content="30" />
      <div className="min-h-screen bg-neutral-950 text-white p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Participant Monitor</h1>
            <span className="text-xs text-neutral-500">
              Auto-refreshes every 30s
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-neutral-900 rounded-lg p-4">
              <div className="text-2xl font-bold">{latest.length}</div>
              <div className="text-xs text-neutral-500">Total</div>
            </div>
            <div className="bg-neutral-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">
                {latest.filter((r) => getStatus(r.stage, r.event_type, r.secondsAgo) === "ACTIVE").length}
              </div>
              <div className="text-xs text-neutral-500">Active</div>
            </div>
            <div className="bg-neutral-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">
                {latest.filter((r) => getStatus(r.stage, r.event_type, r.secondsAgo) === "COMPLETE").length}
              </div>
              <div className="text-xs text-neutral-500">Complete</div>
            </div>
            <div className="bg-neutral-900 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">
                {latest.filter((r) => getStatus(r.stage, r.event_type, r.secondsAgo) === "STALE" || getStatus(r.stage, r.event_type, r.secondsAgo) === "ERROR").length}
              </div>
              <div className="text-xs text-neutral-500">Stale / Error</div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-500 text-left">
                  <th className="py-3 px-4">PID</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Last Event</th>
                  <th className="py-3 px-4">Last Seen</th>
                  <th className="py-3 px-4">Watch Time</th>
                  <th className="py-3 px-4">Videos</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {latest.map((row) => {
                  const status = getStatus(row.stage, row.event_type, row.secondsAgo);
                  const watchTime = typeof row.payload?.total_watch_time === "number"
                    ? row.payload.total_watch_time
                    : 0;
                  const videosSeen = typeof row.payload?.videos_seen === "number"
                    ? row.payload.videos_seen
                    : "-";

                  return (
                    <tr
                      key={row.participant_id}
                      className="border-b border-neutral-900 hover:bg-neutral-900/50"
                    >
                      <td className="py-3 px-4 font-mono">{row.participant_id}</td>
                      <td className="py-3 px-4">{row.stage}</td>
                      <td className="py-3 px-4 text-neutral-400">{row.event_type}</td>
                      <td className="py-3 px-4 text-neutral-400">{formatAgo(row.secondsAgo)}</td>
                      <td className="py-3 px-4 font-mono">
                        {watchTime > 0 ? formatWatchTime(watchTime as number) : "-"}
                      </td>
                      <td className="py-3 px-4 text-center">{videosSeen}</td>
                      <td className={`py-3 px-4 font-semibold ${statusColor(status)}`}>
                        {status}
                      </td>
                    </tr>
                  );
                })}
                {latest.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-neutral-600">
                      No tracking data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
