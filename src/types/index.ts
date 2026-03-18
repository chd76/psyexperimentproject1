export interface Video {
  id: string;
  url: string;
  category: string;
  duration_seconds: number;
}

export interface VideoEvent {
  video_id: string;
  category: string;
  watch_time: number;
  ratio: number;
}

export interface SessionData {
  participant_id: string;
  group_assigned: "A" | "B";
  actual_time_seconds: number;
  perceived_time_seconds: number;
  time_distortion_percentage: number;
  average_watch_ratio: number;
  total_videos_viewed: number;
  event_log: VideoEvent[];
}

export interface CategoryWeights {
  [category: string]: number;
}

export type Group = "A" | "B";
