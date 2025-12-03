export enum AudioSource {
  AI = 'AI',
  MANUAL = 'MANUAL'
}

export enum AudioStatus {
  PLAYING = 'PLAYING',
  QUEUED = 'QUEUED',
  COMPLETED = 'COMPLETED'
}

export interface Team {
  name: string;
  logo: string;
}

export interface MatchDetails {
  fixtureId: number;
  teams: {
    home: Team;
    away: Team;
  };
  goals: {
    home: number;
    away: number;
  };
  league: {
    name: string;
  };
  status: {
    elapsed: number;
    short: string;
  };
}

export interface AudioItem {
  id: string;
  filename: string;
  source: AudioSource;
  duration: string;
  timestamp: Date;
  status: AudioStatus;
  description?: string; // e.g., "Goal - Manchester United"
  audioUrl?: string;    // Blob URL or Remote URL for playback
}

export interface SystemStatus {
  n8nConnection: boolean;
  tunnelStatus: boolean;
  pythonEngine: boolean; // Represents the Browser Audio Engine status
}

export interface AppSettings {
  // Core Configuration
  n8nUrl: string;       // main webhook for polling
  matchId: string;      // Match ID (Format depends on provider)
  matchDetails?: MatchDetails; // Store full match info
  persona: string;      // LLM Personality (e.g., "Funny, Casual")
  
  // Data Provider
  dataProvider: 'api-football' | 'sportmonks';
  
  // API Keys (Sent to N8N)
  apiFootballKey: string;
  sportmonksKey: string;
  elevenLabsKey: string;
  openRouterKey: string;
  
  // System Settings
  autoPlay: boolean;
  pollInterval: number; // in milliseconds
  liveMatchUrl: string; // URL for live match preview
}
