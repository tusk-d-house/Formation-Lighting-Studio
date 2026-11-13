export type WorkflowStep = 'formations' | 'lighting' | 'timeline' | 'settings';

export type StageTheme = 'hall' | 'clubhouse';

export type GraphicsPreset = 'high' | 'medium' | 'low' | 'custom';
export type BeamQuality = 'high' | 'simple' | 'off';

export interface GraphicsSettings {
  preset: GraphicsPreset;
  dpr: number;
  antialias: boolean;
  spotLights: boolean;
  shadows: boolean;
  beamQuality: BeamQuality;
  floorProjection: boolean;
}

export type LightGroupId =
  | 'pinspot'
  | 'front_sus'
  | 'center_sus'
  | 'back_sus'
  | 'side_spot'
  | 'side_foot'
  | 'front_foot'
  | 'back_foot'
  | 'back_upper';

export interface LightGroupInfo {
  id: LightGroupId;
  name: string;
  description: string;
  icon: string;
}

export interface LightGroupLayout {
  height: number;  // Installation height Y in meters
  spacing: number; // Interval between fixtures in meters
  offsetZ: number; // Front/Back Z position in meters
}

export interface Performer {
  id: string;
  name: string;
  color: string;
}

export interface Position2D {
  x: number; // In meters: Main stage is -stageWidth/2 to +stageWidth/2; Wings extend further left/right!
  z: number; // In meters: -stageDepth/2 (Back) to +stageDepth/2 (Front)
}

export interface FormationItem {
  id: string;
  name: string;
  notes: string;
  positions: Record<string, Position2D>;
  colors?: Record<string, string>; // Per-formation dancer color overrides (e.g. indicating who dances in this formation)
}

export type GoboPattern =
  | 'none'
  | 'r_gobo_2'
  | 'r_gobo_4'
  | 'r_gobo_6'
  | 'r_gobo_7'
  | 's_gobo_1'
  | 's_gobo_3'
  | 's_gobo_4'
  | 's_gobo_7'
  | 's_gobo_12'
  | 's_gobo_14';

export type LightMotionPattern =
  | 'none'
  | 'pan_sweep'
  | 'tilt_sweep'
  | 'diag_sweep'
  | 'circle'
  | 'figure8';

export type StrobeWaveform =
  | 'square'
  | 'sine'
  | 'saw_down'
  | 'saw_up'
  | 'triangle'
  | 'pulse';

export interface LightFixture {
  id: string;
  groupId: LightGroupId;
  name: string;
  indexInGroup: number;
  mountPosition: [number, number, number];
  defaultTarget: [number, number, number];
}

export interface LightConfig {
  enabled: boolean;
  color: string;
  rainbow?: boolean;
  intensity: number;
  angle: number;
  targetX: number;
  targetZ: number;
  followPerformerId?: string | null;
  /** Strobe frequency in Hz (0 = off) */
  strobe?: number;
  /** Strobe waveform shape (default: 'square') */
  strobeWaveform?: StrobeWaveform;
  /** Invert ON/OFF timing (half-cycle 180° offset for alternating lights) */
  strobeInvert?: boolean;
  /** Horizontal rotation offset in degrees */
  pan?: number;
  /** Vertical rotation offset in degrees (+ = raise) */
  tilt?: number;
  /** Moving head dynamic motion pattern */
  motionPattern?: LightMotionPattern;
  /** Motion swing angle in degrees (e.g. 1° to 85°, default 30°) */
  motionAngle?: number;
  /** Motion speed in Hz / cycle frequency (e.g. 0.05Hz to 4.0Hz, default 1.0Hz) */
  motionSpeed?: number;
  /** Phase offset step per fixture in group in degrees (-180° to +180°, 0° = full sync) */
  motionPhaseStep?: number;
  /** Base phase offset in degrees (0° to 360°) */
  motionPhase?: number;
  /** Reverse motion direction (clockwise <-> counter-clockwise, left <-> right) */
  motionReverse?: boolean;
  /** Mirror horizontal pan motion across stage center X=0 (left/right symmetry) */
  motionMirror?: boolean;
  /** Gobo pattern filter */
  gobo?: GoboPattern;
  /** Resolved aim height (computed at render time) */
  aimY?: number;
}

export interface LightingPreset {
  id: string;
  name: string;
  ambientIntensity: number;
  ambientColor: string;
  lights: Record<string, LightConfig>;
}

export interface FormationCue {
  id: string;
  time: number;               // Start time in seconds
  duration: number;           // Hold duration (状態を維持する秒数) in seconds
  transitionDuration?: number; // Legacy field for backward compatibility
  formationId: string;
}

export interface LightingCue {
  id: string;
  time: number;         // Start time in seconds
  duration: number;     // Hold duration (状態を維持する秒数) in seconds
  fadeDuration?: number; // Legacy field for backward compatibility
  presetId: string;
}

export type StageViewportMode = 'split' | '2d' | '3d';

export interface ProjectData {
  id: string;
  projectName: string;
  updatedAt: string;
  stageGridCols: number; // Number of 90cm grids wide (e.g. 12 grids = 10.8m)
  stageGridRows: number; // Number of 90cm grids deep (e.g. 8 grids = 7.2m)
  wingGridCols: number;  // Number of 90cm grids for each side wing (e.g. 2 grids = 1.8m each side)
  stageTheme: StageTheme;
  stageInverted?: boolean;
  showDancerNames?: boolean;
  dancerScale?: number;     // User-adjustable dancer size multiplier (e.g. 0.4 to 1.3, default 0.7)
  ambientIntensity: number; // Project-wide ambient light intensity (地明かり)
  ambientColor: string;     // Project-wide ambient light color
  groupLayouts?: Record<LightGroupId, LightGroupLayout>;
  performers: Performer[];
  formations: FormationItem[];
  lightFixtures: LightFixture[];
  lightingPresets: LightingPreset[];
  formationCues: FormationCue[];
  lightingCues: LightingCue[];
  timelinePins?: number[];
  duration: number;
  associatedFilePath?: string;
  audioFileName?: string;
  audioWaveform?: number[];
  audioDuration?: number;
}

export interface ElectronProjectFileAPI {
  isElectron?: boolean;
  showOpenDialog: () => Promise<{ filePath: string; content: string } | { error: string } | null>;
  showSaveDialog: (defaultFileName: string) => Promise<string | null>;
  saveFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  loadProjects: () => Promise<{ success: boolean; projects?: ProjectData[] | null; error?: string }>;
  saveProjects: (projectsJson: string) => Promise<{ success: boolean; error?: string }>;
  saveAudio?: (data: { projectId: string; fileName: string; mimeType: string; bufferBase64: string; waveform: number[]; duration: number }) => Promise<{ success: boolean; error?: string }>;
  loadAudio?: (projectId: string) => Promise<{ success: boolean; data?: { fileName: string; mimeType: string; bufferBase64: string; waveform: number[]; duration: number } | null; error?: string }>;
  deleteAudio?: (projectId: string) => Promise<{ success: boolean; error?: string }>;
  cloneAudio?: (sourceId: string, targetId: string) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI?: ElectronProjectFileAPI;
    __isFormationProjectDirty?: () => boolean;
    __saveFormationProject?: () => Promise<boolean> | boolean;
  }
}
