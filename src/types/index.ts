export interface VideoFeatures {
  arousal: number;
  valence: number;
  cut_density: number;
  speech_load: number;
  music_salience: number;
  motion: number;
  text_density: number;
}

export interface Video {
  id: string;
  url: string;
  category: string;
  duration_seconds: number;
  features: VideoFeatures;
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
  avg_arousal: number;
  avg_valence: number;
  avg_cut_density: number;
  avg_speech_load: number;
  avg_music_salience: number;
  avg_motion: number;
  avg_text_density: number;
}

export interface CategoryWeights {
  [category: string]: number;
}

export type Group = "A" | "B";
