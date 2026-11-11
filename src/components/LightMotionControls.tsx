import React, { useState, useEffect, useRef } from 'react';
import {
  LightConfig,
  LightMotionPattern,
  StrobeWaveform,
  GoboPattern,
} from '../types';
import { drawGoboPreviewToCanvas } from '../utils/lightTextures';
import {
  MoveHorizontal,
  MoveVertical,
  MoveUpRight,
  RotateCw,
  Activity,
  Sliders,
  Zap,
  Sparkles,
  FlipHorizontal,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface Props {
  config: LightConfig;
  onChange: (patch: Partial<LightConfig>) => void;
}

const MOTION_PATTERNS: {
  id: LightMotionPattern;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: 'pan_sweep', label: '左右(パン)', icon: <MoveHorizontal className="w-3 h-3" /> },
  { id: 'tilt_sweep', label: '上下(チルト)', icon: <MoveVertical className="w-3 h-3" /> },
  { id: 'diag_sweep', label: '斜め', icon: <MoveUpRight className="w-3 h-3" /> },
  { id: 'circle', label: '円運動', icon: <RotateCw className="w-3 h-3" /> },
  { id: 'figure8', label: '8の字', icon: <Activity className="w-3 h-3" /> },
];

const SYNC_PHASE_PRESETS: { deg: number; label: string; desc: string }[] = [
  { deg: 0, label: '0° 同時', desc: '全灯が完全に同じタイミングで同期して動きます' },
  { deg: 25, label: '25° 自然', desc: '少しずつ自然にタイミングがずれて波打ちます' },
  { deg: 45, label: '45° ウェーブ', desc: '横一列で綺麗なウェーブ（波）を描きます' },
  { deg: 90, label: '90° (1/4)', desc: '1/4周期ずつタイミングをずらします' },
  { deg: 180, label: '180° 交互', desc: '隣り合う照明が逆方向（交互）に動きます' },
];

export const R_GOBO_ITEMS: { id: GoboPattern; label: string; desc: string }[] = [
  { id: 'r_gobo_2', label: 'R-2', desc: 'R-Gobo 2: 放射ライン (Radial Needles)' },
  { id: 'r_gobo_4', label: 'R-4', desc: 'R-Gobo 4: 12角スター (Starburst)' },
  { id: 'r_gobo_6', label: 'R-6', desc: 'R-Gobo 6: スターダスト細粒 (Stardust)' },
  { id: 'r_gobo_7', label: 'R-7', desc: 'R-Gobo 7: 12枚花弁リング (Petal Ring)' },
];

export const S_GOBO_ITEMS: { id: GoboPattern; label: string; desc: string }[] = [
  { id: 's_gobo_1', label: 'S-1', desc: 'S-Gobo 1: マルチドット (Dot Shower)' },
  { id: 's_gobo_3', label: 'S-3', desc: 'S-Gobo 3: 3角トライスター (Triskelion)' },
  { id: 's_gobo_4', label: 'S-4', desc: 'S-Gobo 4: 4ドットサークル (Four Circles)' },
  { id: 's_gobo_7', label: 'S-7', desc: 'S-Gobo 7: 縦スリットバー (Vertical Bar)' },
  { id: 's_gobo_12', label: 'S-12', desc: 'S-Gobo 12: 小口径ビーム (Small Reducer)' },
  { id: 's_gobo_14', label: 'S-14', desc: 'S-Gobo 14: 大口径サークル (Wide Aperture)' },
];

const STROBE_WAVEFORMS: {
  id: StrobeWaveform;
  label: string;
  desc: string;
  svgPath: string;
}[] = [
  {
    id: 'square',
    label: '矩形波',
    desc: 'パキッとON/OFFが切り替わる標準ストロボ',
    svgPath: 'M 2 12 L 2 4 L 10 4 L 10 12 L 18 12 L 18 4 L 22 4',
  },
  {
    id: 'sine',
    label: '正弦波',
    desc: '滑らかに明滅する正弦波',
    svgPath: 'M 2 8 Q 6 1, 10 8 T 18 8 T 22 8',
  },
  {
    id: 'saw_down',
    label: 'ノコギリ(負↘)',
    desc: '傾きが負のノコギリ波（瞬間点灯→直線減衰）',
    svgPath: 'M 2 13 L 2 3 L 12 13 L 12 3 L 22 13',
  },
  {
    id: 'saw_up',
    label: 'ノコギリ(正↗)',
    desc: '傾きが正のノコギリ波（直線上昇→消灯）',
    svgPath: 'M 2 13 L 12 3 L 12 13 L 22 3 L 22 13',
  },
  {
    id: 'triangle',
    label: '三角波',
    desc: '一定の傾きで直線的に上昇・下降する三角波',
    svgPath: 'M 2 13 L 7 3 L 12 13 L 17 3 L 22 13',
  },
  {
    id: 'pulse',
    label: '閃光パルス',
    desc: '一瞬だけ鋭く光るフラッシュストロボ',
    svgPath: 'M 2 13 L 5 13 L 5 2 L 7 2 L 7 13 L 15 13 L 15 2 L 17 2 L 17 13 L 22 13',
  },
];

const GoboPreviewIcon: React.FC<{ gobo: GoboPattern; size?: number }> = ({
  gobo,
  size = 24,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (canvasRef.current) {
      drawGoboPreviewToCanvas(canvasRef.current, gobo);
    }
  }, [gobo]);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ width: size, height: size }}
      className="rounded-full shrink-0"
    />
  );
};

/**
 * Lighting Motion (Pan / Tilt Sweeps + Sync Phase Shift), Robe Pointe Gobo, and Multi-Waveform Strobe controls.
 * Each effect shows its detailed settings when turned ON, and can also be minimized while ON.
 */
export const LightMotionControls: React.FC<Props> = ({ config, onChange }) => {
  const [showBaseAngles, setShowBaseAngles] = useState(false);

  // Minimize states when each feature is ON
  const [motionMinimized, setMotionMinimized] = useState(false);
  const [goboMinimized, setGoboMinimized] = useState(false);
  const [strobeMinimized, setStrobeMinimized] = useState(false);

  // Remember last active settings when toggling OFF -> ON
  const [lastMotionPattern, setLastMotionPattern] =
    useState<LightMotionPattern>('pan_sweep');
  const [lastGobo, setLastGobo] = useState<GoboPattern>('r_gobo_2');
  const [lastStrobeHz, setLastStrobeHz] = useState<number>(2.0);

  const strobe = config.strobe ?? 0;
  const strobeBpm = Math.round(strobe * 60 * 10) / 10;
  const [bpmInputText, setBpmInputText] = useState<string>(String(strobeBpm));
  const [isEditingBpm, setIsEditingBpm] = useState(false);

  const strobeWaveform: StrobeWaveform = config.strobeWaveform ?? 'square';
  const strobeInvert = Boolean(config.strobeInvert);
  const pan = config.pan ?? 0;
  const tilt = config.tilt ?? 0;
  const motionPattern: LightMotionPattern = config.motionPattern ?? 'none';
  const motionAngle = config.motionAngle ?? 30;
  const motionSpeed = config.motionSpeed ?? 1.0;
  const motionPhaseStep = config.motionPhaseStep ?? 0;
  const motionPhase = config.motionPhase ?? 0;
  const motionReverse = Boolean(config.motionReverse);
  const motionMirror = Boolean(config.motionMirror);
  const gobo: GoboPattern = config.gobo ?? 'none';

  const isMotionOn = motionPattern !== 'none';
  const isGoboOn = gobo !== 'none';
  const isStrobeOn = strobe > 0;

  useEffect(() => {
    if (motionPattern !== 'none') setLastMotionPattern(motionPattern);
  }, [motionPattern]);

  useEffect(() => {
    if (gobo !== 'none') setLastGobo(gobo);
  }, [gobo]);

  useEffect(() => {
    if (strobe > 0) setLastStrobeHz(strobe);
  }, [strobe]);

  useEffect(() => {
    if (!isEditingBpm) {
      setBpmInputText(String(strobeBpm));
    }
  }, [strobeBpm, isEditingBpm]);

  const applyBpmValue = (rawBpm: number) => {
    const clampedBpm = Math.max(0, Math.min(1800, rawBpm));
    const hz = clampedBpm <= 0 ? 0 : Number((clampedBpm / 60).toFixed(4));
    onChange({ strobe: hz });
  };

  const activeGoboLabel =
    [...R_GOBO_ITEMS, ...S_GOBO_ITEMS].find((g) => g.id === gobo)?.label || '';

  return (
    <div className="space-y-2 pt-2 border-t border-slate-800">
      {/* 0. 基準の向き・中心角度（パン/チルト） */}
      <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-2.5 py-1.5">
        <button
          type="button"
          onClick={() => setShowBaseAngles(!showBaseAngles)}
          className="w-full flex items-center justify-between text-[10px] text-slate-300 hover:text-white py-0.5"
        >
          <span className="flex items-center gap-1.5 font-bold">
            <Sliders className="w-3 h-3 text-emerald-400" />
            基準の向き・中心角度（パン/チルト）
          </span>
          <span className="font-mono text-[10px] text-emerald-300 flex items-center gap-1">
            P:{Math.round(pan)}° / T:{Math.round(tilt)}°
            {showBaseAngles ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </span>
        </button>

        {showBaseAngles && (
          <div className="grid grid-cols-2 gap-2 pt-2 mt-1 border-t border-slate-800/70">
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-300">
                <span>基準パン</span>
                <span className="text-emerald-300 font-mono">{Math.round(pan)}°</span>
              </div>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={pan}
                onChange={(e) => onChange({ pan: parseFloat(e.target.value) })}
                onDoubleClick={() => onChange({ pan: 0 })}
                className="w-full accent-emerald-400"
                title="ダブルクリックで0°に戻す"
              />
            </div>
            <div className="space-y-0.5">
              <div className="flex justify-between text-[10px] text-slate-300">
                <span>基準チルト</span>
                <span className="text-emerald-300 font-mono">{Math.round(tilt)}°</span>
              </div>
              <input
                type="range"
                min={-80}
                max={80}
                step={1}
                value={tilt}
                onChange={(e) => onChange({ tilt: parseFloat(e.target.value) })}
                onDoubleClick={() => onChange({ tilt: 0 })}
                className="w-full accent-emerald-400"
                title="ダブルクリックで0°に戻す"
              />
            </div>
          </div>
        )}
      </div>

      {/* 1. パン・チルトの動き設定 (ONで詳細表示 + 最小化可能) */}
      <div
        className={`rounded-xl border transition p-2.5 space-y-2 ${
          isMotionOn
            ? 'bg-slate-950/80 border-sky-500/40'
            : 'bg-slate-950/50 border-slate-800/80'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div
            onClick={() => {
              if (isMotionOn) setMotionMinimized(!motionMinimized);
            }}
            className={`flex items-center gap-1.5 min-w-0 flex-1 ${
              isMotionOn ? 'cursor-pointer' : ''
            }`}
          >
            <Activity
              className={`w-3.5 h-3.5 shrink-0 ${
                isMotionOn ? 'text-sky-400' : 'text-slate-500'
              }`}
            />
            <span
              className={`text-[11px] font-bold truncate ${
                isMotionOn ? 'text-sky-400' : 'text-slate-400'
              }`}
            >
              パン・チルトの動き
            </span>
            {isMotionOn && (
              <span className="text-[9px] text-sky-300/90 font-mono truncate">
                ({MOTION_PATTERNS.find((m) => m.id === motionPattern)?.label} ±{motionAngle}° / {motionSpeed.toFixed(1)}Hz)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isMotionOn && (
              <button
                type="button"
                onClick={() => setMotionMinimized(!motionMinimized)}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] font-semibold text-slate-300 flex items-center gap-0.5 transition"
                title={motionMinimized ? '詳細設定を展開' : '詳細設定を最小化'}
              >
                {motionMinimized ? (
                  <>
                    <span>詳細</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>最小化</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isMotionOn) {
                  onChange({ motionPattern: 'none' });
                } else {
                  setMotionMinimized(false);
                  onChange({
                    motionPattern:
                      lastMotionPattern === 'none' ? 'pan_sweep' : lastMotionPattern,
                    motionAngle: config.motionAngle ?? 30,
                    motionSpeed: config.motionSpeed ?? 1.0,
                  });
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                isMotionOn
                  ? 'bg-sky-500 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {isMotionOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* モーションON かつ 最小化されていないときに詳細表示 */}
        {isMotionOn && !motionMinimized && (
          <div className="space-y-2.5 pt-1.5 border-t border-slate-800/70">
            {/* 動きのパターン */}
            <div className="space-y-1">
              <div className="text-[10px] font-semibold text-slate-400">動きのパターン</div>
              <div className="grid grid-cols-5 gap-1">
                {MOTION_PATTERNS.map((p) => {
                  const active = motionPattern === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() =>
                        onChange({
                          motionPattern: p.id,
                          motionAngle: config.motionAngle ?? 30,
                          motionSpeed: config.motionSpeed ?? 1.0,
                        })
                      }
                      className={`py-1.5 px-0.5 rounded text-[9px] font-bold flex flex-col items-center justify-center gap-0.5 transition ${
                        active
                          ? 'bg-sky-600 text-white shadow'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {p.icon}
                      <span className="truncate">{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 回転・スウィープ方向 ＆ 左右対称ミラー */}
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded p-0.5 flex-1">
                <button
                  type="button"
                  onClick={() => onChange({ motionReverse: false })}
                  className={`flex-1 py-0.5 rounded text-[10px] font-bold transition ${
                    !motionReverse
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  通常方向
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ motionReverse: true })}
                  className={`flex-1 py-0.5 rounded text-[10px] font-bold transition ${
                    motionReverse
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  逆方向(反転)
                </button>
              </div>

              <button
                type="button"
                onClick={() => onChange({ motionMirror: !motionMirror })}
                title="ステージ左側（下手）と右側（上手）で左右対称に動かします"
                className={`px-2 py-1 rounded border text-[10px] font-bold flex items-center gap-1 shrink-0 transition ${
                  motionMirror
                    ? 'bg-indigo-600/30 border-indigo-400 text-indigo-200 shadow-sm'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <FlipHorizontal className="w-3 h-3" />
                左右対称
              </button>
            </div>

            {/* 振れ角度（幅）：スライダー ＋ 数値直接入力 */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>振れ角度（幅）</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 focus-within:border-sky-400 rounded px-1.5 py-0.5">
                  <span className="text-[10px] text-slate-400">±</span>
                  <input
                    type="number"
                    min={1}
                    max={85}
                    step={0.5}
                    value={motionAngle}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        onChange({
                          motionAngle: Math.max(1, Math.min(85, val)),
                        });
                      }
                    }}
                    className="w-11 bg-transparent text-right text-[11px] font-mono font-bold text-sky-300 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">°</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={85}
                step={0.5}
                value={motionAngle}
                onChange={(e) => onChange({ motionAngle: parseFloat(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>

            {/* 動かすスピード：スライダー ＋ 数値直接入力 */}
            <div className="space-y-0.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span>動かすスピード</span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 focus-within:border-sky-400 rounded px-1.5 py-0.5">
                  <input
                    type="number"
                    min={0.05}
                    max={5.0}
                    step={0.05}
                    value={motionSpeed}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        onChange({
                          motionSpeed: Math.max(
                            0.05,
                            Math.min(5.0, Number(val.toFixed(2)))
                          ),
                        });
                      }
                    }}
                    className="w-12 bg-transparent text-right text-[11px] font-mono font-bold text-sky-300 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">Hz</span>
                </div>
              </div>
              <input
                type="range"
                min={0.05}
                max={4.0}
                step={0.05}
                value={Math.min(4.0, motionSpeed)}
                onChange={(e) => onChange({ motionSpeed: parseFloat(e.target.value) })}
                className="w-full accent-sky-400"
              />
            </div>

            {/* 同期のずらし設定 (Sync Phase Shift) */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-800/70">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="font-semibold text-amber-300">
                  同期のずらし（灯体間の位相差）
                </span>
                <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 focus-within:border-amber-400 rounded px-1.5 py-0.5">
                  <input
                    type="number"
                    min={-180}
                    max={180}
                    step={1}
                    value={Math.round(motionPhaseStep)}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val)) {
                        onChange({
                          motionPhaseStep: Math.max(-180, Math.min(180, val)),
                        });
                      }
                    }}
                    className="w-11 bg-transparent text-right text-[11px] font-mono font-bold text-amber-300 focus:outline-none"
                    title="隣の照明と何度の位相差（タイミングのズレ）をつけるかを設定します (0°=完全同期, 180°=交互)"
                  />
                  <span className="text-[10px] text-slate-400 font-mono">°/灯</span>
                </div>
              </div>

              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={motionPhaseStep}
                onChange={(e) =>
                  onChange({ motionPhaseStep: parseFloat(e.target.value) })
                }
                onDoubleClick={() => onChange({ motionPhaseStep: 0 })}
                title="ダブルクリックで0°（完全同期）に戻す"
                className="w-full accent-amber-400"
              />

              {/* ワンタッチ同期ずらしプリセット */}
              <div className="grid grid-cols-5 gap-1">
                {SYNC_PHASE_PRESETS.map((pr) => {
                  const isSel = Math.abs(motionPhaseStep - pr.deg) < 0.5;
                  return (
                    <button
                      key={pr.deg}
                      type="button"
                      title={pr.desc}
                      onClick={() => onChange({ motionPhaseStep: pr.deg })}
                      className={`py-1 px-0.5 rounded border text-[9px] font-bold transition ${
                        isSel
                          ? 'bg-amber-500/25 border-amber-400 text-amber-200'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pr.label}
                    </button>
                  );
                })}
              </div>

              {/* 開始タイミング（基準位相オフセット 0°〜360°） */}
              <div className="space-y-0.5 pt-1">
                <div className="flex items-center justify-between text-[10px] text-slate-300">
                  <span>開始タイミング（基準位相）</span>
                  <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 focus-within:border-amber-400 rounded px-1.5 py-0.5">
                    <input
                      type="number"
                      min={0}
                      max={360}
                      step={1}
                      value={Math.round(motionPhase)}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          onChange({
                            motionPhase: ((val % 360) + 360) % 360,
                          });
                        }
                      }}
                      className="w-10 bg-transparent text-right text-[10px] font-mono font-bold text-amber-300 focus:outline-none"
                    />
                    <span className="text-[9px] text-slate-400 font-mono">°</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={motionPhase}
                  onChange={(e) =>
                    onChange({ motionPhase: parseFloat(e.target.value) })
                  }
                  onDoubleClick={() => onChange({ motionPhase: 0 })}
                  title="ダブルクリックで0°に戻す"
                  className="w-full accent-amber-400"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. ゴボ設定 (ONで詳細表示 + 最小化可能) */}
      <div
        className={`rounded-xl border transition p-2.5 space-y-2 ${
          isGoboOn
            ? 'bg-slate-950/80 border-emerald-500/40'
            : 'bg-slate-950/50 border-slate-800/80'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div
            onClick={() => {
              if (isGoboOn) setGoboMinimized(!goboMinimized);
            }}
            className={`flex items-center gap-1.5 min-w-0 flex-1 ${
              isGoboOn ? 'cursor-pointer' : ''
            }`}
          >
            <Sparkles
              className={`w-3.5 h-3.5 shrink-0 ${
                isGoboOn ? 'text-emerald-400' : 'text-slate-500'
              }`}
            />
            <span
              className={`text-[11px] font-bold truncate ${
                isGoboOn ? 'text-emerald-400' : 'text-slate-400'
              }`}
            >
              ゴボ (Robe Pointe)
            </span>
            {isGoboOn && (
              <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300">
                <GoboPreviewIcon gobo={gobo} size={16} />
                {activeGoboLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isGoboOn && (
              <button
                type="button"
                onClick={() => setGoboMinimized(!goboMinimized)}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] font-semibold text-slate-300 flex items-center gap-0.5 transition"
                title={goboMinimized ? '詳細設定を展開' : '詳細設定を最小化'}
              >
                {goboMinimized ? (
                  <>
                    <span>詳細</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>最小化</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isGoboOn) {
                  onChange({ gobo: 'none' });
                } else {
                  setGoboMinimized(false);
                  onChange({
                    gobo: lastGobo === 'none' ? 'r_gobo_2' : lastGobo,
                  });
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                isGoboOn
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {isGoboOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* ゴボON かつ 最小化されていないときに詳細表示 */}
        {isGoboOn && !goboMinimized && (
          <div className="space-y-2 pt-1.5 border-t border-slate-800/70">
            {/* R-Gobo: 2, 4, 6, 7 */}
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-emerald-300/90 px-0.5">
                R-Gobo (2, 4, 6, 7)
              </div>
              <div className="grid grid-cols-4 gap-1">
                {R_GOBO_ITEMS.map((item) => {
                  const active = gobo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.desc}
                      onClick={() => onChange({ gobo: item.id })}
                      className={`py-1 px-1 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition ${
                        active
                          ? 'bg-emerald-600/25 border-emerald-400 text-emerald-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      <GoboPreviewIcon gobo={item.id} size={24} />
                      <span className="text-[9px] font-mono font-bold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* S-Gobo: 1, 3, 4, 7, 12, 14 */}
            <div className="space-y-1">
              <div className="text-[9px] font-bold text-sky-300/90 px-0.5">
                S-Gobo (1, 3, 4, 7, 12, 14)
              </div>
              <div className="grid grid-cols-6 gap-1">
                {S_GOBO_ITEMS.map((item) => {
                  const active = gobo === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      title={item.desc}
                      onClick={() => onChange({ gobo: item.id })}
                      className={`py-1 px-0.5 rounded-lg border flex flex-col items-center justify-center gap-0.5 transition ${
                        active
                          ? 'bg-sky-600/25 border-sky-400 text-sky-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      <GoboPreviewIcon gobo={item.id} size={22} />
                      <span className="text-[9px] font-mono font-bold">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. ストロボ設定 (ONで詳細表示 + 最小化可能) */}
      <div
        className={`rounded-xl border transition p-2.5 space-y-2 ${
          isStrobeOn
            ? 'bg-slate-950/80 border-rose-500/40'
            : 'bg-slate-950/50 border-slate-800/80'
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <div
            onClick={() => {
              if (isStrobeOn) setStrobeMinimized(!strobeMinimized);
            }}
            className={`flex items-center gap-1.5 min-w-0 flex-1 ${
              isStrobeOn ? 'cursor-pointer' : ''
            }`}
          >
            <Zap
              className={`w-3.5 h-3.5 shrink-0 ${
                isStrobeOn ? 'text-rose-400' : 'text-slate-500'
              }`}
            />
            <span
              className={`text-[11px] font-bold truncate ${
                isStrobeOn ? 'text-rose-400' : 'text-slate-400'
              }`}
            >
              ストロボ
            </span>
            {isStrobeOn && (
              <span className="text-[9px] text-rose-300/90 font-mono truncate">
                ({strobeBpm}BPM / {STROBE_WAVEFORMS.find((w) => w.id === strobeWaveform)?.label})
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isStrobeOn && (
              <button
                type="button"
                onClick={() => setStrobeMinimized(!strobeMinimized)}
                className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] font-semibold text-slate-300 flex items-center gap-0.5 transition"
                title={strobeMinimized ? '詳細設定を展開' : '詳細設定を最小化'}
              >
                {strobeMinimized ? (
                  <>
                    <span>詳細</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>最小化</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isStrobeOn) {
                  onChange({ strobe: 0 });
                  setBpmInputText('0');
                } else {
                  setStrobeMinimized(false);
                  const nextHz = lastStrobeHz > 0 ? lastStrobeHz : 2.0;
                  onChange({ strobe: nextHz });
                  setBpmInputText(String(Math.round(nextHz * 60 * 10) / 10));
                }
              }}
              className={`px-2 py-0.5 rounded text-[10px] font-bold transition ${
                isStrobeOn
                  ? 'bg-rose-500 text-white shadow'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }`}
            >
              {isStrobeOn ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* ストロボON かつ 最小化されていないときに詳細表示 */}
        {isStrobeOn && !strobeMinimized && (
          <div className="space-y-2 pt-1.5 border-t border-slate-800/70">
            <div className="flex items-center justify-between gap-1.5">
              {/* ON / OFF タイミング反転切り替え */}
              <div
                className="flex items-center bg-slate-900 border border-slate-700/80 rounded p-0.5"
                title="ONとOFFのタイミングを逆にします（他のライトと交互に点滅させたいときに便利です）"
              >
                <button
                  type="button"
                  onClick={() => onChange({ strobeInvert: false })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    !strobeInvert
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  通常
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ strobeInvert: true })}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                    strobeInvert
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  逆(反転)
                </button>
              </div>

              {/* BPM 数値入力ボックス */}
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 focus-within:border-rose-400 rounded px-1.5 py-0.5">
                <input
                  type="number"
                  min={1}
                  max={1800}
                  step={1}
                  value={bpmInputText}
                  onFocus={(e) => {
                    setIsEditingBpm(true);
                    e.currentTarget.select();
                  }}
                  onChange={(e) => {
                    const valStr = e.target.value;
                    setBpmInputText(valStr);
                    const num = parseFloat(valStr);
                    if (!isNaN(num) && num > 0) {
                      applyBpmValue(num);
                    }
                  }}
                  onBlur={() => {
                    setIsEditingBpm(false);
                    const num = parseFloat(bpmInputText);
                    if (isNaN(num) || num <= 0) {
                      applyBpmValue(120);
                      setBpmInputText('120');
                    } else {
                      const clamped = Math.min(1800, Math.round(num * 10) / 10);
                      applyBpmValue(clamped);
                      setBpmInputText(String(clamped));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.currentTarget.blur();
                    }
                  }}
                  className="w-12 bg-transparent text-right text-[11px] font-mono font-bold text-rose-300 focus:outline-none"
                  title="ストロボの速さをBPMで直接入力"
                />
                <span className="text-[9px] font-mono font-semibold text-slate-400 select-none">
                  BPM
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="range"
                min={6}
                max={900}
                step={1}
                value={Math.max(6, Math.min(900, Math.round(strobeBpm)))}
                onChange={(e) => {
                  const bpm = parseFloat(e.target.value);
                  setBpmInputText(String(bpm));
                  applyBpmValue(bpm);
                }}
                className="flex-1 accent-rose-400"
              />
            </div>

            {/* 波形選択ボタン */}
            <div className="space-y-1 pt-0.5">
              <div className="flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-semibold">波形タイプ</span>
                <span className="text-rose-300/90 font-mono text-[9px]">
                  {STROBE_WAVEFORMS.find((w) => w.id === strobeWaveform)?.label}{' '}
                  ({strobeInvert ? 'ON/OFF逆' : '通常'})
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {STROBE_WAVEFORMS.map((w) => {
                  const active = strobeWaveform === w.id;
                  return (
                    <button
                      key={w.id}
                      type="button"
                      title={w.desc}
                      onClick={() => onChange({ strobeWaveform: w.id })}
                      className={`py-1 px-1.5 rounded border text-[10px] font-bold flex items-center justify-center gap-1 transition ${
                        active
                          ? 'bg-rose-600/25 border-rose-400 text-rose-200 shadow-sm'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 16"
                        className="w-4 h-3 shrink-0"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d={w.svgPath} />
                      </svg>
                      <span className="truncate">{w.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
