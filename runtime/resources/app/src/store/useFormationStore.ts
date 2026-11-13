import { create } from 'zustand';
import {
  WorkflowStep,
  StageTheme,
  LightGroupId,
  LightGroupInfo,
  LightGroupLayout,
  Performer,
  Position2D,
  FormationItem,
  LightFixture,
  LightConfig,
  LightingPreset,
  FormationCue,
  LightingCue,
  StageViewportMode,
  ProjectData,
  GraphicsPreset,
  GraphicsSettings,
} from '../types';
import {
  loadProjectAudio,
  saveProjectAudio,
  deleteProjectAudio,
  cloneProjectAudio,
  decodeAudioWaveform,
} from '../utils/audioStorage';

export const GRID_UNIT_M = 0.9; // 1 grid = 90cm (0.9m)

const GRAPHICS_STORAGE_KEY = 'formation_studio_graphics_v1';

export const GRAPHICS_PRESETS: Record<Exclude<GraphicsPreset, 'custom'>, GraphicsSettings> = {
  high: {
    preset: 'high',
    dpr: 1.5,
    antialias: true,
    spotLights: true,
    shadows: true,
    beamQuality: 'high',
    floorProjection: true,
  },
  medium: {
    preset: 'medium',
    dpr: 1.0,
    antialias: true,
    spotLights: true,
    shadows: false,
    beamQuality: 'simple',
    floorProjection: true,
  },
  low: {
    preset: 'low',
    dpr: 0.75,
    antialias: false,
    spotLights: false,
    shadows: false,
    beamQuality: 'simple',
    floorProjection: true,
  },
};

function loadGraphicsSettings(): GraphicsSettings {
  try {
    const raw = localStorage.getItem(GRAPHICS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...GRAPHICS_PRESETS.medium, ...parsed };
    }
  } catch {
    // Ignore storage errors
  }
  return { ...GRAPHICS_PRESETS.medium };
}

function saveGraphicsSettings(settings: GraphicsSettings): void {
  try {
    localStorage.setItem(GRAPHICS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}
export const DEFAULT_DANCER_COLOR = '#38bdf8';

export const DANCER_COLORS = [
  '#38bdf8',
  '#f43f5e',
  '#f59e0b',
  '#10b981',
  '#a855f7',
  '#ec4899',
  '#eab308',
  '#6366f1',
  '#14b8a6',
  '#f97316',
  '#84cc16',
  '#64748b',
];

export const LIGHT_GROUPS: LightGroupInfo[] = [
  {
    id: 'pinspot',
    name: 'ピンスポット (Pin Spots)',
    description: '特定のダンサーや場所を鋭く抜くピンスポ',
    icon: '',
  },
  {
    id: 'front_sus',
    name: 'フロントサス横一列 (Front Sus)',
    description: 'ステージ前方の天井トラス横一列',
    icon: '',
  },
  {
    id: 'center_sus',
    name: 'センターサス横一列 (Center Sus)',
    description: 'ステージ中央の天井トラス横一列',
    icon: '',
  },
  {
    id: 'back_sus',
    name: 'バックサス横一列 (Back Sus)',
    description: 'ステージ奥の天井トラス横一列',
    icon: '',
  },
  {
    id: 'side_spot',
    name: 'サイドスポット (Side Spots)',
    description: '両袖(下手・上手)中空から横方向に照らすライト',
    icon: '',
  },
  {
    id: 'side_foot',
    name: 'サイドフット (Side Footlights)',
    description: '両袖の床面から足元・側面を照らすフットライト',
    icon: '',
  },
  {
    id: 'front_foot',
    name: '前フット横一列 (Front Footlights)',
    description: '客席側最前列の床からダンサーを煽り照らすフット',
    icon: '',
  },
  {
    id: 'back_foot',
    name: 'バックフット横一列 (Back Footlights)',
    description: 'ステージ最奥の床からシルエット・背景を作るフット',
    icon: '',
  },
  {
    id: 'back_upper',
    name: 'バックフット上横一列 (Back Upper Lights)',
    description: 'ステージ最奥・バックフットの上方から前方を照らす横一列ライト',
    icon: '',
  },
];

export function createDefaultGroupLayouts(
  stageWidth = 10.8,
  stageDepth = 7.2
): Record<LightGroupId, LightGroupLayout> {
  return {
    pinspot: {
      height: 7.2,
      spacing: Number((stageWidth * 0.22).toFixed(2)),
      offsetZ: Number((stageDepth / 2 + 1.4).toFixed(2)),
    },
    front_sus: {
      height: 6.5,
      spacing: Number(((stageWidth - 2.4) / 3).toFixed(2)),
      offsetZ: Number((stageDepth * 0.25).toFixed(2)),
    },
    center_sus: {
      height: 6.5,
      spacing: Number(((stageWidth - 2.4) / 3).toFixed(2)),
      offsetZ: 0,
    },
    back_sus: {
      height: 6.5,
      spacing: Number(((stageWidth - 1.8) / 4).toFixed(2)),
      offsetZ: Number((-stageDepth * 0.35).toFixed(2)),
    },
    side_spot: {
      height: 2.8,
      spacing: Number((stageDepth * 0.38).toFixed(2)),
      offsetZ: 0,
    },
    side_foot: {
      height: 0.25,
      spacing: Number((stageDepth * 0.38).toFixed(2)),
      offsetZ: 0,
    },
    front_foot: {
      height: 0.22,
      spacing: Number(((stageWidth - 2.4) / 4).toFixed(2)),
      offsetZ: Number((stageDepth / 2 - 0.2).toFixed(2)),
    },
    back_foot: {
      height: 0.22,
      spacing: Number(((stageWidth - 2.4) / 4).toFixed(2)),
      offsetZ: Number((-stageDepth / 2 + 0.2).toFixed(2)),
    },
    back_upper: {
      height: 2.2,
      spacing: Number(((stageWidth - 2.4) / 4).toFixed(2)),
      offsetZ: Number((-stageDepth / 2 + 0.2).toFixed(2)),
    },
  };
}

export function computeFixtureMountAndTarget(
  groupId: LightGroupId,
  indexInGroup: number,
  totalInGroup: number,
  layout: LightGroupLayout,
  stageWidth: number,
  stageDepth: number
): {
  mountPosition: [number, number, number];
  defaultTarget: [number, number, number];
} {
  const r2 = (n: number) => Number(n.toFixed(2));

  if (groupId === 'side_spot' || groupId === 'side_foot') {
    const perSide = Math.max(1, Math.ceil(totalInGroup / 2));
    const isRight = indexInGroup >= perSide;
    const idxOnSide = isRight ? indexInGroup - perSide : indexInGroup;
    const countOnThisSide = isRight ? totalInGroup - perSide : perSide;

    const sideX = isRight
      ? r2(stageWidth / 2 - (groupId === 'side_foot' ? 0.15 : -0.1))
      : r2(-stageWidth / 2 + (groupId === 'side_foot' ? 0.15 : -0.1));

    const zPos =
      countOnThisSide <= 1
        ? layout.offsetZ
        : r2(
            layout.offsetZ +
              (idxOnSide - (countOnThisSide - 1) / 2) * layout.spacing
          );

    const targetX = groupId === 'side_foot' ? (isRight ? 0.9 : -0.9) : 0;
    const targetY = groupId === 'side_foot' ? 0.8 : 0.5;
    return {
      mountPosition: [sideX, r2(layout.height), zPos],
      defaultTarget: [targetX, targetY, zPos],
    };
  }

  // Horizontal row groups: pinspot, front_sus, back_sus, front_foot, back_foot
  const xPos =
    totalInGroup <= 1
      ? 0
      : r2((indexInGroup - (totalInGroup - 1) / 2) * layout.spacing);
  const yPos = r2(layout.height);
  const zPos = r2(layout.offsetZ);

  if (groupId === 'pinspot') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [r2(xPos * 0.4), 0, indexInGroup === 0 ? 1.8 : 0],
    };
  }
  if (groupId === 'front_sus') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [r2(xPos * 0.9), 0, r2(stageDepth * 0.12)],
    };
  }
  if (groupId === 'center_sus') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [r2(xPos * 0.9), 0, 0],
    };
  }
  if (groupId === 'back_sus') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [r2(xPos * 0.85), 0, r2(-stageDepth * 0.08)],
    };
  }
  if (groupId === 'front_foot') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [xPos, 1.0, r2(stageDepth * 0.06)],
    };
  }
  if (groupId === 'back_upper') {
    return {
      mountPosition: [xPos, yPos, zPos],
      defaultTarget: [xPos, 1.0, r2(stageDepth * 0.05)],
    };
  }
  // back_foot
  return {
    mountPosition: [xPos, yPos, zPos],
    defaultTarget: [xPos, 1.2, r2(-stageDepth * 0.06)],
  };
}

export function repositionAllFixtures(
  fixtures: LightFixture[],
  layouts: Record<LightGroupId, LightGroupLayout>,
  stageWidth: number,
  stageDepth: number
): LightFixture[] {
  const byGroup: Record<LightGroupId, LightFixture[]> = {
    pinspot: [],
    front_sus: [],
    center_sus: [],
    back_sus: [],
    side_spot: [],
    side_foot: [],
    front_foot: [],
    back_foot: [],
    back_upper: [],
  };
  fixtures.forEach((f) => {
    if (byGroup[f.groupId]) byGroup[f.groupId].push(f);
  });

  const updatedMap: Record<string, LightFixture> = {};
  (Object.keys(byGroup) as LightGroupId[]).forEach((gid) => {
    const list = byGroup[gid];
    const layout = layouts[gid] || createDefaultGroupLayouts(stageWidth, stageDepth)[gid];
    list.forEach((fix, idx) => {
      const { mountPosition, defaultTarget } = computeFixtureMountAndTarget(
        gid,
        idx,
        list.length,
        layout,
        stageWidth,
        stageDepth
      );
      updatedMap[fix.id] = {
        ...fix,
        indexInGroup: idx,
        mountPosition,
        defaultTarget,
      };
    });
  });

  return fixtures.map((f) => updatedMap[f.id] || f);
}

export const DEFAULT_FIXTURES: LightFixture[] = [
  // 1. Pinspots (2)
  { id: 'pin1', groupId: 'pinspot', name: 'ピンスポ #1 (Center)', indexInGroup: 0, mountPosition: [-1.19, 7.2, 5.0], defaultTarget: [0, 0, 1.8] },
  { id: 'pin2', groupId: 'pinspot', name: 'ピンスポ #2 (Sub)', indexInGroup: 1, mountPosition: [1.19, 7.2, 5.0], defaultTarget: [0, 0, 0] },

  // 2. Front Sus (4 across)
  { id: 'fs1', groupId: 'front_sus', name: 'フロントサス #1', indexInGroup: 0, mountPosition: [-4.2, 6.5, 1.8], defaultTarget: [-3.78, 0, 0.86] },
  { id: 'fs2', groupId: 'front_sus', name: 'フロントサス #2', indexInGroup: 1, mountPosition: [-1.4, 6.5, 1.8], defaultTarget: [-1.26, 0, 0.86] },
  { id: 'fs3', groupId: 'front_sus', name: 'フロントサス #3', indexInGroup: 2, mountPosition: [1.4, 6.5, 1.8], defaultTarget: [1.26, 0, 0.86] },
  { id: 'fs4', groupId: 'front_sus', name: 'フロントサス #4', indexInGroup: 3, mountPosition: [4.2, 6.5, 1.8], defaultTarget: [3.78, 0, 0.86] },

  // 3. Center Sus (4 across, stage center)
  { id: 'cs1', groupId: 'center_sus', name: 'センターサス #1', indexInGroup: 0, mountPosition: [-4.2, 6.5, 0], defaultTarget: [-3.78, 0, 0] },
  { id: 'cs2', groupId: 'center_sus', name: 'センターサス #2', indexInGroup: 1, mountPosition: [-1.4, 6.5, 0], defaultTarget: [-1.26, 0, 0] },
  { id: 'cs3', groupId: 'center_sus', name: 'センターサス #3', indexInGroup: 2, mountPosition: [1.4, 6.5, 0], defaultTarget: [1.26, 0, 0] },
  { id: 'cs4', groupId: 'center_sus', name: 'センターサス #4', indexInGroup: 3, mountPosition: [4.2, 6.5, 0], defaultTarget: [3.78, 0, 0] },

  // 3b. Back Sus (5 across)
  { id: 'bs1', groupId: 'back_sus', name: 'バックサス #1', indexInGroup: 0, mountPosition: [-4.5, 6.5, -2.52], defaultTarget: [-3.83, 0, -0.58] },
  { id: 'bs2', groupId: 'back_sus', name: 'バックサス #2', indexInGroup: 1, mountPosition: [-2.25, 6.5, -2.52], defaultTarget: [-1.91, 0, -0.58] },
  { id: 'bs3', groupId: 'back_sus', name: 'バックサス #3', indexInGroup: 2, mountPosition: [0, 6.5, -2.52], defaultTarget: [0, 0, -0.58] },
  { id: 'bs4', groupId: 'back_sus', name: 'バックサス #4', indexInGroup: 3, mountPosition: [2.25, 6.5, -2.52], defaultTarget: [1.91, 0, -0.58] },
  { id: 'bs5', groupId: 'back_sus', name: 'バックサス #5', indexInGroup: 4, mountPosition: [4.5, 6.5, -2.52], defaultTarget: [3.83, 0, -0.58] },

  // 4. Side Spots (4: 2 Left, 2 Right at height 2.8m)
  { id: 'ssL1', groupId: 'side_spot', name: 'サイドスポット 下手#1', indexInGroup: 0, mountPosition: [-5.5, 2.8, -1.37], defaultTarget: [0, 0.5, -1.37] },
  { id: 'ssL2', groupId: 'side_spot', name: 'サイドスポット 下手#2', indexInGroup: 1, mountPosition: [-5.5, 2.8, 1.37], defaultTarget: [0, 0.5, 1.37] },
  { id: 'ssR1', groupId: 'side_spot', name: 'サイドスポット 上手#1', indexInGroup: 2, mountPosition: [5.5, 2.8, -1.37], defaultTarget: [0, 0.5, -1.37] },
  { id: 'ssR2', groupId: 'side_spot', name: 'サイドスポット 上手#2', indexInGroup: 3, mountPosition: [5.5, 2.8, 1.37], defaultTarget: [0, 0.5, 1.37] },

  // 5. Side Footlights (4: floor level y=0.25m)
  { id: 'sfL1', groupId: 'side_foot', name: 'サイドフット 下手#1', indexInGroup: 0, mountPosition: [-5.25, 0.25, -1.37], defaultTarget: [-0.9, 0.8, -1.37] },
  { id: 'sfL2', groupId: 'side_foot', name: 'サイドフット 下手#2', indexInGroup: 1, mountPosition: [-5.25, 0.25, 1.37], defaultTarget: [-0.9, 0.8, 1.37] },
  { id: 'sfR1', groupId: 'side_foot', name: 'サイドフット 上手#1', indexInGroup: 2, mountPosition: [5.25, 0.25, -1.37], defaultTarget: [0.9, 0.8, -1.37] },
  { id: 'sfR2', groupId: 'side_foot', name: 'サイドフット 上手#2', indexInGroup: 3, mountPosition: [5.25, 0.25, 1.37], defaultTarget: [0.9, 0.8, 1.37] },

  // 6. Front Footlights (5 across front edge floor y=0.22m, z=3.4m)
  { id: 'ff1', groupId: 'front_foot', name: '前フット #1', indexInGroup: 0, mountPosition: [-4.2, 0.22, 3.4], defaultTarget: [-4.2, 1.0, 0.43] },
  { id: 'ff2', groupId: 'front_foot', name: '前フット #2', indexInGroup: 1, mountPosition: [-2.1, 0.22, 3.4], defaultTarget: [-2.1, 1.0, 0.43] },
  { id: 'ff3', groupId: 'front_foot', name: '前フット #3', indexInGroup: 2, mountPosition: [0, 0.22, 3.4], defaultTarget: [0, 1.0, 0.43] },
  { id: 'ff4', groupId: 'front_foot', name: '前フット #4', indexInGroup: 3, mountPosition: [2.1, 0.22, 3.4], defaultTarget: [2.1, 1.0, 0.43] },
  { id: 'ff5', groupId: 'front_foot', name: '前フット #5', indexInGroup: 4, mountPosition: [4.2, 0.22, 3.4], defaultTarget: [4.2, 1.0, 0.43] },

  // 7. Back Footlights (5 across back edge floor y=0.22m, z=-3.4m)
  { id: 'bf1', groupId: 'back_foot', name: 'バックフット #1', indexInGroup: 0, mountPosition: [-4.2, 0.22, -3.4], defaultTarget: [-4.2, 1.2, -0.43] },
  { id: 'bf2', groupId: 'back_foot', name: 'バックフット #2', indexInGroup: 1, mountPosition: [-2.1, 0.22, -3.4], defaultTarget: [-2.1, 1.2, -0.43] },
  { id: 'bf3', groupId: 'back_foot', name: 'バックフット #3', indexInGroup: 2, mountPosition: [0, 0.22, -3.4], defaultTarget: [0, 1.2, -0.43] },
  { id: 'bf4', groupId: 'back_foot', name: 'バックフット #4', indexInGroup: 3, mountPosition: [2.1, 0.22, -3.4], defaultTarget: [2.1, 1.2, -0.43] },
  { id: 'bf5', groupId: 'back_foot', name: 'バックフット #5', indexInGroup: 4, mountPosition: [4.2, 0.22, -3.4], defaultTarget: [4.2, 1.2, -0.43] },

  // 8. Back Upper Lights above Back Footlights (5 across back edge at y=2.2m, z=-3.4m)
  { id: 'bu1', groupId: 'back_upper', name: 'バックフット上 #1', indexInGroup: 0, mountPosition: [-4.2, 2.2, -3.4], defaultTarget: [-4.2, 1.0, 0.36] },
  { id: 'bu2', groupId: 'back_upper', name: 'バックフット上 #2', indexInGroup: 1, mountPosition: [-2.1, 2.2, -3.4], defaultTarget: [-2.1, 1.0, 0.36] },
  { id: 'bu3', groupId: 'back_upper', name: 'バックフット上 #3', indexInGroup: 2, mountPosition: [0, 2.2, -3.4], defaultTarget: [0, 1.0, 0.36] },
  { id: 'bu4', groupId: 'back_upper', name: 'バックフット上 #4', indexInGroup: 3, mountPosition: [2.1, 2.2, -3.4], defaultTarget: [2.1, 1.0, 0.36] },
  { id: 'bu5', groupId: 'back_upper', name: 'バックフット上 #5', indexInGroup: 4, mountPosition: [4.2, 2.2, -3.4], defaultTarget: [4.2, 1.0, 0.36] },
];

/** Older saved projects may lack newly added light groups (e.g. center_sus, back_upper): add them (turned off) without changing existing looks. */
function ensureCenterSus(
  fixtures: LightFixture[],
  layouts: Record<LightGroupId, LightGroupLayout>,
  presets: LightingPreset[],
  stageW: number,
  stageD: number
): {
  fixtures: LightFixture[];
  layouts: Record<LightGroupId, LightGroupLayout>;
  presets: LightingPreset[];
} {
  const defaults = createDefaultGroupLayouts(stageW, stageD);
  const nextLayouts = { ...defaults, ...layouts };
  const requiredGroups: LightGroupId[] = ['center_sus', 'back_upper'];
  const missingGroups = requiredGroups.filter(
    (gid) => !fixtures.some((f) => f.groupId === gid)
  );
  if (missingGroups.length === 0) {
    return { fixtures, layouts: nextLayouts, presets };
  }
  const added = DEFAULT_FIXTURES.filter((f) => missingGroups.includes(f.groupId));
  const merged = repositionAllFixtures(
    [...fixtures, ...added],
    nextLayouts,
    stageW,
    stageD
  );
  const addedFixtures = merged.filter((f) => missingGroups.includes(f.groupId));
  const nextPresets = presets.map((p) => {
    const lights = { ...p.lights };
    addedFixtures.forEach((f) => {
      if (!lights[f.id]) {
        lights[f.id] = {
          enabled: false,
          color: '#ffffff',
          rainbow: false,
          intensity: 2.0,
          angle: 0.48,
          targetX: f.defaultTarget[0],
          targetZ: f.defaultTarget[2],
          followPerformerId: null,
        };
      }
    });
    return { ...p, lights };
  });
  return { fixtures: merged, layouts: nextLayouts, presets: nextPresets };
}

function buildLightsMap(
  fixtures: LightFixture[],
  groupOverrides: Partial<Record<LightGroupId, Partial<LightConfig>>>,
  fixtureOverrides: Record<string, Partial<LightConfig>> = {}
): Record<string, LightConfig> {
  const result: Record<string, LightConfig> = {};
  fixtures.forEach((fix) => {
    const gPatch = groupOverrides[fix.groupId] || {};
    const fPatch = fixtureOverrides[fix.id] || {};
    result[fix.id] = {
      enabled: false,
      color: '#ffffff',
      rainbow: false,
      intensity: 2.0,
      angle: fix.groupId === 'pinspot' ? 0.18 : 0.48,
      targetX: fix.defaultTarget[0],
      targetZ: fix.defaultTarget[2],
      followPerformerId: null,
      ...gPatch,
      ...fPatch,
    };
  });
  return result;
}

const INITIAL_PERFORMERS: Performer[] = [
  { id: 'p1', name: 'Aoi', color: DEFAULT_DANCER_COLOR },
  { id: 'p2', name: 'Ren', color: DEFAULT_DANCER_COLOR },
  { id: 'p3', name: 'Hina', color: DEFAULT_DANCER_COLOR },
  { id: 'p4', name: 'Sora', color: DEFAULT_DANCER_COLOR },
  { id: 'p5', name: 'Mio', color: DEFAULT_DANCER_COLOR },
];

// Coordinates in multiples of 0.9m (1 grid = 90cm)
const INITIAL_FORMATIONS: FormationItem[] = [
  {
    id: 'f1',
    name: 'Formation 1: イントロ (V字＋袖待機)',
    notes: 'Aoi・Ren・HinaがV字、SoraとMioは左右のステージ袖で出番待機。',
    positions: {
      p1: { x: 0, z: 1.8 },
      p2: { x: -1.8, z: 0 },
      p3: { x: 1.8, z: 0 },
      p4: { x: -6.3, z: -0.9 }, // 下手袖で待機
      p5: { x: 6.3, z: -0.9 },  // 上手袖で待機
    },
    colors: {
      p1: DEFAULT_DANCER_COLOR,
      p2: DEFAULT_DANCER_COLOR,
      p3: DEFAULT_DANCER_COLOR,
      p4: '#64748b',
      p5: '#64748b',
    },
  },
  {
    id: 'f2',
    name: 'Formation 2: Aメロ (袖から合流＆センターソロ)',
    notes: 'SoraとMioが袖からステージイン！Aoiがセンターでソロ。',
    positions: {
      p1: { x: 0, z: 0.45 },
      p2: { x: -3.6, z: 1.35 },
      p3: { x: 3.6, z: 1.35 },
      p4: { x: -3.6, z: -1.35 },
      p5: { x: 3.6, z: -1.35 },
    },
    colors: {
      p1: '#f43f5e',
      p2: DEFAULT_DANCER_COLOR,
      p3: DEFAULT_DANCER_COLOR,
      p4: DEFAULT_DANCER_COLOR,
      p5: DEFAULT_DANCER_COLOR,
    },
  },
  {
    id: 'f3',
    name: 'Formation 3: Bメロ (斜め一列ウェーブ)',
    notes: '下手奥(Sora)から上手前(Mio)へ斜めラインを形成。',
    positions: {
      p4: { x: -3.6, z: -1.8 },
      p2: { x: -1.8, z: -0.9 },
      p1: { x: 0, z: 0 },
      p3: { x: 1.8, z: 0.9 },
      p5: { x: 3.6, z: 1.8 },
    },
    colors: {
      p1: DEFAULT_DANCER_COLOR,
      p2: DEFAULT_DANCER_COLOR,
      p3: DEFAULT_DANCER_COLOR,
      p4: DEFAULT_DANCER_COLOR,
      p5: DEFAULT_DANCER_COLOR,
    },
  },
  {
    id: 'f4',
    name: 'Formation 4: サビ (フロント横一列)',
    notes: '全員ステージ前方へ出て横一列でサビの振り付け。',
    positions: {
      p4: { x: -3.6, z: 1.8 },
      p2: { x: -1.8, z: 1.8 },
      p1: { x: 0, z: 1.8 },
      p3: { x: 1.8, z: 1.8 },
      p5: { x: 3.6, z: 1.8 },
    },
    colors: {
      p1: DEFAULT_DANCER_COLOR,
      p2: DEFAULT_DANCER_COLOR,
      p3: DEFAULT_DANCER_COLOR,
      p4: DEFAULT_DANCER_COLOR,
      p5: DEFAULT_DANCER_COLOR,
    },
  },
];

const INITIAL_LIGHTING_PRESETS: LightingPreset[] = [
  {
    id: 'lp1',
    name: 'Preset 1: イントロ (ブルーバックサス＋センターピン)',
    ambientIntensity: 0.3,
    ambientColor: '#1e293b',
    lights: buildLightsMap(
      DEFAULT_FIXTURES,
      {
        back_sus: { enabled: true, color: '#38bdf8', intensity: 2.2, angle: 0.52 },
        side_spot: { enabled: true, color: '#a855f7', intensity: 1.8, angle: 0.45 },
      },
      {
        pin1: { enabled: true, color: '#ffffff', intensity: 2.8, angle: 0.18, targetX: 0, targetZ: 1.8, followPerformerId: 'p1' },
      }
    ),
  },
  {
    id: 'lp2',
    name: 'Preset 2: Aメロ (狭角ピンスポ＆バックフット)',
    ambientIntensity: 0.3,
    ambientColor: '#1e293b',
    lights: buildLightsMap(
      DEFAULT_FIXTURES,
      {
        back_foot: { enabled: true, color: '#3b82f6', intensity: 1.6, angle: 0.55 },
      },
      {
        pin1: { enabled: true, color: '#fef08a', intensity: 3.0, angle: 0.13, targetX: 0, targetZ: 0.45, followPerformerId: 'p1' },
      }
    ),
  },
  {
    id: 'lp3',
    name: 'Preset 3: Bメロ (サイドスポット＆前フット点灯)',
    ambientIntensity: 0.3,
    ambientColor: '#1e293b',
    lights: buildLightsMap(DEFAULT_FIXTURES, {
      side_spot: { enabled: true, color: '#06b6d4', intensity: 2.4, angle: 0.48 },
      front_foot: { enabled: true, color: '#f59e0b', intensity: 2.0, angle: 0.52 },
      back_sus: { enabled: true, color: '#ec4899', intensity: 1.8, angle: 0.55 },
    }),
  },
  {
    id: 'lp4',
    name: 'Preset 4: サビ (全ライト虹色レインボー＆フル点灯)',
    ambientIntensity: 0.3,
    ambientColor: '#1e293b',
    lights: buildLightsMap(
      DEFAULT_FIXTURES,
      {
        front_sus: { enabled: true, color: '#fde047', intensity: 2.5, angle: 0.55 },
        back_sus: { enabled: true, color: '#ff0055', rainbow: true, intensity: 2.8, angle: 0.6 },
        side_spot: { enabled: true, color: '#00ffcc', rainbow: true, intensity: 2.4, angle: 0.5 },
        front_foot: { enabled: true, color: '#fef08a', intensity: 2.2, angle: 0.55 },
        back_foot: { enabled: true, color: '#a855f7', rainbow: true, intensity: 2.5, angle: 0.6 },
      },
      {
        pin1: { enabled: true, color: '#ffffff', intensity: 3.0, angle: 0.24, targetX: 0, targetZ: 1.8, followPerformerId: 'p1' },
      }
    ),
  },
  {
    id: 'lp_blackout',
    name: 'Preset 5: 暗転 (Blackout)',
    ambientIntensity: 0.02,
    ambientColor: '#020617',
    lights: buildLightsMap(DEFAULT_FIXTURES, {}),
  },
];

// Each cue specifies `time` (開始秒数) and `duration` (状態を維持する秒数)!
// The gap between `time + duration` and the next cue's `time` is automatically interpolated as movement/fade!
const INITIAL_FORMATION_CUES: FormationCue[] = [
  { id: 'fc1', time: 0, duration: 2.5, formationId: 'f1' },
  { id: 'fc2', time: 4, duration: 2.5, formationId: 'f2' },
  { id: 'fc3', time: 8, duration: 2.5, formationId: 'f3' },
  { id: 'fc4', time: 12, duration: 4.0, formationId: 'f4' },
];

const INITIAL_LIGHTING_CUES: LightingCue[] = [
  { id: 'lc1', time: 0, duration: 3.0, presetId: 'lp1' },
  { id: 'lc2', time: 4, duration: 3.0, presetId: 'lp2' },
  { id: 'lc3', time: 8, duration: 3.0, presetId: 'lp3' },
  { id: 'lc4', time: 12, duration: 4.0, presetId: 'lp4' },
];

const SAMPLE_PROJECT: ProjectData = {
  id: 'proj_sample_1',
  projectName: 'Sample Dance Live 2026',
  updatedAt: '2026-10-29 18:30',
  stageGridCols: 12, // 12 grids * 0.9m = 10.8m
  stageGridRows: 8,  // 8 grids * 0.9m = 7.2m
  wingGridCols: 2,   // 2 grids * 0.9m = 1.8m per wing
  stageTheme: 'hall',
  ambientIntensity: 0.3,
  ambientColor: '#1e293b',
  groupLayouts: createDefaultGroupLayouts(10.8, 7.2),
  performers: INITIAL_PERFORMERS,
  formations: INITIAL_FORMATIONS,
  lightFixtures: DEFAULT_FIXTURES,
  lightingPresets: INITIAL_LIGHTING_PRESETS,
  formationCues: INITIAL_FORMATION_CUES,
  lightingCues: INITIAL_LIGHTING_CUES,
  duration: 16,
};

const STORAGE_KEY = 'formation_studio_projects_v4';

function normalizeFormationCues(cues: any[]): FormationCue[] {
  return (cues || []).map((c) => ({
    id: c.id,
    time: Number(c.time) || 0,
    duration: Number(c.duration ?? c.transitionDuration ?? 3.0),
    formationId: c.formationId,
  }));
}

function normalizeLightingCues(cues: any[]): LightingCue[] {
  return (cues || []).map((c) => ({
    id: c.id,
    time: Number(c.time) || 0,
    duration: Number(c.duration ?? c.fadeDuration ?? 3.0),
    presetId: c.presetId,
  }));
}

function sanitizeProject(p: any, idx: number): ProjectData {
  const cols = Number(p?.stageGridCols) || 12;
  const rows = Number(p?.stageGridRows) || 8;
  const wCols = Number(p?.wingGridCols) || 2;
  const stW = Number((cols * GRID_UNIT_M).toFixed(2));
  const stD = Number((rows * GRID_UNIT_M).toFixed(2));
  const performers: Performer[] =
    Array.isArray(p?.performers) && p.performers.length > 0
      ? p.performers
      : INITIAL_PERFORMERS;
  const formations: FormationItem[] =
    Array.isArray(p?.formations) && p.formations.length > 0
      ? p.formations.map((f: any, fIdx: number) => ({
          id: f?.id || `f_${fIdx + 1}`,
          name: f?.name || `Formation ${fIdx + 1}`,
          notes: f?.notes || '',
          positions: f?.positions && typeof f.positions === 'object' ? f.positions : {},
          colors: f?.colors && typeof f.colors === 'object' ? f.colors : {},
        }))
      : INITIAL_FORMATIONS;
  const groupLayouts =
    p?.groupLayouts && typeof p.groupLayouts === 'object'
      ? { ...createDefaultGroupLayouts(stW, stD), ...p.groupLayouts }
      : createDefaultGroupLayouts(stW, stD);
  const lightFixtures: LightFixture[] =
    Array.isArray(p?.lightFixtures) && p.lightFixtures.length > 0
      ? p.lightFixtures
      : DEFAULT_FIXTURES;
  const lightingPresets: LightingPreset[] =
    Array.isArray(p?.lightingPresets) && p.lightingPresets.length > 0
      ? p.lightingPresets
      : INITIAL_LIGHTING_PRESETS;

  return {
    id: p?.id || `proj_restored_${idx}`,
    projectName: p?.projectName || 'マイプロジェクト',
    updatedAt: p?.updatedAt || '2026-10-30',
    stageGridCols: cols,
    stageGridRows: rows,
    wingGridCols: wCols,
    stageTheme: p?.stageTheme === 'clubhouse' ? 'clubhouse' : 'hall',
    stageInverted: p?.stageInverted ?? false,
    showDancerNames: p?.showDancerNames ?? true,
    dancerScale: Number(p?.dancerScale) || 0.72,
    ambientIntensity: Number(p?.ambientIntensity ?? 0.3),
    ambientColor: p?.ambientColor || '#1e293b',
    groupLayouts,
    performers,
    formations,
    lightFixtures,
    lightingPresets,
    formationCues: normalizeFormationCues(
      Array.isArray(p?.formationCues) && p.formationCues.length > 0
        ? p.formationCues
        : INITIAL_FORMATION_CUES
    ),
    lightingCues: normalizeLightingCues(
      Array.isArray(p?.lightingCues) && p.lightingCues.length > 0
        ? p.lightingCues
        : INITIAL_LIGHTING_CUES
    ),
    duration: Number(p?.duration) || 16,
    associatedFilePath: p?.associatedFilePath || undefined,
    audioFileName: p?.audioFileName || undefined,
    audioWaveform: Array.isArray(p?.audioWaveform) ? p.audioWaveform : undefined,
    audioDuration: Number(p?.audioDuration) || undefined,
  };
}

function loadSavedProjects(): ProjectData[] {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('formation_studio_projects_v3');
    if (!raw) return [SAMPLE_PROJECT];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((p, idx) => sanitizeProject(p, idx));
    }
    return [SAMPLE_PROJECT];
  } catch {
    return [SAMPLE_PROJECT];
  }
}

function saveProjectsToStorage(projects: ProjectData[]) {
  try {
    const jsonStr = JSON.stringify(projects);
    localStorage.setItem(STORAGE_KEY, jsonStr);
    if (typeof window !== 'undefined' && window.electronAPI?.saveProjects) {
      window.electronAPI.saveProjects(jsonStr).catch(() => {});
    }
  } catch {
    // Ignore
  }
}

/** Synchronize projects from Electron persistent disk storage (%APPDATA%/userData) */
export async function syncProjectsFromPersistentStorage() {
  if (typeof window === 'undefined' || !window.electronAPI?.loadProjects) return;
  try {
    const res = await window.electronAPI.loadProjects();
    if (res.success && Array.isArray(res.projects) && res.projects.length > 0) {
      const sanitized = res.projects.map((p, idx) => sanitizeProject(p, idx));
      useFormationStore.setState({ projects: sanitized });
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      } catch {}
    } else {
      // If disk file doesn't exist yet, seed it with the current localStorage projects
      const currentProjects = useFormationStore.getState().projects;
      if (currentProjects && currentProjects.length > 0) {
        window.electronAPI.saveProjects(JSON.stringify(currentProjects)).catch(() => {});
      }
    }
  } catch {}
}

interface HistorySnapshot {
  performers: Performer[];
  formations: FormationItem[];
  groupLayouts: Record<LightGroupId, LightGroupLayout>;
  lightFixtures: LightFixture[];
  lightingPresets: LightingPreset[];
  formationCues: FormationCue[];
  lightingCues: LightingCue[];
  timelinePins: number[];
  stageGridCols: number;
  stageGridRows: number;
  wingGridCols: number;
  stageTheme: StageTheme;
  stageInverted: boolean;
  ambientIntensity: number;
  ambientColor: string;
}

function captureSnapshot(s: FormationStore): HistorySnapshot {
  return JSON.parse(
    JSON.stringify({
      performers: s.performers,
      formations: s.formations,
      groupLayouts: s.groupLayouts,
      lightFixtures: s.lightFixtures,
      lightingPresets: s.lightingPresets,
      formationCues: s.formationCues,
      lightingCues: s.lightingCues,
      timelinePins: s.timelinePins,
      stageGridCols: s.stageGridCols,
      stageGridRows: s.stageGridRows,
      wingGridCols: s.wingGridCols,
      stageTheme: s.stageTheme,
      stageInverted: Boolean(s.stageInverted),
      ambientIntensity: s.ambientIntensity,
      ambientColor: s.ambientColor,
    })
  );
}

export interface FormationStore {
  projects: ProjectData[];
  activeProjectId: string | null;

  pastHistory: HistorySnapshot[];
  futureHistory: HistorySnapshot[];
  pushHistorySnapshot: () => void;
  undo: () => void;
  redo: () => void;

  projectName: string;
  currentStep: WorkflowStep;
  viewportMode: StageViewportMode;
  showPdfModal: boolean;

  // Stage config in 90cm grids!
  stageGridCols: number; // Width in 90cm grids
  stageGridRows: number; // Depth in 90cm grids
  wingGridCols: number;  // Wing width (each side) in 90cm grids
  stageWidth: number;    // Computed: stageGridCols * 0.9
  stageDepth: number;    // Computed: stageGridRows * 0.9
  wingWidth: number;     // Computed: wingGridCols * 0.9
  stageTheme: StageTheme;
  stageInverted: boolean; // Stage orientation flip (FRONT at bottom vs FRONT at top)

  // Project-wide ambient light (地明かり)
  ambientIntensity: number;
  ambientColor: string;

  snapToGrid: boolean;
  showPaths: boolean;
  showLightBeams: boolean;
  showDancerNames: boolean;
  dancerScale: number;
  graphicsSettings: GraphicsSettings;

  performers: Performer[];
  selectedPerformerId: string | null;
  selectedPerformerIds: string[];

  formations: FormationItem[];
  activeFormationId: string;

  groupLayouts: Record<LightGroupId, LightGroupLayout>;
  lightFixtures: LightFixture[];
  lightingPresets: LightingPreset[];
  activePresetId: string;
  selectedGroupId: LightGroupId;
  selectedLightId: string | null;

  formationCues: FormationCue[];
  lightingCues: LightingCue[];
  timelinePins: number[];
  selectedFormationCueId: string | null;
  selectedLightingCueId: string | null;
  timelineZoom: number;

  isPlaying: boolean;
  isRecordingVideo: boolean;
  currentTime: number;
  duration: number;
  audioDuration: number | null;
  audioUrl: string | null;
  audioFileName: string | null;
  audioWaveform: number[];
  useDemoBeat: boolean;

  // Project Dashboard Actions
  openProject: (projectId: string) => void;
  closeProjectToHome: () => void;
  createNewProject: (
    name: string,
    cols: number,
    rows: number,
    dancerCount: number,
    theme: StageTheme
  ) => void;
  duplicateProject: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  saveCurrentProject: () => void;

  // Navigation & Global Actions
  setProjectName: (name: string) => void;
  setCurrentStep: (step: WorkflowStep) => void;
  setViewportMode: (mode: StageViewportMode) => void;
  setShowPdfModal: (show: boolean) => void;
  setSnapToGrid: (snap: boolean) => void;
  setShowPaths: (show: boolean) => void;
  setShowLightBeams: (show: boolean) => void;
  setShowDancerNames: (show: boolean) => void;
  setDancerScale: (scale: number) => void;
  setTimelineZoom: (zoom: number) => void;
  setIsRecordingVideo: (rec: boolean) => void;
  setGraphicsPreset: (preset: Exclude<GraphicsPreset, 'custom'>) => void;
  updateGraphicsSettings: (patch: Partial<Omit<GraphicsSettings, 'preset'>>) => void;

  // Project Settings Actions
  setStageGridDimensions: (cols: number, rows: number, wingCols?: number) => void;
  setStageTheme: (theme: StageTheme) => void;
  setStageInverted: (stageInverted: boolean) => void;
  flipStageOrientation: (flipPerformers: boolean) => void;
  setProjectAmbient: (intensity: number, color?: string) => void;
  setPerformerCount: (count: number) => void;
  addPerformer: (name?: string, color?: string) => void;
  updatePerformer: (id: string, patch: Partial<Performer>) => void;
  updateSelectedPerformersColor: (color: string) => void;
  resetFormationColors: (formationId: string, color?: string) => void;
  removePerformer: (id: string) => void;
  selectPerformer: (id: string | null, toggle?: boolean) => void;
  selectPerformersByIds: (ids: string[]) => void;

  // Clipboard state for Ctrl+C / Ctrl+V across Formations & Lighting Presets
  copiedDancerPositions: Record<string, Position2D> | null;
  copiedLightingClipboard: {
    mode: 'group' | 'fixture';
    groupId: LightGroupId;
    groupName: string;
    fixtureId?: string;
    fixtureName?: string;
    groupConfigs: Record<string, LightConfig>;
    singleConfig?: LightConfig;
  } | null;
  copySelectedPerformers: () => void;
  pasteCopiedPerformers: () => void;
  copySelectedLighting: () => void;
  pasteCopiedLighting: () => void;

  // Formations Actions
  selectFormation: (id: string) => void;
  addFormation: () => void;
  duplicateFormation: (id: string) => void;
  updateFormation: (id: string, patch: Partial<FormationItem>) => void;
  deleteFormation: (id: string) => void;
  moveFormationOrder: (id: string, dir: 'left' | 'right') => void;
  reorderFormations: (fromIndex: number, toIndex: number) => void;
  updatePerformerPosition: (formationId: string, performerId: string, pos: Position2D) => void;
  moveSelectedPerformersByDelta: (
    formationId: string,
    dx: number,
    dz: number,
    basePositions: Record<string, Position2D>
  ) => void;
  sendSelectedPerformersToWing: (formationId: string, side: 'left' | 'right') => void;
  nudgeSelectedPerformer: (dx: number, dz: number) => void;
  applyFormationTemplate: (
    formationId: string,
    template: 'v-shape' | 'inv-v' | 'line-1' | 'line-2' | 'circle' | 'diagonal' | 'wings-wait'
  ) => void;

  // Lighting Group & Fixture Management Actions
  selectPreset: (id: string) => void;
  selectGroup: (groupId: LightGroupId) => void;
  selectLight: (id: string | null) => void;
  addFixtureToGroup: (groupId: LightGroupId) => void;
  removeFixtureFromGroup: (groupId: LightGroupId) => void;
  updateGroupLayout: (groupId: LightGroupId, patch: Partial<LightGroupLayout>) => void;
  autoFitGroupSpacing: (groupId: LightGroupId) => void;
  updateFixturePosition: (lightId: string, mountPosition: [number, number, number]) => void;
  addLightingPreset: () => void;
  duplicateLightingPreset: (id: string) => void;
  updateLightingPreset: (id: string, patch: Partial<LightingPreset>) => void;
  deleteLightingPreset: (id: string) => void;
  reorderLightingPresets: (fromIndex: number, toIndex: number) => void;
  updateLightGroupConfig: (presetId: string, groupId: LightGroupId, patch: Partial<LightConfig>) => void;
  updateLightConfig: (presetId: string, lightId: string, patch: Partial<LightConfig>) => void;

  // Timeline Actions
  addFormationCue: (time: number, formationId: string, duration?: number) => void;
  updateFormationCue: (id: string, patch: Partial<FormationCue>) => void;
  deleteFormationCue: (id: string) => void;
  selectFormationCue: (id: string | null) => void;

  addLightingCue: (time: number, presetId: string, duration?: number) => void;
  updateLightingCue: (id: string, patch: Partial<LightingCue>) => void;
  deleteLightingCue: (id: string) => void;
  selectLightingCue: (id: string | null) => void;

  // Timeline Pin (Marker) Actions
  addTimelinePin: (time?: number) => void;
  removePreviousTimelinePin: () => void;
  removeTimelinePin: (time: number) => void;
  jumpToPrevTimelinePin: () => number | null;
  jumpToNextTimelinePin: () => number | null;

  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setAudioData: (url: string | null, fileName: string | null, waveform?: number[], duration?: number) => void;
  setUseDemoBeat: (use: boolean) => void;

  exportProjectJson: () => string;
  importProjectJson: (jsonStr: string, filePath?: string) => boolean;

  // File Overwrite & Save As handling
  associatedFilePath: string | null;
  setAssociatedFilePath: (path: string | null) => void;
  saveToast: { message: string; type: 'success' | 'error' | 'info' } | null;
  setSaveToast: (toast: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
  saveProjectFile: (asSaveAs?: boolean) => Promise<{ success: boolean; filePath?: string; message?: string }>;
}

// ===== Unsaved-change tracking (reference comparison against last save/open) =====
const SAVED_KEYS = [
  'projectName',
  'stageGridCols',
  'stageGridRows',
  'wingGridCols',
  'stageTheme',
  'stageInverted',
  'showDancerNames',
  'dancerScale',
  'ambientIntensity',
  'ambientColor',
  'groupLayouts',
  'performers',
  'formations',
  'lightFixtures',
  'lightingPresets',
  'formationCues',
  'lightingCues',
  'timelinePins',
  'duration',
] as const;

let savedRefs: Record<string, unknown> | null = null;

function snapshotSavedRefs(s: object): Record<string, unknown> {
  const src = s as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  SAVED_KEYS.forEach((k) => {
    out[k] = src[k];
  });
  return out;
}

/** True when the open project has changes that were not saved yet. */
export function isProjectDirty(s: { activeProjectId: string | null }): boolean {
  if (!s.activeProjectId || !savedRefs) return false;
  const src = s as unknown as Record<string, unknown>;
  const ref = savedRefs;
  return SAVED_KEYS.some((k) => src[k] !== ref[k]);
}

export const useFormationStore = create<FormationStore>((set, get) => ({
  projects: loadSavedProjects(),
  activeProjectId: null,
  associatedFilePath: null,
  setAssociatedFilePath: (associatedFilePath) => set({ associatedFilePath }),
  saveToast: null,
  setSaveToast: (saveToast) => set({ saveToast }),

  pastHistory: [],
  futureHistory: [],

  pushHistorySnapshot: () => {
    const s = get();
    const snap = captureSnapshot(s);
    set({
      pastHistory: [...s.pastHistory.slice(-39), snap],
      futureHistory: [],
    });
  },

  undo: () => {
    const s = get();
    if (s.pastHistory.length === 0) return;
    const prev = s.pastHistory[s.pastHistory.length - 1];
    const currentSnap = captureSnapshot(s);
    set({
      pastHistory: s.pastHistory.slice(0, -1),
      futureHistory: [currentSnap, ...s.futureHistory.slice(0, 39)],
      performers: prev.performers,
      formations: prev.formations,
      activeFormationId: prev.formations.some((f) => f.id === s.activeFormationId)
        ? s.activeFormationId
        : prev.formations[0]?.id || 'f1',
      groupLayouts: prev.groupLayouts,
      lightFixtures: prev.lightFixtures,
      lightingPresets: prev.lightingPresets,
      activePresetId: prev.lightingPresets.some((p) => p.id === s.activePresetId)
        ? s.activePresetId
        : prev.lightingPresets[0]?.id || 'lp1',
      formationCues: prev.formationCues,
      lightingCues: prev.lightingCues,
      timelinePins: prev.timelinePins || [],
      stageGridCols: prev.stageGridCols,
      stageGridRows: prev.stageGridRows,
      wingGridCols: prev.wingGridCols,
      stageWidth: Number((prev.stageGridCols * GRID_UNIT_M).toFixed(2)),
      stageDepth: Number((prev.stageGridRows * GRID_UNIT_M).toFixed(2)),
      wingWidth: Number((prev.wingGridCols * GRID_UNIT_M).toFixed(2)),
      stageTheme: prev.stageTheme,
      stageInverted: prev.stageInverted ?? false,
      ambientIntensity: prev.ambientIntensity,
      ambientColor: prev.ambientColor,
    });
  },

  redo: () => {
    const s = get();
    if (s.futureHistory.length === 0) return;
    const next = s.futureHistory[0];
    const currentSnap = captureSnapshot(s);
    set({
      pastHistory: [...s.pastHistory.slice(-39), currentSnap],
      futureHistory: s.futureHistory.slice(1),
      performers: next.performers,
      formations: next.formations,
      activeFormationId: next.formations.some((f) => f.id === s.activeFormationId)
        ? s.activeFormationId
        : next.formations[0]?.id || 'f1',
      groupLayouts: next.groupLayouts,
      lightFixtures: next.lightFixtures,
      lightingPresets: next.lightingPresets,
      activePresetId: next.lightingPresets.some((p) => p.id === s.activePresetId)
        ? s.activePresetId
        : next.lightingPresets[0]?.id || 'lp1',
      formationCues: next.formationCues,
      lightingCues: next.lightingCues,
      timelinePins: next.timelinePins || [],
      stageGridCols: next.stageGridCols,
      stageGridRows: next.stageGridRows,
      wingGridCols: next.wingGridCols,
      stageWidth: Number((next.stageGridCols * GRID_UNIT_M).toFixed(2)),
      stageDepth: Number((next.stageGridRows * GRID_UNIT_M).toFixed(2)),
      wingWidth: Number((next.wingGridCols * GRID_UNIT_M).toFixed(2)),
      stageTheme: next.stageTheme,
      stageInverted: next.stageInverted ?? false,
      ambientIntensity: next.ambientIntensity,
      ambientColor: next.ambientColor,
    });
  },

  projectName: SAMPLE_PROJECT.projectName,
  currentStep: 'formations',
  viewportMode: 'split',
  showPdfModal: false,

  stageGridCols: SAMPLE_PROJECT.stageGridCols,
  stageGridRows: SAMPLE_PROJECT.stageGridRows,
  wingGridCols: SAMPLE_PROJECT.wingGridCols,
  stageWidth: Number((SAMPLE_PROJECT.stageGridCols * GRID_UNIT_M).toFixed(2)),
  stageDepth: Number((SAMPLE_PROJECT.stageGridRows * GRID_UNIT_M).toFixed(2)),
  wingWidth: Number((SAMPLE_PROJECT.wingGridCols * GRID_UNIT_M).toFixed(2)),
  stageTheme: SAMPLE_PROJECT.stageTheme,
  stageInverted: false,

  ambientIntensity: SAMPLE_PROJECT.ambientIntensity,
  ambientColor: SAMPLE_PROJECT.ambientColor,

  snapToGrid: true,
  showPaths: true,
  showLightBeams: true,
  showDancerNames: true,
  dancerScale: 0.72,
  graphicsSettings: loadGraphicsSettings(),

  performers: SAMPLE_PROJECT.performers,
  selectedPerformerId: 'p1',
  selectedPerformerIds: ['p1'],

  formations: SAMPLE_PROJECT.formations,
  activeFormationId: 'f1',

  groupLayouts: createDefaultGroupLayouts(10.8, 7.2),
  lightFixtures: DEFAULT_FIXTURES,
  lightingPresets: SAMPLE_PROJECT.lightingPresets,
  activePresetId: 'lp1',
  selectedGroupId: 'back_sus',
  selectedLightId: null,
  copiedDancerPositions: null,
  copiedLightingClipboard: null,

  formationCues: SAMPLE_PROJECT.formationCues,
  lightingCues: SAMPLE_PROJECT.lightingCues,
  timelinePins: SAMPLE_PROJECT.timelinePins || [],
  selectedFormationCueId: 'fc1',
  selectedLightingCueId: 'lc1',
  timelineZoom: 1,

  isPlaying: false,
  isRecordingVideo: false,
  currentTime: 0,
  duration: SAMPLE_PROJECT.duration,
  audioDuration: null,
  audioUrl: null,
  audioFileName: null,
  audioWaveform: [],
  useDemoBeat: true,

  saveCurrentProject: () => {
    const s = get();
    if (!s.activeProjectId) return;
    const nowStr = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const updatedProj: ProjectData = {
      id: s.activeProjectId,
      projectName: s.projectName,
      updatedAt: nowStr,
      stageGridCols: s.stageGridCols,
      stageGridRows: s.stageGridRows,
      wingGridCols: s.wingGridCols,
      stageTheme: s.stageTheme,
      stageInverted: s.stageInverted ?? false,
      showDancerNames: s.showDancerNames,
      dancerScale: s.dancerScale,
      ambientIntensity: s.ambientIntensity,
      ambientColor: s.ambientColor,
      groupLayouts: s.groupLayouts,
      performers: s.performers,
      formations: s.formations,
      lightFixtures: s.lightFixtures,
      lightingPresets: s.lightingPresets,
      formationCues: s.formationCues,
      lightingCues: s.lightingCues,
      timelinePins: s.timelinePins,
      duration: s.duration,
      associatedFilePath: s.associatedFilePath || undefined,
      audioFileName: s.audioFileName || undefined,
      audioWaveform: s.audioWaveform && s.audioWaveform.length > 0 ? s.audioWaveform : undefined,
      audioDuration: s.audioDuration || (s.audioFileName ? s.duration : undefined),
    };
    const nextProjects = s.projects.some((p) => p.id === s.activeProjectId)
      ? s.projects.map((p) => (p.id === s.activeProjectId ? updatedProj : p))
      : [updatedProj, ...s.projects];
    saveProjectsToStorage(nextProjects);
    set({ projects: nextProjects });
    savedRefs = snapshotSavedRefs(get());
  },

  openProject: (projectId) => {
    const s = get();
    const target = s.projects.find((p) => p.id === projectId);
    if (!target) return;
    const cols = target.stageGridCols || 12;
    const rows = target.stageGridRows || 8;
    const wCols = target.wingGridCols || 2;
    const stW = Number((cols * GRID_UNIT_M).toFixed(2));
    const stD = Number((rows * GRID_UNIT_M).toFixed(2));
    const rawLayouts = target.groupLayouts || createDefaultGroupLayouts(stW, stD);
    const rawFixtures = target.lightFixtures?.length
      ? target.lightFixtures
      : repositionAllFixtures(DEFAULT_FIXTURES, rawLayouts, stW, stD);
    const rig = ensureCenterSus(
      rawFixtures,
      rawLayouts,
      target.lightingPresets,
      stW,
      stD
    );
    const layouts = rig.layouts;
    const fixtures = rig.fixtures;

    // Revoke previous audio blob url if any
    const prevAudio = s.audioUrl;
    if (prevAudio && prevAudio.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(prevAudio);
      } catch {}
    }

    const initialAudioDur =
      target.audioDuration && target.audioDuration > 0 ? target.audioDuration : null;
    const initialDur = initialAudioDur
      ? Number(initialAudioDur.toFixed(2))
      : target.duration || 16;

    set({
      activeProjectId: target.id,
      associatedFilePath: target.associatedFilePath || null,
      pastHistory: [],
      futureHistory: [],
      projectName: target.projectName,
      stageGridCols: cols,
      stageGridRows: rows,
      wingGridCols: wCols,
      stageWidth: stW,
      stageDepth: stD,
      wingWidth: Number((wCols * GRID_UNIT_M).toFixed(2)),
      stageTheme: target.stageTheme || 'hall',
      stageInverted: target.stageInverted ?? false,
      showDancerNames: target.showDancerNames ?? true,
      dancerScale: target.dancerScale || 0.72,
      ambientIntensity: target.ambientIntensity ?? 0.3,
      ambientColor: target.ambientColor || '#1e293b',
      groupLayouts: layouts,
      performers: target.performers,
      selectedPerformerId: target.performers[0]?.id || null,
      selectedPerformerIds: target.performers[0]?.id ? [target.performers[0].id] : [],
      formations: target.formations,
      activeFormationId: target.formations[0]?.id || 'f1',
      lightFixtures: fixtures,
      lightingPresets: rig.presets,
      activePresetId: rig.presets[0]?.id || 'lp1',
      formationCues: normalizeFormationCues(target.formationCues),
      lightingCues: normalizeLightingCues(target.lightingCues),
      timelinePins: target.timelinePins || [],
      selectedFormationCueId: target.formationCues[0]?.id || null,
      selectedLightingCueId: target.lightingCues[0]?.id || null,
      duration: initialDur,
      audioDuration: initialAudioDur,
      currentTime: 0,
      isPlaying: false,
      currentStep: 'formations',
      audioUrl: null,
      audioFileName: target.audioFileName || null,
      audioWaveform: target.audioWaveform || [],
    });
    savedRefs = snapshotSavedRefs(get());

    // Automatically load & restore persisted project audio from IndexedDB / Electron storage
    loadProjectAudio(target.id)
      .then(async (stored) => {
        if (!stored || get().activeProjectId !== target.id) return;
        const storedDur = stored.duration && stored.duration > 0 ? stored.duration : null;
        set({
          audioUrl: stored.url,
          audioFileName: stored.fileName,
          audioWaveform: stored.waveform,
          audioDuration: storedDur ?? get().audioDuration,
          duration: storedDur ? Number(storedDur.toFixed(2)) : get().duration,
          useDemoBeat: false,
        });

        // Re-decode from raw audio blob to guarantee exact sample-aligned waveform & duration
        try {
          const decoded = await decodeAudioWaveform(stored.blob);
          if (get().activeProjectId === target.id && decoded.duration > 0) {
            const exactDur = Number(decoded.duration.toFixed(2));
            set({
              audioWaveform: decoded.peaks,
              audioDuration: decoded.duration,
              duration: exactDur,
            });
            saveProjectAudio(
              target.id,
              stored.blob,
              stored.fileName,
              stored.blob.type || 'audio/mpeg',
              decoded.peaks,
              decoded.duration
            ).catch(() => {});
          }
        } catch {}
      })
      .catch((err) => {
        console.warn('Failed to restore project audio:', err);
      });
  },

  closeProjectToHome: () => {
    savedRefs = null;
    const currentAudio = get().audioUrl;
    if (currentAudio && currentAudio.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(currentAudio);
      } catch {}
    }
    set({
      activeProjectId: null,
      associatedFilePath: null,
      isPlaying: false,
      saveToast: null,
      audioDuration: null,
      audioUrl: null,
      audioFileName: null,
      audioWaveform: [],
    });
  },

  createNewProject: (name, cols, rows, dancerCount, theme) => {
    const id = `proj_${Date.now()}`;
    const count = Math.max(1, Math.min(80, dancerCount));
    const performers: Performer[] = Array.from({ length: count }, (_, idx) => ({
      id: `p_${idx + 1}`,
      name: `Dancer ${idx + 1}`,
      color: DEFAULT_DANCER_COLOR,
    }));

    const stageW = Number((cols * GRID_UNIT_M).toFixed(2));
    const stageD = Number((rows * GRID_UNIT_M).toFixed(2));
    const initialPos: Record<string, Position2D> = {};
    const initialColors: Record<string, string> = {};
    const perRow = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(count * 1.6))));
    const totalRows = Math.ceil(count / perRow);
    performers.forEach((p, idx) => {
      const rIdx = Math.floor(idx / perRow);
      const cIdx = idx % perRow;
      const colsInThisRow =
        rIdx === totalRows - 1 ? count - rIdx * perRow : perRow;
      const spanX = Math.min(stageW - 1.2, Math.max(0, (colsInThisRow - 1) * 1.1));
      const spanZ = Math.min(stageD - 1.4, Math.max(0, (totalRows - 1) * 1.0));
      const rawX =
        colsInThisRow <= 1 ? 0 : -spanX / 2 + (cIdx / (colsInThisRow - 1)) * spanX;
      const rawZ =
        totalRows <= 1 ? 0 : spanZ / 2 - (rIdx / (totalRows - 1)) * spanZ;
      initialPos[p.id] = {
        x: Number((Math.round(rawX / 0.45) * 0.45).toFixed(2)),
        z: Number((Math.round(rawZ / 0.45) * 0.45).toFixed(2)),
      };
      initialColors[p.id] = DEFAULT_DANCER_COLOR;
    });

    const f1: FormationItem = {
      id: 'f1',
      name: 'Formation 1: 初期配置',
      notes: '',
      positions: initialPos,
      colors: initialColors,
    };

    const layouts = createDefaultGroupLayouts(stageW, stageD);
    const fixtures = repositionAllFixtures(DEFAULT_FIXTURES, layouts, stageW, stageD);

    const lp1: LightingPreset = {
      id: 'lp1',
      name: 'Preset 1: 基本点灯',
      ambientIntensity: 0.35,
      ambientColor: '#1e293b',
      lights: buildLightsMap(fixtures, {
        front_sus: { enabled: true, color: '#fef08a', intensity: 2.2, angle: 0.52 },
        center_sus: { enabled: true, color: '#f8fafc', intensity: 1.8, angle: 0.52 },
        back_sus: { enabled: true, color: '#38bdf8', intensity: 2.0, angle: 0.55 },
      }),
    };

    const lpBlackout: LightingPreset = {
      id: 'lp_blackout',
      name: 'Preset 2: 暗転 (Blackout)',
      ambientIntensity: 0.02,
      ambientColor: '#020617',
      lights: buildLightsMap(fixtures, {}),
    };

    const nowStr = new Date().toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newProj: ProjectData = {
      id,
      projectName: name.trim() || '新規パフォーマンスプロジェクト',
      updatedAt: nowStr,
      stageGridCols: cols,
      stageGridRows: rows,
      wingGridCols: 2,
      stageTheme: theme,
      stageInverted: false,
      ambientIntensity: 0.35,
      ambientColor: '#1e293b',
      groupLayouts: layouts,
      performers,
      formations: [f1],
      lightFixtures: fixtures,
      lightingPresets: [lp1, lpBlackout],
      formationCues: [{ id: 'fc1', time: 0, duration: 4.0, formationId: 'f1' }],
      lightingCues: [{ id: 'lc1', time: 0, duration: 4.0, presetId: 'lp1' }],
      duration: 180, // Default 3 minutes (adjustable for ~5min audio)
    };

    const nextProjects = [newProj, ...get().projects];
    saveProjectsToStorage(nextProjects);
    set({ projects: nextProjects });
    get().openProject(id);
  },

  duplicateProject: (projectId) => {
    const s = get();
    const orig = s.projects.find((p) => p.id === projectId);
    if (!orig) return;
    const copyId = `proj_${Date.now()}`;
    const copy: ProjectData = {
      ...JSON.parse(JSON.stringify(orig)),
      id: copyId,
      projectName: `${orig.projectName} (コピー)`,
      updatedAt: new Date().toLocaleString('ja-JP'),
    };
    const nextProjects = [copy, ...s.projects];
    saveProjectsToStorage(nextProjects);
    set({ projects: nextProjects });
    cloneProjectAudio(orig.id, copyId).catch(() => {});
  },

  deleteProject: (projectId) => {
    const s = get();
    const nextProjects = s.projects.filter((p) => p.id !== projectId);
    saveProjectsToStorage(nextProjects);
    set({ projects: nextProjects });
    deleteProjectAudio(projectId).catch(() => {});
  },

  setProjectName: (projectName) => {
    set({ projectName });
  },
  setCurrentStep: (currentStep) => {
    set({ currentStep, isPlaying: false });
  },
  setViewportMode: (viewportMode) => set({ viewportMode }),
  setShowPdfModal: (showPdfModal) => set({ showPdfModal }),
  setSnapToGrid: (snapToGrid) => set({ snapToGrid }),
  setShowPaths: (showPaths) => set({ showPaths }),
  setShowLightBeams: (showLightBeams) => set({ showLightBeams }),
  setShowDancerNames: (showDancerNames) => {
    set({ showDancerNames });
  },
  setDancerScale: (dancerScale) => {
    set({ dancerScale: Math.max(0.35, Math.min(1.4, Number(dancerScale.toFixed(2)))) });
  },
  setTimelineZoom: (timelineZoom) =>
    set({ timelineZoom: Math.max(1, Math.min(40, Math.round(timelineZoom * 10) / 10)) }),
  setIsRecordingVideo: (isRecordingVideo) => set({ isRecordingVideo }),
  setGraphicsPreset: (preset) => {
    const next = { ...GRAPHICS_PRESETS[preset] };
    saveGraphicsSettings(next);
    set({ graphicsSettings: next });
  },
  updateGraphicsSettings: (patch) => {
    const current = get().graphicsSettings;
    const next: GraphicsSettings = {
      ...current,
      ...patch,
      preset: 'custom',
    };
    saveGraphicsSettings(next);
    set({ graphicsSettings: next });
  },

  // Automatically reposition all lights when stage dimensions change!
  setStageGridDimensions: (cols, rows, wingCols) => {
    get().pushHistorySnapshot();
    set((state) => {
      const c = Math.max(6, Math.min(28, cols));
      const r = Math.max(4, Math.min(20, rows));
      const w = wingCols !== undefined ? Math.max(1, Math.min(6, wingCols)) : state.wingGridCols;
      const newWidth = Number((c * GRID_UNIT_M).toFixed(2));
      const newDepth = Number((r * GRID_UNIT_M).toFixed(2));
      const newWingWidth = Number((w * GRID_UNIT_M).toFixed(2));

      const scaleX = state.stageWidth > 0 ? newWidth / state.stageWidth : 1;
      const scaleZ = state.stageDepth > 0 ? newDepth / state.stageDepth : 1;

      const nextLayouts: Record<LightGroupId, LightGroupLayout> = {
        ...state.groupLayouts,
      };
      (Object.keys(nextLayouts) as LightGroupId[]).forEach((gid) => {
        const cur = nextLayouts[gid];
        if (gid === 'side_spot' || gid === 'side_foot') {
          nextLayouts[gid] = {
            ...cur,
            spacing: Number((cur.spacing * scaleZ).toFixed(2)),
            offsetZ: Number((cur.offsetZ * scaleZ).toFixed(2)),
          };
        } else if (gid === 'pinspot') {
          nextLayouts[gid] = {
            ...cur,
            spacing: Number((cur.spacing * scaleX).toFixed(2)),
            offsetZ: Number((newDepth / 2 + 1.4).toFixed(2)),
          };
        } else if (gid === 'front_foot') {
          nextLayouts[gid] = {
            ...cur,
            spacing: Number((cur.spacing * scaleX).toFixed(2)),
            offsetZ: Number((newDepth / 2 - 0.2).toFixed(2)),
          };
        } else if (gid === 'back_foot' || gid === 'back_upper') {
          nextLayouts[gid] = {
            ...cur,
            spacing: Number((cur.spacing * scaleX).toFixed(2)),
            offsetZ: Number((-newDepth / 2 + 0.2).toFixed(2)),
          };
        } else {
          // front_sus, back_sus
          nextLayouts[gid] = {
            ...cur,
            spacing: Number((cur.spacing * scaleX).toFixed(2)),
            offsetZ: Number((cur.offsetZ * scaleZ).toFixed(2)),
          };
        }
      });

      const nextFixtures = repositionAllFixtures(
        state.lightFixtures,
        nextLayouts,
        newWidth,
        newDepth
      );

      // Update default targets in presets for lights not manually aimed at a performer
      const fixtureMap = Object.fromEntries(nextFixtures.map((f) => [f.id, f]));
      const nextPresets = state.lightingPresets.map((preset) => {
        const nextLights = { ...preset.lights };
        Object.keys(nextLights).forEach((fid) => {
          const fx = fixtureMap[fid];
          const cfg = nextLights[fid];
          if (fx && cfg && !cfg.followPerformerId && fx.groupId !== 'pinspot') {
            nextLights[fid] = {
              ...cfg,
              targetX: fx.defaultTarget[0],
              targetZ: fx.defaultTarget[2],
            };
          }
        });
        return { ...preset, lights: nextLights };
      });

      return {
        stageGridCols: c,
        stageGridRows: r,
        wingGridCols: w,
        stageWidth: newWidth,
        stageDepth: newDepth,
        wingWidth: newWingWidth,
        groupLayouts: nextLayouts,
        lightFixtures: nextFixtures,
        lightingPresets: nextPresets,
      };
    });
  },

  setStageTheme: (stageTheme) => {
    get().pushHistorySnapshot();
    set({ stageTheme });
  },

  setStageInverted: (stageInverted) => {
    get().pushHistorySnapshot();
    set({ stageInverted });
  },

  flipStageOrientation: (flipPerformers: boolean) => {
    const s = get();
    s.pushHistorySnapshot();

    const newInverted = !s.stageInverted;

    if (flipPerformers) {
      // 各フォーメーションの全ダンサーの X 座標（左右）・Z 座標（前後）を両方反転 (x -> -x, z -> -z)
      const updatedFormations = s.formations.map((f) => {
        const updatedPositions: Record<string, Position2D> = {};
        Object.entries(f.positions).forEach(([dancerId, pos]) => {
          updatedPositions[dancerId] = {
            x: Number((-pos.x).toFixed(2)),
            z: Number((-pos.z).toFixed(2)),
          };
        });
        return {
          ...f,
          positions: updatedPositions,
        };
      });

      // 各照明プリセットのライト照射位置 (targetX, targetZ) も上下左右反転
      const updatedPresets = s.lightingPresets.map((preset) => {
        const updatedLights = { ...preset.lights };
        Object.entries(updatedLights).forEach(([fixtureId, cfg]) => {
          updatedLights[fixtureId] = {
            ...cfg,
            targetX: Number((-cfg.targetX).toFixed(2)),
            targetZ: Number((-cfg.targetZ).toFixed(2)),
          };
        });
        return {
          ...preset,
          lights: updatedLights,
        };
      });

      set({
        stageInverted: newInverted,
        formations: updatedFormations,
        lightingPresets: updatedPresets,
      });
    } else {
      // ステージの向きのみ反転（ダンサー座標は維持）
      set({
        stageInverted: newInverted,
      });
    }
  },

  setProjectAmbient: (ambientIntensity, ambientColor) => {
    set((state) => ({
      ambientIntensity: Math.max(0, Math.min(1.5, ambientIntensity)),
      ...(ambientColor ? { ambientColor } : {}),
    }));
  },

  setPerformerCount: (targetCount) => {
    get().pushHistorySnapshot();
    set((state) => {
      const clamped = Math.max(1, Math.min(80, targetCount));
      const current = state.performers;
      if (clamped === current.length) return state;

      if (clamped > current.length) {
        const added: Performer[] = [];
        const baseColor = current[0]?.color || DEFAULT_DANCER_COLOR;
        for (let i = current.length; i < clamped; i++) {
          added.push({
            id: `p_${Date.now()}_${i}`,
            name: `Dancer ${i + 1}`,
            color: baseColor,
          });
        }
        const nextPerformers = [...current, ...added];
        const perRow = Math.min(10, Math.max(5, Math.ceil(Math.sqrt(clamped * 1.5))));
        const nextFormations = state.formations.map((f) => {
          const nextPos = { ...f.positions };
          const nextColors = { ...(f.colors || {}) };
          added.forEach((p, idx) => {
            const totalIdx = current.length + idx;
            const col = totalIdx % perRow;
            const row = Math.floor(totalIdx / perRow);
            const rawX = (col - (perRow - 1) / 2) * 1.1;
            const rawZ = Math.max(
              -state.stageDepth / 2 + 0.45,
              state.stageDepth / 2 - 0.9 - row * 0.9
            );
            nextPos[p.id] = {
              x: Number((Math.round(rawX / 0.45) * 0.45).toFixed(2)),
              z: Number((Math.round(rawZ / 0.45) * 0.45).toFixed(2)),
            };
            nextColors[p.id] = baseColor;
          });
          return { ...f, positions: nextPos, colors: nextColors };
        });
        return { performers: nextPerformers, formations: nextFormations };
      } else {
        const kept = current.slice(0, clamped);
        const keptIds = new Set(kept.map((p) => p.id));
        const nextFormations = state.formations.map((f) => {
          const nextPos: Record<string, Position2D> = {};
          const nextColors: Record<string, string> = {};
          Object.entries(f.positions).forEach(([pid, pos]) => {
            if (keptIds.has(pid)) nextPos[pid] = pos;
          });
          Object.entries(f.colors || {}).forEach(([pid, col]) => {
            if (keptIds.has(pid)) nextColors[pid] = col;
          });
          return { ...f, positions: nextPos, colors: nextColors };
        });
        const nextSelectedIds = state.selectedPerformerIds.filter((id) =>
          keptIds.has(id)
        );
        const fallbackId = kept[0]?.id || null;
        return {
          performers: kept,
          formations: nextFormations,
          selectedPerformerId: keptIds.has(state.selectedPerformerId || '')
            ? state.selectedPerformerId
            : fallbackId,
          selectedPerformerIds:
            nextSelectedIds.length > 0
              ? nextSelectedIds
              : fallbackId
              ? [fallbackId]
              : [],
        };
      }
    });
  },

  addPerformer: (name, color) => {
    const state = get();
    if (state.performers.length >= 80) return;
    get().pushHistorySnapshot();
    const idx = state.performers.length;
    const id = `p_${Date.now()}`;
    const baseColor = color || state.performers[0]?.color || DEFAULT_DANCER_COLOR;
    const newPerf: Performer = {
      id,
      name: name?.trim() || `Dancer ${idx + 1}`,
      color: baseColor,
    };
    set({
      performers: [...state.performers, newPerf],
      formations: state.formations.map((f) => ({
        ...f,
        positions: { ...f.positions, [id]: { x: 0, z: 0 } },
        colors: { ...(f.colors || {}), [id]: baseColor },
      })),
      selectedPerformerId: id,
      selectedPerformerIds: [id],
    });
  },

  updatePerformer: (id, patch) =>
    set((state) => ({
      performers: state.performers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    })),

  updateSelectedPerformersColor: (color) => {
    get().pushHistorySnapshot();
    set((state) => {
      const selSet = new Set(state.selectedPerformerIds);
      if (selSet.size === 0) return state;
      return {
        formations: state.formations.map((f) => {
          if (f.id !== state.activeFormationId) return f;
          const nextColors = { ...(f.colors || {}) };
          selSet.forEach((pid) => {
            nextColors[pid] = color;
          });
          return { ...f, colors: nextColors };
        }),
      };
    });
  },

  resetFormationColors: (formationId, color) => {
    get().pushHistorySnapshot();
    set((state) => ({
      formations: state.formations.map((f) => {
        if (f.id !== formationId) return f;
        const nextColors: Record<string, string> = {};
        state.performers.forEach((p) => {
          nextColors[p.id] = color || p.color || DEFAULT_DANCER_COLOR;
        });
        return { ...f, colors: nextColors };
      }),
    }));
  },

  removePerformer: (id) => {
    get().pushHistorySnapshot();
    set((state) => {
      if (state.performers.length <= 1) return state;
      const nextPerformers = state.performers.filter((p) => p.id !== id);
      const nextFormations = state.formations.map((f) => {
        const nextPos = { ...f.positions };
        delete nextPos[id];
        return { ...f, positions: nextPos };
      });
      const nextSelIds = state.selectedPerformerIds.filter((x) => x !== id);
      const nextPrimary =
        state.selectedPerformerId === id
          ? nextSelIds[0] || nextPerformers[0]?.id || null
          : state.selectedPerformerId;
      return {
        performers: nextPerformers,
        formations: nextFormations,
        selectedPerformerId: nextPrimary,
        selectedPerformerIds:
          nextSelIds.length > 0 ? nextSelIds : nextPrimary ? [nextPrimary] : [],
      };
    });
  },

  selectPerformer: (id, toggle = false) =>
    set((state) => {
      if (!id) {
        return { selectedPerformerId: null, selectedPerformerIds: [] };
      }
      if (toggle) {
        const exists = state.selectedPerformerIds.includes(id);
        const nextIds = exists
          ? state.selectedPerformerIds.filter((x) => x !== id)
          : [...state.selectedPerformerIds, id];
        return {
          selectedPerformerIds: nextIds,
          selectedPerformerId: nextIds[nextIds.length - 1] || null,
        };
      }
      return {
        selectedPerformerId: id,
        selectedPerformerIds: [id],
      };
    }),

  selectPerformersByIds: (ids) =>
    set({
      selectedPerformerIds: ids,
      selectedPerformerId: ids[0] || null,
    }),

  selectFormation: (activeFormationId) => set({ activeFormationId }),

  addFormation: () => {
    get().pushHistorySnapshot();
    set((state) => {
      const current =
        state.formations.find((f) => f.id === state.activeFormationId) ||
        state.formations[state.formations.length - 1];
      const id = `f_${Date.now()}`;
      const num = state.formations.length + 1;
      const newFormation: FormationItem = {
        id,
        name: `Formation ${num}`,
        notes: '',
        positions: JSON.parse(JSON.stringify(current.positions)),
        colors: JSON.parse(JSON.stringify(current.colors || {})),
      };
      return {
        formations: [...state.formations, newFormation],
        activeFormationId: id,
      };
    });
  },

  duplicateFormation: (targetId) => {
    get().pushHistorySnapshot();
    set((state) => {
      const idx = state.formations.findIndex((f) => f.id === targetId);
      if (idx === -1) return state;
      const orig = state.formations[idx];
      const id = `f_${Date.now()}`;
      const copy: FormationItem = {
        id,
        name: `${orig.name} (コピー)`,
        notes: orig.notes,
        positions: JSON.parse(JSON.stringify(orig.positions)),
        colors: JSON.parse(JSON.stringify(orig.colors || {})),
      };
      const next = [...state.formations];
      next.splice(idx + 1, 0, copy);
      return { formations: next, activeFormationId: id };
    });
  },

  updateFormation: (id, patch) =>
    set((state) => ({
      formations: state.formations.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    })),

  deleteFormation: (id) => {
    if (get().formations.length <= 1) return;
    get().pushHistorySnapshot();
    set((state) => {
      if (state.formations.length <= 1) return state;
      const next = state.formations.filter((f) => f.id !== id);
      const fallbackId = next[0].id;
      return {
        formations: next,
        activeFormationId: state.activeFormationId === id ? fallbackId : state.activeFormationId,
        formationCues: state.formationCues.map((c) =>
          c.formationId === id ? { ...c, formationId: fallbackId } : c
        ),
      };
    });
  },

  moveFormationOrder: (id, dir) => {
    get().pushHistorySnapshot();
    set((state) => {
      const idx = state.formations.findIndex((f) => f.id === id);
      if (idx === -1) return state;
      const targetIdx = dir === 'left' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= state.formations.length) return state;
      const next = [...state.formations];
      const [item] = next.splice(idx, 1);
      next.splice(targetIdx, 0, item);
      return { formations: next };
    });
  },

  reorderFormations: (fromIndex, toIndex) => {
    const len = get().formations.length;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= len || toIndex >= len) {
      return;
    }
    get().pushHistorySnapshot();
    set((state) => {
      const next = [...state.formations];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { formations: next };
    });
  },

  updatePerformerPosition: (formationId, performerId, pos) =>
    set((state) => {
      const maxHalfW = state.stageWidth / 2 + state.wingWidth - 0.3;
      const halfD = state.stageDepth / 2;
      let x = Math.max(-maxHalfW, Math.min(maxHalfW, pos.x));
      let z = Math.max(-halfD, Math.min(halfD, pos.z));

      if (state.snapToGrid) {
        const snapStep = GRID_UNIT_M / 2; // 45cm (0.5 grid) snap
        x = Math.round(x / snapStep) * snapStep;
        z = Math.round(z / snapStep) * snapStep;
      }
      x = Number(x.toFixed(2));
      z = Number(z.toFixed(2));

      return {
        formations: state.formations.map((f) =>
          f.id === formationId
            ? { ...f, positions: { ...f.positions, [performerId]: { x, z } } }
            : f
        ),
      };
    }),

  moveSelectedPerformersByDelta: (formationId, dx, dz, basePositions) =>
    set((state) => {
      const maxHalfW = state.stageWidth / 2 + state.wingWidth - 0.3;
      const halfD = state.stageDepth / 2;
      const snapStep = GRID_UNIT_M / 2;

      return {
        formations: state.formations.map((f) => {
          if (f.id !== formationId) return f;
          const nextPositions = { ...f.positions };
          state.selectedPerformerIds.forEach((pid) => {
            const base = basePositions[pid] || f.positions[pid] || { x: 0, z: 0 };
            let nx = Math.max(-maxHalfW, Math.min(maxHalfW, base.x + dx));
            let nz = Math.max(-halfD, Math.min(halfD, base.z + dz));
            if (state.snapToGrid) {
              nx = Math.round(nx / snapStep) * snapStep;
              nz = Math.round(nz / snapStep) * snapStep;
            }
            nextPositions[pid] = {
              x: Number(nx.toFixed(2)),
              z: Number(nz.toFixed(2)),
            };
          });
          return { ...f, positions: nextPositions };
        }),
      };
    }),

  sendSelectedPerformersToWing: (formationId, side) => {
    get().pushHistorySnapshot();
    set((state) => {
      const dir = side === 'left' ? -1 : 1;
      const ids = state.selectedPerformerIds;
      if (ids.length === 0) return state;

      // Arrange dancers in a multi-column grid inside the wing so up to 80 dancers fit cleanly!
      const usableWingW = Math.max(0.7, state.wingWidth - 0.55);
      const usableDepth = Math.max(1.2, state.stageDepth - 0.9);
      const colsInWing = Math.max(
        1,
        Math.min(6, Math.ceil(Math.sqrt((ids.length * usableWingW) / usableDepth)))
      );
      const rowsInWing = Math.max(1, Math.ceil(ids.length / colsInWing));

      const wingInnerX = state.stageWidth / 2 + 0.35;
      const wingOuterX = state.stageWidth / 2 + Math.max(0.5, state.wingWidth - 0.32);

      return {
        formations: state.formations.map((f) => {
          if (f.id !== formationId) return f;
          const nextPositions = { ...f.positions };
          ids.forEach((pid, idx) => {
            const c = idx % colsInWing;
            const r = Math.floor(idx / colsInWing);
            const xMag =
              colsInWing <= 1
                ? (wingInnerX + wingOuterX) / 2
                : wingInnerX + (c / (colsInWing - 1)) * (wingOuterX - wingInnerX);
            const zVal =
              rowsInWing <= 1
                ? 0
                : -usableDepth / 2 + (r / (rowsInWing - 1)) * usableDepth;

            nextPositions[pid] = {
              x: Number((dir * xMag).toFixed(2)),
              z: Number(zVal.toFixed(2)),
            };
          });
          return { ...f, positions: nextPositions };
        }),
      };
    });
  },

  nudgeSelectedPerformer: (dx, dz) => {
    const s = get();
    const ids =
      s.selectedPerformerIds.length > 0
        ? s.selectedPerformerIds
        : s.selectedPerformerId
        ? [s.selectedPerformerId]
        : [];
    if (ids.length === 0 || !s.activeFormationId) return;
    const form = s.formations.find((f) => f.id === s.activeFormationId);
    if (!form) return;
    s.pushHistorySnapshot();
    s.moveSelectedPerformersByDelta(s.activeFormationId, dx, dz, form.positions);
  },

  applyFormationTemplate: (formationId, template) => {
    get().pushHistorySnapshot();
    set((state) => {
      // Only the selected dancers are arranged (all dancers when nothing is selected)
      const selectedSet = new Set(state.selectedPerformerIds);
      const targets =
        selectedSet.size > 0
          ? state.performers.filter((p) => selectedSet.has(p.id))
          : state.performers;
      if (targets.length === 0) return state;
      const isPartial = targets.length < state.performers.length;
      const targetForm = state.formations.find((f) => f.id === formationId);
      const count = targets.length;
      const positions: Record<string, Position2D> = {};
      const snap = (val: number) =>
        Number((Math.round(val / (GRID_UNIT_M / 2)) * (GRID_UNIT_M / 2)).toFixed(2));

      const usableWingW = Math.max(0.7, state.wingWidth - 0.55);
      const usableDepth = Math.max(1.2, state.stageDepth - 0.9);
      const perWingCount = Math.max(1, Math.ceil(count / 2));
      const colsInWing = Math.max(
        1,
        Math.min(5, Math.ceil(Math.sqrt((perWingCount * usableWingW) / usableDepth)))
      );
      const rowsInWing = Math.max(1, Math.ceil(perWingCount / colsInWing));
      const wingInnerX = state.stageWidth / 2 + 0.35;
      const wingOuterX = state.stageWidth / 2 + Math.max(0.5, state.wingWidth - 0.32);

      targets.forEach((p, idx) => {
        if (template === 'line-1') {
          const span = Math.min(state.stageWidth - 1.8, (count - 1) * 1.8);
          const x = count === 1 ? 0 : -span / 2 + (idx / (count - 1)) * span;
          positions[p.id] = { x: snap(x), z: snap(0.45) };
        } else if (template === 'line-2') {
          const frontCount = Math.ceil(count / 2);
          const backCount = count - frontCount;
          if (idx < frontCount) {
            const span = Math.min(state.stageWidth - 1.8, (frontCount - 1) * 1.8);
            const x = frontCount === 1 ? 0 : -span / 2 + (idx / (frontCount - 1)) * span;
            positions[p.id] = { x: snap(x), z: snap(1.35) };
          } else {
            const bIdx = idx - frontCount;
            const span = Math.min(state.stageWidth - 2.7, (backCount - 1) * 1.8);
            const x = backCount <= 1 ? 0 : -span / 2 + (bIdx / (backCount - 1)) * span;
            positions[p.id] = { x: snap(x), z: snap(-0.9) };
          }
        } else if (template === 'v-shape') {
          if (idx === 0) {
            positions[p.id] = { x: 0, z: snap(1.8) };
          } else {
            const pairIndex = Math.ceil(idx / 2);
            const side = idx % 2 === 1 ? -1 : 1;
            const maxPairs = Math.max(1, Math.ceil((count - 1) / 2));
            const stepX = Math.min(1.8, (state.stageWidth / 2 - 0.9) / maxPairs);
            const stepZ = Math.min(0.9, (state.stageDepth - 1.8) / maxPairs);
            positions[p.id] = {
              x: Number((side * pairIndex * stepX).toFixed(2)),
              z: Number((1.8 - pairIndex * stepZ).toFixed(2)),
            };
          }
        } else if (template === 'inv-v') {
          if (idx === 0) {
            positions[p.id] = { x: 0, z: snap(-1.8) };
          } else {
            const pairIndex = Math.ceil(idx / 2);
            const side = idx % 2 === 1 ? -1 : 1;
            const maxPairs = Math.max(1, Math.ceil((count - 1) / 2));
            const stepX = Math.min(1.8, (state.stageWidth / 2 - 0.9) / maxPairs);
            const stepZ = Math.min(0.9, (state.stageDepth - 1.8) / maxPairs);
            positions[p.id] = {
              x: Number((side * pairIndex * stepX).toFixed(2)),
              z: Number((-1.8 + pairIndex * stepZ).toFixed(2)),
            };
          }
        } else if (template === 'circle') {
          const radius = Math.min(state.stageWidth, state.stageDepth) * 0.34;
          const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
          positions[p.id] = {
            x: Number((Math.cos(angle) * radius).toFixed(2)),
            z: Number((Math.sin(angle) * radius).toFixed(2)),
          };
        } else if (template === 'diagonal') {
          const spanX = Math.min(state.stageWidth - 2.4, (count - 1) * 1.8);
          const spanZ = Math.min(state.stageDepth - 2.0, (count - 1) * 0.9);
          const t = count === 1 ? 0.5 : idx / (count - 1);
          positions[p.id] = {
            x: Number((-spanX / 2 + t * spanX).toFixed(2)),
            z: Number((-spanZ / 2 + t * spanZ).toFixed(2)),
          };
        } else if (template === 'wings-wait') {
          const side = idx % 2 === 0 ? -1 : 1;
          const idxOnSide = Math.floor(idx / 2);
          const c = idxOnSide % colsInWing;
          const r = Math.floor(idxOnSide / colsInWing);
          const xMag =
            colsInWing <= 1
              ? (wingInnerX + wingOuterX) / 2
              : wingInnerX + (c / (colsInWing - 1)) * (wingOuterX - wingInnerX);
          const zVal =
            rowsInWing <= 1
              ? 0
              : -usableDepth / 2 + (r / (rowsInWing - 1)) * usableDepth;
          positions[p.id] = {
            x: Number((side * xMag).toFixed(2)),
            z: Number(zVal.toFixed(2)),
          };
        }
      });

      // For a partial selection, place the shape around the selected dancers' current center
      if (isPartial && template !== 'wings-wait' && targetForm) {
        let cx = 0;
        let cz = 0;
        targets.forEach((p) => {
          const cur = targetForm.positions[p.id] || { x: 0, z: 0 };
          cx += cur.x;
          cz += cur.z;
        });
        cx /= count;
        cz /= count;
        let sx = 0;
        let sz = 0;
        targets.forEach((p) => {
          sx += positions[p.id].x;
          sz += positions[p.id].z;
        });
        const dx = snap(cx - sx / count);
        const dz = snap(cz - sz / count);
        const maxX = state.stageWidth / 2 + state.wingWidth - 0.3;
        const maxZ = state.stageDepth / 2 - 0.3;
        targets.forEach((p) => {
          const pos = positions[p.id];
          positions[p.id] = {
            x: Number(Math.max(-maxX, Math.min(maxX, pos.x + dx)).toFixed(2)),
            z: Number(Math.max(-maxZ, Math.min(maxZ, pos.z + dz)).toFixed(2)),
          };
        });
      }

      return {
        formations: state.formations.map((f) =>
          f.id === formationId
            ? { ...f, positions: { ...f.positions, ...positions } }
            : f
        ),
      };
    });
  },

  selectPreset: (activePresetId) => set({ activePresetId }),
  selectGroup: (selectedGroupId) => set({ selectedGroupId, selectedLightId: null }),
  selectLight: (selectedLightId) => {
    if (!selectedLightId) {
      set({ selectedLightId: null });
      return;
    }
    const fix = get().lightFixtures.find((f) => f.id === selectedLightId);
    set({
      selectedLightId,
      ...(fix ? { selectedGroupId: fix.groupId } : {}),
    });
  },

  // Add a new light fixture to the specified group and recalculate positions
  addFixtureToGroup: (groupId) => {
    get().pushHistorySnapshot();
    set((state) => {
      const groupList = state.lightFixtures.filter((f) => f.groupId === groupId);
      if (groupList.length >= 16) return state;

      const grpNameMap: Record<LightGroupId, string> = {
        pinspot: 'ピンスポ',
        front_sus: 'フロントサス',
        center_sus: 'センターサス',
        back_sus: 'バックサス',
        side_spot: 'サイドスポット',
        side_foot: 'サイドフット',
        front_foot: '前フット',
        back_foot: 'バックフット',
        back_upper: 'バックフット上',
      };

      const newIdx = groupList.length;
      const newId = `${groupId}_${Date.now()}`;
      const newFix: LightFixture = {
        id: newId,
        groupId,
        name: `${grpNameMap[groupId]} #${newIdx + 1}`,
        indexInGroup: newIdx,
        mountPosition: [0, state.groupLayouts[groupId].height, state.groupLayouts[groupId].offsetZ],
        defaultTarget: [0, 0, 0],
      };

      // Update spacing automatically so the added fixture fits nicely within the stage
      const nextCount = groupList.length + 1;
      const nextLayouts = { ...state.groupLayouts };
      if (groupId !== 'side_spot' && groupId !== 'side_foot' && nextCount > 1) {
        const maxSpan = Math.max(2.0, state.stageWidth - 1.8);
        if ((nextCount - 1) * nextLayouts[groupId].spacing > maxSpan) {
          nextLayouts[groupId] = {
            ...nextLayouts[groupId],
            spacing: Number((maxSpan / (nextCount - 1)).toFixed(2)),
          };
        }
      }

      const combined = [...state.lightFixtures, newFix];
      const nextFixtures = repositionAllFixtures(
        combined,
        nextLayouts,
        state.stageWidth,
        state.stageDepth
      );
      const updatedNewFix = nextFixtures.find((f) => f.id === newId) || newFix;

      // Copy settings from the first fixture of this group in each preset
      const repFixId = groupList[0]?.id;
      const nextPresets = state.lightingPresets.map((preset) => {
        const repCfg = repFixId ? preset.lights[repFixId] : undefined;
        const newCfg: LightConfig = {
          enabled: repCfg ? repCfg.enabled : true,
          color: repCfg ? repCfg.color : '#ffffff',
          rainbow: repCfg ? repCfg.rainbow : false,
          intensity: repCfg ? repCfg.intensity : 2.2,
          angle: repCfg ? repCfg.angle : groupId === 'pinspot' ? 0.18 : 0.48,
          targetX: updatedNewFix.defaultTarget[0],
          targetZ: updatedNewFix.defaultTarget[2],
          followPerformerId: null,
        };
        const nextLights = { ...preset.lights, [newId]: newCfg };
        // Also update non-pinspot default targets for existing fixtures in this group
        nextFixtures
          .filter((f) => f.groupId === groupId)
          .forEach((fx) => {
            if (nextLights[fx.id] && !nextLights[fx.id].followPerformerId && groupId !== 'pinspot') {
              nextLights[fx.id] = {
                ...nextLights[fx.id],
                targetX: fx.defaultTarget[0],
                targetZ: fx.defaultTarget[2],
              };
            }
          });
        return { ...preset, lights: nextLights };
      });

      return {
        groupLayouts: nextLayouts,
        lightFixtures: nextFixtures,
        lightingPresets: nextPresets,
        selectedLightId: newId,
      };
    });
  },

  removeFixtureFromGroup: (groupId) => {
    get().pushHistorySnapshot();
    set((state) => {
      const groupList = state.lightFixtures.filter((f) => f.groupId === groupId);
      if (groupList.length <= 1) return state;
      const removed = groupList[groupList.length - 1];
      const remaining = state.lightFixtures.filter((f) => f.id !== removed.id);
      const nextFixtures = repositionAllFixtures(
        remaining,
        state.groupLayouts,
        state.stageWidth,
        state.stageDepth
      );
      const nextPresets = state.lightingPresets.map((preset) => {
        const nextLights = { ...preset.lights };
        delete nextLights[removed.id];
        return { ...preset, lights: nextLights };
      });
      return {
        lightFixtures: nextFixtures,
        lightingPresets: nextPresets,
        selectedLightId:
          state.selectedLightId === removed.id ? null : state.selectedLightId,
      };
    });
  },

  updateGroupLayout: (groupId, patch) =>
    set((state) => {
      const nextLayouts = {
        ...state.groupLayouts,
        [groupId]: {
          ...state.groupLayouts[groupId],
          ...patch,
        },
      };
      const nextFixtures = repositionAllFixtures(
        state.lightFixtures,
        nextLayouts,
        state.stageWidth,
        state.stageDepth
      );
      const nextPresets = state.lightingPresets.map((preset) => {
        const nextLights = { ...preset.lights };
        nextFixtures
          .filter((f) => f.groupId === groupId)
          .forEach((fx) => {
            if (nextLights[fx.id] && !nextLights[fx.id].followPerformerId && groupId !== 'pinspot') {
              nextLights[fx.id] = {
                ...nextLights[fx.id],
                targetX: fx.defaultTarget[0],
                targetZ: fx.defaultTarget[2],
              };
            }
          });
        return { ...preset, lights: nextLights };
      });
      return {
        groupLayouts: nextLayouts,
        lightFixtures: nextFixtures,
        lightingPresets: nextPresets,
      };
    }),

  autoFitGroupSpacing: (groupId) => {
    const state = get();
    state.pushHistorySnapshot();
    const count = state.lightFixtures.filter((f) => f.groupId === groupId).length;
    if (groupId === 'side_spot' || groupId === 'side_foot') {
      const perSide = Math.max(1, Math.ceil(count / 2));
      const spacing =
        perSide <= 1
          ? 2.0
          : Number(((state.stageDepth - 1.8) / (perSide - 1)).toFixed(2));
      state.updateGroupLayout(groupId, { spacing, offsetZ: 0 });
    } else {
      const spacing =
        count <= 1
          ? 2.0
          : Number(((state.stageWidth - 1.8) / (count - 1)).toFixed(2));
      state.updateGroupLayout(groupId, { spacing });
    }
  },

  updateFixturePosition: (lightId, mountPosition) =>
    set((state) => ({
      lightFixtures: state.lightFixtures.map((f) =>
        f.id === lightId ? { ...f, mountPosition } : f
      ),
    })),

  addLightingPreset: () => {
    get().pushHistorySnapshot();
    set((state) => {
      const current =
        state.lightingPresets.find((p) => p.id === state.activePresetId) ||
        state.lightingPresets[0];
      const id = `lp_${Date.now()}`;
      const num = state.lightingPresets.length + 1;
      const newPreset: LightingPreset = {
        id,
        name: `Preset ${num}: カスタム照明`,
        ambientIntensity: state.ambientIntensity,
        ambientColor: state.ambientColor,
        lights: JSON.parse(JSON.stringify(current.lights)),
      };
      return {
        lightingPresets: [...state.lightingPresets, newPreset],
        activePresetId: id,
      };
    });
  },

  duplicateLightingPreset: (targetId) => {
    get().pushHistorySnapshot();
    set((state) => {
      const idx = state.lightingPresets.findIndex((p) => p.id === targetId);
      if (idx === -1) return state;
      const orig = state.lightingPresets[idx];
      const id = `lp_${Date.now()}`;
      const copy: LightingPreset = {
        id,
        name: `${orig.name} (コピー)`,
        ambientIntensity: orig.ambientIntensity,
        ambientColor: orig.ambientColor,
        lights: JSON.parse(JSON.stringify(orig.lights)),
      };
      const next = [...state.lightingPresets];
      next.splice(idx + 1, 0, copy);
      return {
        lightingPresets: next,
        activePresetId: id,
      };
    });
  },

  updateLightingPreset: (id, patch) =>
    set((state) => ({
      lightingPresets: state.lightingPresets.map((p) =>
        p.id === id ? { ...p, ...patch } : p
      ),
    })),

  deleteLightingPreset: (id) => {
    if (get().lightingPresets.length <= 1) return;
    get().pushHistorySnapshot();
    set((state) => {
      if (state.lightingPresets.length <= 1) return state;
      const next = state.lightingPresets.filter((p) => p.id !== id);
      const fallbackId = next[0].id;
      return {
        lightingPresets: next,
        activePresetId: state.activePresetId === id ? fallbackId : state.activePresetId,
        lightingCues: state.lightingCues.map((c) =>
          c.presetId === id ? { ...c, presetId: fallbackId } : c
        ),
      };
    });
  },

  reorderLightingPresets: (fromIndex, toIndex) => {
    const len = get().lightingPresets.length;
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= len || toIndex >= len) {
      return;
    }
    get().pushHistorySnapshot();
    set((state) => {
      const next = [...state.lightingPresets];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return { lightingPresets: next };
    });
  },

  updateLightGroupConfig: (presetId, groupId, patch) =>
    set((state) => {
      const groupFixtureIds = state.lightFixtures
        .filter((f) => f.groupId === groupId)
        .map((f) => f.id);

      return {
        selectedLightId: null,
        lightingPresets: state.lightingPresets.map((preset) => {
          if (preset.id !== presetId) return preset;
          const nextLights = { ...preset.lights };
          groupFixtureIds.forEach((fid) => {
            if (nextLights[fid]) {
              nextLights[fid] = { ...nextLights[fid], ...patch };
            }
          });
          return { ...preset, lights: nextLights };
        }),
      };
    }),

  updateLightConfig: (presetId, lightId, patch) =>
    set((state) => ({
      lightingPresets: state.lightingPresets.map((preset) =>
        preset.id === presetId
          ? {
              ...preset,
              lights: {
                ...preset.lights,
                [lightId]: {
                  ...preset.lights[lightId],
                  ...patch,
                },
              },
            }
          : preset
      ),
    })),

  copySelectedPerformers: () => {
    const s = get();
    const activeForm = s.formations.find((f) => f.id === s.activeFormationId);
    if (!activeForm) return;
    const ids =
      s.selectedPerformerIds.length > 0
        ? s.selectedPerformerIds
        : s.selectedPerformerId
        ? [s.selectedPerformerId]
        : [];
    if (ids.length === 0) return;

    const copied: Record<string, Position2D> = {};
    ids.forEach((id) => {
      const pos = activeForm.positions[id];
      if (pos) {
        copied[id] = { x: pos.x, z: pos.z };
      }
    });
    const count = Object.keys(copied).length;
    if (count === 0) return;

    set({
      copiedDancerPositions: copied,
      saveToast: {
        message: `ダンサー ${count}人の立ち位置・形状をコピーしました (Ctrl+Vで貼り付け)`,
        type: 'info',
      },
    });
  },

  pasteCopiedPerformers: () => {
    const s = get();
    const copied = s.copiedDancerPositions;
    if (!copied) return;
    const pastedIds = Object.keys(copied).filter((id) =>
      s.performers.some((p) => p.id === id)
    );
    if (pastedIds.length === 0) return;
    const activeForm = s.formations.find((f) => f.id === s.activeFormationId);
    if (!activeForm) return;

    s.pushHistorySnapshot();
    const nextPositions: Record<string, Position2D> = {
      ...activeForm.positions,
    };
    pastedIds.forEach((id) => {
      nextPositions[id] = { x: copied[id].x, z: copied[id].z };
    });

    set((state) => ({
      formations: state.formations.map((f) =>
        f.id === state.activeFormationId ? { ...f, positions: nextPositions } : f
      ),
      selectedPerformerId: pastedIds[0] || state.selectedPerformerId,
      selectedPerformerIds: pastedIds,
      saveToast: {
        message: `ダンサー ${pastedIds.length}人を同じ形状・場所へペーストしました`,
        type: 'success',
      },
    }));
  },

  copySelectedLighting: () => {
    const s = get();
    const activePreset = s.lightingPresets.find((p) => p.id === s.activePresetId);
    if (!activePreset) return;

    const grpInfo =
      LIGHT_GROUPS.find((g) => g.id === s.selectedGroupId) || LIGHT_GROUPS[0];
    const groupName = grpInfo.name.replace(/\s*\(.*?\)$/, '');
    const groupFixtures = s.lightFixtures.filter(
      (f) => f.groupId === s.selectedGroupId
    );
    const groupConfigs: Record<string, LightConfig> = {};
    groupFixtures.forEach((fx) => {
      const cfg = activePreset.lights[fx.id];
      if (cfg) {
        groupConfigs[fx.id] = JSON.parse(JSON.stringify(cfg));
      }
    });

    if (s.selectedLightId) {
      const singleFix = s.lightFixtures.find((f) => f.id === s.selectedLightId);
      const singleCfg = singleFix ? activePreset.lights[singleFix.id] : undefined;
      if (singleFix && singleCfg) {
        set({
          copiedLightingClipboard: {
            mode: 'fixture',
            groupId: singleFix.groupId,
            groupName,
            fixtureId: singleFix.id,
            fixtureName: singleFix.name,
            groupConfigs,
            singleConfig: JSON.parse(JSON.stringify(singleCfg)),
          },
          saveToast: {
            message: `照明「${singleFix.name}」の設定をコピーしました (Ctrl+Vで貼り付け)`,
            type: 'info',
          },
        });
        return;
      }
    }

    if (Object.keys(groupConfigs).length === 0) return;

    set({
      copiedLightingClipboard: {
        mode: 'group',
        groupId: s.selectedGroupId,
        groupName,
        groupConfigs,
      },
      saveToast: {
        message: `照明「${groupName}」の設定をコピーしました (Ctrl+Vで他プリセットに貼り付け)`,
        type: 'info',
      },
    });
  },

  pasteCopiedLighting: () => {
    const s = get();
    const clip = s.copiedLightingClipboard;
    if (!clip) return;
    const activePreset = s.lightingPresets.find((p) => p.id === s.activePresetId);
    if (!activePreset) return;

    s.pushHistorySnapshot();

    if (clip.mode === 'fixture' && clip.singleConfig) {
      const targetId = s.selectedLightId || clip.fixtureId;
      const targetFix = targetId
        ? s.lightFixtures.find((f) => f.id === targetId)
        : null;
      if (targetFix && activePreset.lights[targetFix.id]) {
        const cloned: LightConfig = JSON.parse(JSON.stringify(clip.singleConfig));
        // If pasting to a different fixture, keep its own default target unless following a performer
        if (targetFix.id !== clip.fixtureId && !cloned.followPerformerId) {
          cloned.targetX = activePreset.lights[targetFix.id].targetX;
          cloned.targetZ = activePreset.lights[targetFix.id].targetZ;
        }
        set((state) => ({
          selectedGroupId: targetFix.groupId,
          selectedLightId: targetFix.id,
          lightingPresets: state.lightingPresets.map((p) =>
            p.id === state.activePresetId
              ? {
                  ...p,
                  lights: {
                    ...p.lights,
                    [targetFix.id]: cloned,
                  },
                }
              : p
          ),
          saveToast: {
            message: `照明「${targetFix.name}」に設定をペーストしました`,
            type: 'success',
          },
        }));
        return;
      }
    }

    // Group paste: apply copied group configs to the same group in the active preset
    const nextLights = { ...activePreset.lights };
    Object.entries(clip.groupConfigs).forEach(([fid, cfg]) => {
      if (nextLights[fid]) {
        nextLights[fid] = JSON.parse(JSON.stringify(cfg));
      }
    });

    set((state) => ({
      selectedGroupId: clip.groupId,
      selectedLightId: null,
      lightingPresets: state.lightingPresets.map((p) =>
        p.id === state.activePresetId ? { ...p, lights: nextLights } : p
      ),
      saveToast: {
        message: `照明「${clip.groupName}」の設定をペーストしました`,
        type: 'success',
      },
    }));
  },

  addFormationCue: (time, formationId, holdDuration = 3.0) => {
    get().pushHistorySnapshot();
    set((state) => {
      const id = `fc_${Date.now()}`;
      const hasAudio = Boolean(state.audioUrl || state.audioDuration);
      const nextDuration = hasAudio
        ? state.duration
        : Math.max(state.duration, Math.round(time * 100) / 100 + holdDuration + 2);
      const roundedTime = Math.max(0, Math.min(nextDuration - 0.01, Math.round(time * 100) / 100));
      const clampedHold = Math.max(
        0.01,
        Math.min(holdDuration, Math.round((nextDuration - roundedTime) * 100) / 100)
      );
      const next = [
        ...state.formationCues,
        { id, time: roundedTime, duration: clampedHold, formationId },
      ].sort((a, b) => a.time - b.time);
      return {
        formationCues: next,
        selectedFormationCueId: id,
        duration: nextDuration,
      };
    });
  },

  updateFormationCue: (id, patch) =>
    set((state) => ({
      formationCues: state.formationCues
        .map((c) => (c.id === id ? { ...c, ...patch } : c))
        .sort((a, b) => a.time - b.time),
    })),

  deleteFormationCue: (id) => {
    if (get().formationCues.length <= 1) return;
    get().pushHistorySnapshot();
    set((state) => {
      if (state.formationCues.length <= 1) return state;
      const next = state.formationCues.filter((c) => c.id !== id);
      return {
        formationCues: next,
        selectedFormationCueId:
          state.selectedFormationCueId === id ? next[0]?.id || null : state.selectedFormationCueId,
      };
    });
  },

  selectFormationCue: (selectedFormationCueId) => set({ selectedFormationCueId }),

  addLightingCue: (time, presetId, holdDuration = 3.0) => {
    get().pushHistorySnapshot();
    set((state) => {
      const id = `lc_${Date.now()}`;
      const hasAudio = Boolean(state.audioUrl || state.audioDuration);
      const nextDuration = hasAudio
        ? state.duration
        : Math.max(state.duration, Math.round(time * 100) / 100 + holdDuration + 2);
      const roundedTime = Math.max(0, Math.min(nextDuration - 0.01, Math.round(time * 100) / 100));
      const clampedHold = Math.max(
        0.01,
        Math.min(holdDuration, Math.round((nextDuration - roundedTime) * 100) / 100)
      );
      const next = [
        ...state.lightingCues,
        { id, time: roundedTime, duration: clampedHold, presetId },
      ].sort((a, b) => a.time - b.time);
      return {
        lightingCues: next,
        selectedLightingCueId: id,
        duration: nextDuration,
      };
    });
  },

  updateLightingCue: (id, patch) =>
    set((state) => ({
      lightingCues: state.lightingCues
        .map((c) => (c.id === id ? { ...c, ...patch } : c))
        .sort((a, b) => a.time - b.time),
    })),

  deleteLightingCue: (id) => {
    if (get().lightingCues.length <= 1) return;
    get().pushHistorySnapshot();
    set((state) => {
      if (state.lightingCues.length <= 1) return state;
      const next = state.lightingCues.filter((c) => c.id !== id);
      return {
        lightingCues: next,
        selectedLightingCueId:
          state.selectedLightingCueId === id ? next[0]?.id || null : state.selectedLightingCueId,
      };
    });
  },

  selectLightingCue: (selectedLightingCueId) => set({ selectedLightingCueId }),

  addTimelinePin: (time) => {
    const s = get();
    const rawTime = time !== undefined ? time : s.currentTime;
    const rounded = Math.round(Math.max(0, Math.min(s.duration, rawTime)) * 100) / 100;
    if (s.timelinePins.some((p) => Math.abs(p - rounded) < 0.005)) return;
    s.pushHistorySnapshot();
    const nextPins = [...s.timelinePins, rounded].sort((a, b) => a - b);
    set({ timelinePins: nextPins });
  },

  removePreviousTimelinePin: () => {
    const s = get();
    if (s.timelinePins.length === 0) return;
    const sorted = [...s.timelinePins].sort((a, b) => a - b);
    // Find the pin at or immediately before currentTime (with 0.08s tolerance),
    // or fallback to the last pin if currentTime is before all pins.
    const candidatesBefore = sorted.filter((p) => p <= s.currentTime + 0.08);
    const targetPin =
      candidatesBefore.length > 0
        ? candidatesBefore[candidatesBefore.length - 1]
        : sorted[sorted.length - 1];
    s.pushHistorySnapshot();
    const nextPins = sorted.filter((p) => Math.abs(p - targetPin) > 0.001);
    set({ timelinePins: nextPins });
  },

  removeTimelinePin: (time) => {
    const s = get();
    if (!s.timelinePins.some((p) => Math.abs(p - time) < 0.005)) return;
    s.pushHistorySnapshot();
    set({
      timelinePins: s.timelinePins.filter((p) => Math.abs(p - time) >= 0.005),
    });
  },

  jumpToPrevTimelinePin: () => {
    const s = get();
    const sorted = [...s.timelinePins].sort((a, b) => a - b);
    const prevPins = sorted.filter((p) => p < s.currentTime - 0.005);
    if (prevPins.length > 0) {
      const target = prevPins[prevPins.length - 1];
      set({ currentTime: target });
      return target;
    }
    return null;
  },

  jumpToNextTimelinePin: () => {
    const s = get();
    const sorted = [...s.timelinePins].sort((a, b) => a - b);
    const nextPins = sorted.filter((p) => p > s.currentTime + 0.005);
    if (nextPins.length > 0) {
      const target = nextPins[0];
      set({ currentTime: target });
      return target;
    }
    return null;
  },

  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setAudioData: (audioUrl, audioFileName, audioWaveform = [], newDuration) =>
    set((state) => {
      const hasValidDur = Boolean(newDuration && isFinite(newDuration) && newDuration > 0);
      const exactDur = hasValidDur ? Number(newDuration!.toFixed(2)) : null;
      return {
        audioUrl,
        audioFileName,
        audioWaveform,
        audioDuration: hasValidDur ? newDuration! : audioUrl ? state.audioDuration : null,
        useDemoBeat: !audioUrl,
        duration: exactDur ? Math.max(1, exactDur) : state.duration,
        currentTime: 0,
        isPlaying: false,
      };
    }),
  setUseDemoBeat: (useDemoBeat) => set({ useDemoBeat }),

  exportProjectJson: () => {
    const s = get();
    return JSON.stringify(
      {
        version: 5,
        projectName: s.projectName,
        stageGridCols: s.stageGridCols,
        stageGridRows: s.stageGridRows,
        wingGridCols: s.wingGridCols,
        stageTheme: s.stageTheme,
        stageInverted: s.stageInverted ?? false,
        showDancerNames: s.showDancerNames ?? true,
        dancerScale: s.dancerScale || 0.72,
        ambientIntensity: s.ambientIntensity,
        ambientColor: s.ambientColor,
        groupLayouts: s.groupLayouts,
        performers: s.performers,
        formations: s.formations,
        lightFixtures: s.lightFixtures,
        lightingPresets: s.lightingPresets,
        formationCues: s.formationCues,
        lightingCues: s.lightingCues,
        timelinePins: s.timelinePins,
        duration: s.duration,
        audioFileName: s.audioFileName || undefined,
        audioWaveform: s.audioWaveform && s.audioWaveform.length > 0 ? s.audioWaveform : undefined,
        audioDuration: s.audioDuration || (s.audioFileName ? s.duration : undefined),
      },
      null,
      2
    );
  },

  importProjectJson: (jsonStr, filePath) => {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.performers || !data.formations) return false;
      const newId = `proj_${Date.now()}`;
      const cols = data.stageGridCols || 12;
      const rows = data.stageGridRows || 8;
      const wCols = data.wingGridCols || 2;
      const stW = Number((cols * GRID_UNIT_M).toFixed(2));
      const stD = Number((rows * GRID_UNIT_M).toFixed(2));
      const defaultName = filePath
        ? filePath.split(/[/\\]/).pop()?.replace(/\.formation\.json$|\.json$/i, '')
        : 'Imported Project';
      const importedProj: ProjectData = {
        id: newId,
        projectName: data.projectName || defaultName || 'Imported Project',
        updatedAt: new Date().toLocaleString('ja-JP'),
        stageGridCols: cols,
        stageGridRows: rows,
        wingGridCols: wCols,
        stageTheme: data.stageTheme || 'hall',
        stageInverted: data.stageInverted ?? false,
        showDancerNames: data.showDancerNames ?? true,
        dancerScale: data.dancerScale || 0.72,
        ambientIntensity: data.ambientIntensity ?? 0.3,
        ambientColor: data.ambientColor || '#1e293b',
        groupLayouts: data.groupLayouts || createDefaultGroupLayouts(stW, stD),
        performers: data.performers,
        formations: data.formations,
        lightFixtures: data.lightFixtures?.length ? data.lightFixtures : DEFAULT_FIXTURES,
        lightingPresets: data.lightingPresets || INITIAL_LIGHTING_PRESETS,
        formationCues: normalizeFormationCues(data.formationCues || INITIAL_FORMATION_CUES),
        lightingCues: normalizeLightingCues(data.lightingCues || INITIAL_LIGHTING_CUES),
        timelinePins: Array.isArray(data.timelinePins) ? data.timelinePins : [],
        duration: data.duration || 16,
        associatedFilePath: filePath || undefined,
        audioFileName: data.audioFileName || undefined,
        audioWaveform: Array.isArray(data.audioWaveform) ? data.audioWaveform : undefined,
        audioDuration: Number(data.audioDuration) || undefined,
      };
      const nextProjects = [importedProj, ...get().projects];
      saveProjectsToStorage(nextProjects);
      set({ projects: nextProjects });
      get().openProject(newId);
      return true;
    } catch {
      return false;
    }
  },

  saveProjectFile: async (asSaveAs = false) => {
    const s = get();
    // 内部ストレージへ上書き保存
    s.saveCurrentProject();

    const jsonStr = s.exportProjectJson();
    const cleanProjectName = (s.projectName || 'project').trim().replace(/[/\\:*?"<>|]/g, '_');
    const defaultFileName = cleanProjectName.endsWith('.json')
      ? cleanProjectName
      : `${cleanProjectName}.formation.json`;

    // 1. Electron 環境の場合: 直接ファイルへの書き込みが可能
    if (window.electronAPI?.isElectron) {
      let targetPath = s.associatedFilePath;

      // 「名前を付けて保存」の場合、またはまだ関連ファイルパスが存在しない場合
      if (asSaveAs || !targetPath) {
        try {
          const chosenPath = await window.electronAPI.showSaveDialog(
            targetPath ? targetPath : defaultFileName
          );
          if (!chosenPath) {
            return { success: false, message: '保存がキャンセルされました' };
          }
          targetPath = chosenPath;
          set({ associatedFilePath: targetPath });
        } catch (err: any) {
          const errMsg = `保存ダイアログエラー: ${err?.message || err}`;
          set({ saveToast: { message: errMsg, type: 'error' } });
          return { success: false, message: errMsg };
        }
      }

      // ファイル書き込み実行
      try {
        const res = await window.electronAPI.saveFile(targetPath, jsonStr);
        if (res.success) {
          const updatedProjects = get().projects.map((p) =>
            p.id === s.activeProjectId ? { ...p, associatedFilePath: targetPath } : p
          );
          saveProjectsToStorage(updatedProjects);
          set({ projects: updatedProjects, associatedFilePath: targetPath });
          savedRefs = snapshotSavedRefs(get());

          const fileNameOnly = targetPath.split(/[/\\]/).pop() || targetPath;
          const msg = asSaveAs
            ? `「${fileNameOnly}」として別名保存しました`
            : `「${fileNameOnly}」に上書き保存しました`;
          set({ saveToast: { message: msg, type: 'success' } });
          return { success: true, filePath: targetPath, message: msg };
        } else {
          const errMsg = `保存に失敗しました: ${res.error || '不明なエラー'}`;
          set({ saveToast: { message: errMsg, type: 'error' } });
          return { success: false, message: errMsg };
        }
      } catch (err: any) {
        const errMsg = `保存エラー: ${err?.message || err}`;
        set({ saveToast: { message: errMsg, type: 'error' } });
        return { success: false, message: errMsg };
      }
    }

    // 2. Webブラウザ環境の場合: Blob ダウンロード保存
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFileName;
      a.click();
      URL.revokeObjectURL(url);

      savedRefs = snapshotSavedRefs(get());
      const msg = asSaveAs
        ? `「${defaultFileName}」をダウンロード保存しました`
        : `「${defaultFileName}」を上書き保存しました`;
      set({ saveToast: { message: msg, type: 'success' } });
      return { success: true, message: msg };
    } catch (err: any) {
      const errMsg = `保存エラー: ${err?.message || err}`;
      set({ saveToast: { message: errMsg, type: 'error' } });
      return { success: false, message: errMsg };
    }
  },
}));

// Global hooks for Electron main process (safe close confirmation & auto-save)
if (typeof window !== 'undefined') {
  window.__isFormationProjectDirty = () => {
    const state = useFormationStore.getState();
    return isProjectDirty(state);
  };

  window.__saveFormationProject = async () => {
    const store = useFormationStore.getState();
    const res = await store.saveProjectFile(false);
    return res.success;
  };
}
