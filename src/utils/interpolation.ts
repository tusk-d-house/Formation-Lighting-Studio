import {
  WorkflowStep,
  Performer,
  Position2D,
  FormationItem,
  LightFixture,
  LightConfig,
  LightingPreset,
  FormationCue,
  LightingCue,
  LightMotionPattern,
  GoboPattern,
  StrobeWaveform,
} from '../types';

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngleDeg(a: number, b: number, t: number): number {
  let diff = (b - a) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return a + diff * t;
}

function smoothstep(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const num = parseInt(
    clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean,
    16
  );
  if (isNaN(num)) return [255, 255, 255];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpColor(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex(lerp(r1, r2, t), lerp(g1, g2, t), lerp(b1, b2, t));
}

export function hslToHex(h: number, s: number, l: number): string {
  const hue = ((h % 360) + 360) % 360;
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + hue / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

export function getRainbowColor(clockSec: number, indexOffset = 0): string {
  const hue = (clockSec * 110 + indexOffset * 38) % 360;
  return hslToHex(hue, 95, 58);
}

export function formatTimestamp(sec: number): string {
  const safe = Math.max(0, Number.isFinite(sec) ? sec : 0);
  const totalHundredths = Math.round(safe * 100);
  const m = Math.floor(totalHundredths / 6000);
  const s = Math.floor((totalHundredths % 6000) / 100);
  const hundredths = totalHundredths % 100;
  return `${m.toString().padStart(2, '0')}:${s
    .toString()
    .padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
}

export function parseTimestampInput(str: string): number | null {
  const trimmed = str.trim();
  if (!trimmed) return null;
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    if (parts.length === 2) {
      const m = parseInt(parts[0], 10);
      const s = parseFloat(parts[1]);
      if (!isNaN(m) && !isNaN(s)) {
        return Math.max(0, Math.round((m * 60 + s) * 100) / 100);
      }
    }
  }
  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return Math.max(0, Math.round(num * 100) / 100);
  }
  return null;
}

/** Base aim height for each fixture type (floor for overhead, body height for foot/side). */
export function baseAimY(fix: LightFixture): number {
  const g = fix.groupId;
  if (g === 'front_foot' || g === 'back_foot' || g === 'side_foot') return 1.1;
  if (g === 'back_upper') return 1.0;
  if (g === 'side_spot') return 0.6;
  return 0;
}

/**
 * Compute the dynamic aim position (x, y, z) and effective pan/tilt angles
 * for moving head lights. Smoothly moves without getting stuck or clamped.
 * Supports fine-grained phase offset (sync shift), reverse direction, and left/right mirror.
 */
export function computeAimWithMotion(
  fix: LightFixture,
  baseTx: number,
  baseTz: number,
  basePan = 0,
  baseTilt = 0,
  motionPattern: LightMotionPattern = 'none',
  motionAngle = 30,
  motionSpeed = 1.0,
  clockSec = 0,
  phaseOffset = 0,
  motionReverse = false,
  motionMirror = false
): { x: number; y: number; z: number; pan: number; tilt: number } {
  const [mx, my, mz] = fix.mountPosition;
  const baseY = baseAimY(fix);

  // Height / distance from fixture mount to target plane (floor / performer)
  const verticalH = Math.max(1.8, Math.abs(baseY - my));

  // Base pan/tilt offset on target plane (scaled by height)
  const panOffsetM = verticalH * Math.tan(((basePan || 0) * Math.PI) / 180);
  const tiltOffsetM = verticalH * Math.tan(((baseTilt || 0) * Math.PI) / 180);

  // Calculate motion amplitude based on motionAngle (1 deg to 85 deg)
  const motionRad = (Math.max(1, Math.min(85, motionAngle || 30)) * Math.PI) / 180;
  const amplitude = verticalH * Math.tan(motionRad);

  let dX = 0;
  let dZ = 0;

  if (motionPattern && motionPattern !== 'none' && motionAngle > 0 && motionSpeed > 0) {
    const dirSign = motionReverse ? -1 : 1;
    // Smooth angular progress in radians (continuous, seamless periodic loop)
    const t = dirSign * clockSec * motionSpeed * 2 * Math.PI + phaseOffset;

    switch (motionPattern) {
      case 'pan_sweep':
        // Horizontal left-to-right swing along stage X axis (full dynamic amplitude)
        dX = amplitude * Math.sin(t);
        break;
      case 'tilt_sweep':
        // Vertical front-to-back swing along stage Z axis
        dZ = amplitude * Math.sin(t);
        break;
      case 'diag_sweep':
        // Diagonal 45-degree sweep combining X and Z
        dX = amplitude * 0.8 * Math.sin(t);
        dZ = amplitude * 0.8 * Math.sin(t);
        break;
      case 'circle':
        // Continuous, smooth circular motion: never clamps or stops
        dX = amplitude * Math.sin(t);
        dZ = amplitude * Math.cos(t);
        break;
      case 'figure8':
        // Smooth figure-8 Lissajous curve
        dX = amplitude * Math.sin(t);
        dZ = amplitude * 0.55 * Math.sin(2 * t);
        break;
    }

    // Optional left/right stage symmetry mirror (flips X motion for stage-right fixtures)
    if (motionMirror && mx > 0.01) {
      dX = -dX;
    }
  }

  const finalX = baseTx + panOffsetM + dX;
  const finalZ = baseTz + tiltOffsetM + dZ;
  const finalY = baseY;

  // Compute angles for fixture head orientation & UI display
  const dx = finalX - mx;
  const dz = finalZ - mz;
  const dy = finalY - my;
  const horizDist = Math.hypot(dx, dz);

  const effPan = Number(((Math.atan2(dx, dz) * 180) / Math.PI).toFixed(1));
  const effTilt = Number(((Math.atan2(dy, horizDist) * 180) / Math.PI).toFixed(1));

  return {
    x: Number(finalX.toFixed(3)),
    y: finalY,
    z: Number(finalZ.toFixed(3)),
    pan: effPan,
    tilt: effTilt,
  };
}

/**
 * Strobe gate: returns brightness multiplier in [0, 1] based on running clock,
 * frequency (Hz), waveform shape, and ON/OFF timing inversion.
 */
export function strobeGate(
  clockSec: number,
  hz?: number,
  waveform: StrobeWaveform = 'square',
  invert = false
): number {
  if (!hz || hz <= 0) return 1;
  // Invert shifts the cycle timing by half a period (+0.5 = 180°), reversing ON and OFF timing
  const phaseShift = invert ? 0.5 : 0;
  const phase = (((clockSec * hz + phaseShift) % 1) + 1) % 1;

  switch (waveform) {
    case 'sine': {
      const theta = (clockSec * hz + phaseShift) * 2 * Math.PI;
      return 0.5 + 0.5 * Math.sin(theta);
    }
    case 'saw_down':
      // ノコギリ波（傾き負 ↘）：最大1.0から0.0へ一定の負の傾きで直線減衰
      return 1 - phase;
    case 'saw_up':
      // ノコギリ波（傾き正 ↗）：0.0から1.0へ一定の正の傾きで直線上昇
      return phase;
    case 'triangle':
      // 三角波（∧）：0.0 -> 1.0 -> 0.0
      return phase < 0.5 ? phase * 2 : 2 - phase * 2;
    case 'pulse':
      // 鋭いフラッシュパルス（デューティ比15%）
      return phase < 0.15 ? 1 : 0;
    case 'square':
    default:
      // 矩形波（ON 50% / OFF 50%：反転時はONとOFFのタイミングが完全に逆転）
      return phase < 0.5 ? 1 : 0;
  }
}

export interface InterpolatedStageState {
  activeFormationName: string;
  activePresetName: string;
  ambientIntensity: number;
  ambientColor: string;
  positions: Record<string, Position2D>;
  previousPositions: Record<string, Position2D> | null;
  dancerColors: Record<string, string>;
  lights: Record<string, LightConfig>;
}

export function computeStageState(params: {
  step: WorkflowStep;
  performers: Performer[];
  formations: FormationItem[];
  activeFormationId: string;
  lightFixtures: LightFixture[];
  lightingPresets: LightingPreset[];
  activePresetId: string;
  formationCues: FormationCue[];
  lightingCues: LightingCue[];
  ambientIntensity: number;
  ambientColor: string;
  currentTime: number;
  rainbowClock: number;
  isPlaying?: boolean;
}): InterpolatedStageState {
  const {
    step,
    performers,
    formations,
    activeFormationId,
    lightFixtures,
    lightingPresets,
    activePresetId,
    formationCues,
    lightingCues,
    ambientIntensity,
    ambientColor,
    currentTime,
    rainbowClock,
    isPlaying = false,
  } = params;

  const fallbackFormation = formations[0];
  const fallbackPreset = lightingPresets[0];

  if (step !== 'timeline') {
    const formIdx = formations.findIndex((f) => f.id === activeFormationId);
    const currentForm = formIdx !== -1 ? formations[formIdx] : fallbackFormation;
    const prevForm = formIdx > 0 ? formations[formIdx - 1] : null;
    const currentPreset =
      lightingPresets.find((p) => p.id === activePresetId) || fallbackPreset;

    const resolvedLights: Record<string, LightConfig> = {};
    lightFixtures.forEach((fix, idx) => {
      const cfg = currentPreset?.lights[fix.id];
      if (!cfg) return;
      const followPos = cfg.followPerformerId
        ? currentForm?.positions[cfg.followPerformerId]
        : null;
      const resolvedColor = cfg.rainbow
        ? getRainbowColor(rainbowClock, idx)
        : cfg.color;

      const baseTx = followPos ? followPos.x : cfg.targetX;
      const baseTz = followPos ? followPos.z : cfg.targetZ;

      const stepDeg = cfg.motionPhaseStep ?? 0;
      const basePhaseDeg = cfg.motionPhase ?? 0;
      const phaseOffsetRad =
        ((fix.indexInGroup * stepDeg + basePhaseDeg) * Math.PI) / 180;

      const aim = computeAimWithMotion(
        fix,
        baseTx,
        baseTz,
        cfg.pan ?? 0,
        cfg.tilt ?? 0,
        cfg.motionPattern ?? 'none',
        cfg.motionAngle ?? 30,
        cfg.motionSpeed ?? 1.0,
        rainbowClock,
        phaseOffsetRad,
        Boolean(cfg.motionReverse),
        Boolean(cfg.motionMirror)
      );

      resolvedLights[fix.id] = {
        ...cfg,
        color: resolvedColor,
        intensity:
          cfg.intensity *
          strobeGate(
            rainbowClock,
            cfg.strobe,
            cfg.strobeWaveform ?? 'square',
            Boolean(cfg.strobeInvert)
          ),
        targetX: aim.x,
        targetZ: aim.z,
        aimY: aim.y,
        pan: aim.pan,
        tilt: aim.tilt,
        gobo: cfg.gobo ?? 'none',
      };
    });

    const dancerColors: Record<string, string> = {};
    performers.forEach((p) => {
      dancerColors[p.id] = currentForm?.colors?.[p.id] || p.color || '#3b82f6';
    });

    return {
      activeFormationName: currentForm?.name || '',
      activePresetName: currentPreset?.name || '',
      ambientIntensity,
      ambientColor,
      positions: currentForm?.positions || {},
      previousPositions: prevForm ? prevForm.positions : null,
      dancerColors,
      lights: resolvedLights,
    };
  }

  // ================= TIMELINE INTERPOLATION WITH HOLD DURATION (状態を維持する秒数) =================
  // During [cue.time, cue.time + cue.duration], the state is held 100%.
  // Between (cueA.time + cueA.duration) and cueB.time, the state transitions smoothly from A to B!
  const sortedFC = [...formationCues].sort((a, b) => a.time - b.time);
  let fcIdx = 0;
  for (let i = 0; i < sortedFC.length; i++) {
    if (currentTime >= sortedFC[i].time) fcIdx = i;
    else break;
  }

  const currFC = sortedFC[fcIdx] || {
    id: 'default_fc',
    time: 0,
    duration: 4,
    formationId: fallbackFormation.id,
  };
  const nextFC = fcIdx + 1 < sortedFC.length ? sortedFC[fcIdx + 1] : null;

  let formA =
    formations.find((f) => f.id === currFC.formationId) || fallbackFormation;
  let formB = formA;
  let formT = 0;

  if (nextFC) {
    const holdDur = Math.max(0.01, currFC.duration ?? 3.0);
    const holdEnd = currFC.time + holdDur;
    if (holdEnd < nextFC.time) {
      // Smoothly move across the gap between the end of currFC's hold and the start of nextFC
      if (currentTime > holdEnd) {
        formB =
          formations.find((f) => f.id === nextFC.formationId) || fallbackFormation;
        formT = smoothstep((currentTime - holdEnd) / (nextFC.time - holdEnd));
      }
    }
  }

  const positions: Record<string, Position2D> = {};
  const dancerColors: Record<string, string> = {};
  performers.forEach((p) => {
    const pA = formA.positions[p.id] || { x: 0, z: 0 };
    const pB = formB.positions[p.id] || pA;
    positions[p.id] = {
      x: lerp(pA.x, pB.x, formT),
      z: lerp(pA.z, pB.z, formT),
    };
    const cA = formA.colors?.[p.id] || p.color || '#3b82f6';
    const cB = formB.colors?.[p.id] || p.color || '#3b82f6';
    dancerColors[p.id] = formT > 0 ? lerpColor(cA, cB, formT) : cA;
  });

  const prevFormForArrows =
    formA.id !== formB.id && formT > 0
      ? formA.positions
      : fcIdx > 0
      ? formations.find((f) => f.id === sortedFC[fcIdx - 1].formationId)?.positions || null
      : null;

  // 2. Interpolate Lighting Preset Cues with Hold Duration
  const sortedLC = [...lightingCues].sort((a, b) => a.time - b.time);
  let lcIdx = 0;
  for (let i = 0; i < sortedLC.length; i++) {
    if (currentTime >= sortedLC[i].time) lcIdx = i;
    else break;
  }

  const currLC = sortedLC[lcIdx] || {
    id: 'default_lc',
    time: 0,
    duration: 4,
    presetId: fallbackPreset.id,
  };
  const nextLC = lcIdx + 1 < sortedLC.length ? sortedLC[lcIdx + 1] : null;

  let presetA =
    lightingPresets.find((p) => p.id === currLC.presetId) || fallbackPreset;
  let presetB = presetA;
  let lightT = 0;

  if (nextLC) {
    const holdDur = Math.max(0.01, currLC.duration ?? 3.0);
    const holdEnd = currLC.time + holdDur;
    if (holdEnd < nextLC.time) {
      if (currentTime > holdEnd) {
        presetB =
          lightingPresets.find((p) => p.id === nextLC.presetId) || fallbackPreset;
        lightT = smoothstep((currentTime - holdEnd) / (nextLC.time - holdEnd));
      }
    }
  }

  const lights: Record<string, LightConfig> = {};
  lightFixtures.forEach((fix, idx) => {
    const lA = presetA.lights[fix.id];
    const lB = presetB.lights[fix.id] || lA;
    if (!lA || !lB) return;

    const intA = lA.enabled ? lA.intensity : 0;
    const intB = lB.enabled ? lB.intensity : 0;
    const intensity = lerp(intA, intB, lightT);

    const followA = lA.followPerformerId ? positions[lA.followPerformerId] : null;
    const followB = lB.followPerformerId ? positions[lB.followPerformerId] : null;

    const txA = followA ? followA.x : lA.targetX;
    const tzA = followA ? followA.z : lA.targetZ;
    const txB = followB ? followB.x : lB.targetX;
    const tzB = followB ? followB.z : lB.targetZ;

    const colA = lA.rainbow ? getRainbowColor(rainbowClock, idx) : lA.color;
    const colB = lB.rainbow ? getRainbowColor(rainbowClock, idx) : lB.color;

    const strobe = lightT < 0.5 ? lA.strobe : lB.strobe;
    const strobeWaveform: StrobeWaveform =
      lightT < 0.5 ? lA.strobeWaveform ?? 'square' : lB.strobeWaveform ?? 'square';
    const strobeInvert =
      lightT < 0.5 ? Boolean(lA.strobeInvert) : Boolean(lB.strobeInvert);

    // Use continuous running clock when paused for preview; use timeline time when playing
    const motionClock = isPlaying ? currentTime : rainbowClock;

    // Compute independent physical aim for State A
    const effAngleA = lA.motionAngle ?? 30;
    const effSpeedA = lA.motionSpeed ?? 1.0;
    const stepDegA = lA.motionPhaseStep ?? 0;
    const basePhaseDegA = lA.motionPhase ?? 0;
    const phaseOffsetA =
      ((fix.indexInGroup * stepDegA + basePhaseDegA) * Math.PI) / 180;
    const hasMotionA =
      Boolean(lA.motionPattern && lA.motionPattern !== 'none') &&
      effAngleA > 0 &&
      effSpeedA > 0;
    const aimA = computeAimWithMotion(
      fix,
      txA,
      tzA,
      lA.pan ?? 0,
      lA.tilt ?? 0,
      hasMotionA ? lA.motionPattern! : 'none',
      hasMotionA ? effAngleA : 0,
      hasMotionA ? effSpeedA : 0,
      motionClock,
      phaseOffsetA,
      Boolean(lA.motionReverse),
      Boolean(lA.motionMirror)
    );

    // Compute independent physical aim for State B
    const effAngleB = lB.motionAngle ?? 30;
    const effSpeedB = lB.motionSpeed ?? 1.0;
    const stepDegB = lB.motionPhaseStep ?? 0;
    const basePhaseDegB = lB.motionPhase ?? 0;
    const phaseOffsetB =
      ((fix.indexInGroup * stepDegB + basePhaseDegB) * Math.PI) / 180;
    const hasMotionB =
      Boolean(lB.motionPattern && lB.motionPattern !== 'none') &&
      effAngleB > 0 &&
      effSpeedB > 0;
    const aimB = computeAimWithMotion(
      fix,
      txB,
      tzB,
      lB.pan ?? 0,
      lB.tilt ?? 0,
      hasMotionB ? lB.motionPattern! : 'none',
      hasMotionB ? effAngleB : 0,
      hasMotionB ? effSpeedB : 0,
      motionClock,
      phaseOffsetB,
      Boolean(lB.motionReverse),
      Boolean(lB.motionMirror)
    );

    // Smoothly interpolate physical aim position (X, Y, Z) and head angles (pan, tilt)
    const aimX = lerp(aimA.x, aimB.x, lightT);
    const aimY = lerp(aimA.y, aimB.y, lightT);
    const aimZ = lerp(aimA.z, aimB.z, lightT);
    const effPan = lerpAngleDeg(aimA.pan, aimB.pan, lightT);
    const effTilt = lerp(aimA.tilt, aimB.tilt, lightT);

    const gatedIntensity =
      intensity * strobeGate(rainbowClock, strobe, strobeWaveform, strobeInvert);

    lights[fix.id] = {
      enabled: intensity > 0.02,
      color: lerpColor(colA, colB, lightT),
      rainbow: lightT < 0.5 ? lA.rainbow : lB.rainbow,
      intensity: gatedIntensity,
      angle: lerp(lA.angle, lB.angle, lightT),
      targetX: Number(aimX.toFixed(3)),
      targetZ: Number(aimZ.toFixed(3)),
      aimY,
      strobe,
      strobeWaveform,
      strobeInvert,
      pan: Number(effPan.toFixed(1)),
      tilt: Number(effTilt.toFixed(1)),
      motionPattern: lightT < 0.5 ? lA.motionPattern : lB.motionPattern,
      motionAngle: lerp(effAngleA, effAngleB, lightT),
      motionSpeed: lerp(effSpeedA, effSpeedB, lightT),
      motionPhaseStep: lerp(stepDegA, stepDegB, lightT),
      motionPhase: lerp(basePhaseDegA, basePhaseDegB, lightT),
      motionReverse: lightT < 0.5 ? lA.motionReverse : lB.motionReverse,
      motionMirror: lightT < 0.5 ? lA.motionMirror : lB.motionMirror,
      gobo: lightT < 0.5 ? (lA.gobo ?? 'none') : (lB.gobo ?? 'none'),
      followPerformerId: lightT < 0.5 ? lA.followPerformerId : lB.followPerformerId,
    };
  });

  return {
    activeFormationName:
      formT > 0 && formA.id !== formB.id
        ? `${formA.name} → ${formB.name} (移動中)`
        : `${formA.name} (維持)`,
    activePresetName:
      lightT > 0 && presetA.id !== presetB.id
        ? `${presetA.name} → ${presetB.name}`
        : presetA.name,
    ambientIntensity,
    ambientColor,
    positions,
    previousPositions: prevFormForArrows,
    dancerColors,
    lights,
  };
}
