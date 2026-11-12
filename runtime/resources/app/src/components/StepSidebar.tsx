import React, { useState } from 'react';
import {
  LayoutGrid,
  Lightbulb,
  Plus,
  Minus,
  Trash2,
  Crosshair,
  Route,
  Magnet,
  ChevronDown,
  ChevronUp,
  Sliders,
  Clock,
  Ruler,
  Eye,
  EyeOff,
  AlertTriangle,
  Search,
  X,
} from 'lucide-react';
import {
  useFormationStore,
  LIGHT_GROUPS,
  GRID_UNIT_M,
  DANCER_COLORS,
  DEFAULT_DANCER_COLOR,
} from '../store/useFormationStore';
import { formatTimestamp, parseTimestampInput } from '../utils/interpolation';
import { isDancerGrayColor } from '../utils/exportAttendanceSheet';
import { LightMotionControls } from './LightMotionControls';
import { TimeCodeInput } from './TimeCodeInput';

const getOverlappingIds = <
  T extends { id: string; time: number; duration?: number }
>(
  cues: T[]
): Set<string> => {
  const sorted = [...cues].sort(
    (a, b) => a.time - b.time || a.id.localeCompare(b.id)
  );
  const overlapped = new Set<string>();
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    const aEnd = a.time + Math.max(0.01, a.duration ?? 3.0);
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (aEnd > b.time + 0.005) {
        overlapped.add(a.id);
        overlapped.add(b.id);
      }
    }
  }
  return overlapped;
};

const COLOR_SWATCHES = [
  '#ffffff',
  '#fef08a',
  '#f59e0b',
  '#f43f5e',
  '#ec4899',
  '#a855f7',
  '#3b82f6',
  '#06b6d4',
  '#10b981',
];

export const StepSidebar: React.FC = () => {
  const {
    currentStep,
    stageWidth,
    stageDepth,
    ambientIntensity,
    snapToGrid,
    showPaths,
    showLightBeams,
    showDancerNames,
    dancerScale,
    performers,
    selectedPerformerId,
    selectedPerformerIds,
    formations,
    activeFormationId,
    groupLayouts,
    lightFixtures,
    lightingPresets,
    activePresetId,
    selectedGroupId,
    selectedLightId,
    formationCues,
    lightingCues,
    selectedFormationCueId,
    selectedLightingCueId,
    currentTime,
    setCurrentStep,
    setSnapToGrid,
    setShowPaths,
    setShowLightBeams,
    setShowDancerNames,
    setDancerScale,
    selectPerformersByIds,
    updateSelectedPerformersColor,
    resetFormationColors,
    sendSelectedPerformersToWing,
    selectFormation,
    updateFormation,
    applyFormationTemplate,
    selectPreset,
    selectGroup,
    selectLight,
    addFixtureToGroup,
    removeFixtureFromGroup,
    updateGroupLayout,
    autoFitGroupSpacing,
    updateFixturePosition,
    updateLightingPreset,
    updateLightGroupConfig,
    updateLightConfig,
    copiedLightingClipboard,
    copySelectedLighting,
    pasteCopiedLighting,
    addFormationCue,
    updateFormationCue,
    deleteFormationCue,
    selectFormationCue,
    addLightingCue,
    updateLightingCue,
    deleteLightingCue,
    selectLightingCue,
    setCurrentTime,
  } = useFormationStore();

  const [expandGroupLayout, setExpandGroupLayout] = useState(true);
  const [expandIndividualLights, setExpandIndividualLights] = useState(true);
  const [dancerSearchQuery, setDancerSearchQuery] = useState('');

  const activeFormation =
    formations.find((f) => f.id === activeFormationId) || formations[0];
  const activePreset =
    lightingPresets.find((p) => p.id === activePresetId) || lightingPresets[0];

  const groupFixtures = lightFixtures.filter((f) => f.groupId === selectedGroupId);
  const selectedGroupInfo =
    LIGHT_GROUPS.find((g) => g.id === selectedGroupId) || LIGHT_GROUPS[0];
  const currentGroupLayout = groupLayouts[selectedGroupId] || {
    height: 6.5,
    spacing: 2.2,
    offsetZ: 0,
  };
  const firstFixtureInGroup = groupFixtures[0];
  const groupRepConfig =
    firstFixtureInGroup && activePreset
      ? activePreset.lights[firstFixtureInGroup.id]
      : null;

  const selectedLight = lightFixtures.find((l) => l.id === selectedLightId) || null;
  const activeLightConfig =
    selectedLight && activePreset ? activePreset.lights[selectedLight.id] : null;

  const selectedFC = formationCues.find((c) => c.id === selectedFormationCueId);
  const selectedLC = lightingCues.find((c) => c.id === selectedLightingCueId);
  const overlappedFormationIds = getOverlappingIds(formationCues);
  const overlappedLightingIds = getOverlappingIds(lightingCues);

  return (
    <aside className="w-full bg-slate-900 border-l border-slate-800 flex flex-col h-full min-h-0 select-none shrink-0 print:hidden">
      {/* ================= FORMATIONS EDITOR ================= */}
      {currentStep === 'formations' && activeFormation && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {/* Formation Name & Notes */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <input
              type="text"
              maxLength={40}
              value={activeFormation.name}
              onChange={(e) =>
                updateFormation(activeFormation.id, {
                  name: e.target.value.slice(0, 40),
                })
              }
              placeholder="フォーメーション名 (最大40文字)"
              className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-md px-2.5 py-1.5 text-xs font-bold text-slate-100 focus:outline-none"
            />
            <div className="space-y-1">
              <textarea
                rows={5}
                maxLength={500}
                value={activeFormation.notes}
                onChange={(e) => {
                  const lines = e.target.value.split('\n').slice(0, 14);
                  const limited = lines.join('\n').slice(0, 500);
                  updateFormation(activeFormation.id, { notes: limited });
                }}
                placeholder="コメント"
                className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded-md p-2 text-xs text-slate-200 resize-y focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500 px-0.5">
                <span></span>
                <span
                  className={
                    (activeFormation.notes?.length || 0) >= 480
                      ? 'text-amber-400 font-bold'
                      : 'text-slate-500'
                  }
                >
                  {activeFormation.notes?.length || 0} / 500文字 (最大14行)
                </span>
              </div>
            </div>
          </div>

          {/* Snap Toggle & Dancer Size Slider */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`py-2 px-2.5 rounded-xl text-[11px] font-semibold border flex items-center justify-center gap-1 shrink-0 transition ${
                snapToGrid
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
              title="グリッドへの自動吸着を切り替え"
            >
              <Magnet className="w-3.5 h-3.5" />
              スナップ
            </button>
            <div className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-2 flex items-center justify-between gap-2 min-w-0">
              <span className="text-[11px] font-semibold text-slate-300 shrink-0">
                サイズ: {Math.round((dancerScale || 0.72) * 100)}%
              </span>
              <input
                type="range"
                min={0.35}
                max={1.3}
                step={0.05}
                value={dancerScale || 0.72}
                onChange={(e) => setDancerScale(parseFloat(e.target.value))}
                className="flex-1 min-w-0 accent-sky-400"
              />
            </div>
          </div>

          {/* Dancer Search & Quick Select */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300">
                ダンサー検索
              </span>
              <span className="text-[10px] text-slate-500">
                全{performers.length}人
              </span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={dancerSearchQuery}
                onChange={(e) => setDancerSearchQuery(e.target.value)}
                placeholder="名前または番号で検索 (例: 1, Aoi)..."
                className="w-full bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded-lg pl-8 pr-7 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
              />
              {dancerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setDancerSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-0.5"
                  title="クリア"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Dancer Search Results */}
            {(() => {
              const query = dancerSearchQuery.trim().toLowerCase();
              const filteredPerformers = performers
                .map((p, idx) => ({ ...p, number: idx + 1 }))
                .filter((p) => {
                  if (!query) return true;
                  const nameMatch = p.name.toLowerCase().includes(query);
                  const numMatch = String(p.number) === query || String(p.number).includes(query);
                  return nameMatch || numMatch;
                });

              if (filteredPerformers.length === 0) {
                return (
                  <div className="text-[11px] text-slate-500 text-center py-2">
                    該当するダンサーがいません
                  </div>
                );
              }

              return (
                <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                  {filteredPerformers.map((p) => {
                    const isSelected = selectedPerformerIds.includes(p.id);
                    const currentColor = activeFormation.colors?.[p.id] || p.color;
                    const isGrayOff = isDancerGrayColor(currentColor);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={(e) => {
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            if (isSelected) {
                              selectPerformersByIds(
                                selectedPerformerIds.filter((id) => id !== p.id)
                              );
                            } else {
                              selectPerformersByIds([...selectedPerformerIds, p.id]);
                            }
                          } else {
                            selectPerformersByIds([p.id]);
                          }
                        }}
                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition border ${
                          isSelected
                            ? 'bg-sky-600/30 border-sky-400 text-sky-200'
                            : 'bg-slate-900/90 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center shrink-0 shadow-sm"
                            style={{ backgroundColor: currentColor }}
                          >
                            {p.number}
                          </span>
                          <span className={`text-xs font-semibold truncate ${isGrayOff ? 'text-slate-400 line-through decoration-slate-600' : ''}`}>
                            {p.name}
                          </span>
                          {isGrayOff && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 shrink-0">
                              不参加
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            isSelected
                              ? 'bg-sky-500 text-white font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {isSelected ? '選択中' : '選択'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Selected Dancers Panel (Single or Range Multi-Select) */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400">
                選択中: {selectedPerformerIds.length}人
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    selectPerformersByIds(performers.map((p) => p.id))
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300"
                >
                  全選択
                </button>
                <button
                  onClick={() => selectPerformersByIds([])}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400"
                >
                  解除
                </button>
                <button
                  onClick={() =>
                    resetFormationColors(activeFormation.id, DEFAULT_DANCER_COLOR)
                  }
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-sky-300"
                  title="この構成の全員を同じ色に戻す"
                >
                  全員同色
                </button>
              </div>
            </div>

            {selectedPerformerIds.length > 0 ? (
              <>
                {/* Per-Formation Color Change for Selected Dancers */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800">
                  <div className="flex items-center justify-between text-[11px] text-slate-300">
                    <span>この構成の色 (担当分け・出演判定)</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateSelectedPerformersColor('#64748b')}
                        className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-[10px] text-slate-300 transition"
                        title="グレーにするとこのフォーメーションに出演していない（FALSE）とみなされます"
                      >
                        不参加(グレー)
                      </button>
                      <input
                        type="color"
                        value={
                          activeFormation.colors?.[selectedPerformerIds[0]] ||
                          performers.find((p) => p.id === selectedPerformerIds[0])
                            ?.color ||
                          DEFAULT_DANCER_COLOR
                        }
                        onChange={(e) =>
                          updateSelectedPerformersColor(e.target.value)
                        }
                        className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {DANCER_COLORS.map((col) => {
                      const isGraySwatch = isDancerGrayColor(col);
                      return (
                        <button
                          key={col}
                          onClick={() => updateSelectedPerformersColor(col)}
                          title={
                            isGraySwatch
                              ? 'グレー（不参加 / 出演なしとして判定）'
                              : '出演色（出演ありとして判定）'
                          }
                          className={`rounded-full border hover:scale-110 transition ${
                            isGraySwatch
                              ? 'border-amber-400/70 ring-1 ring-amber-400/30'
                              : 'border-white/25'
                          }`}
                          style={{
                            backgroundColor: col,
                            width: '18px',
                            height: '18px',
                          }}
                        />
                      );
                    })}
                  </div>
                  <div className="text-[10px] leading-relaxed text-amber-300/90 bg-amber-950/30 border border-amber-500/30 rounded-lg px-2 py-1">
                    💡 ヒント：グレー以外の色にすると出演しているとみなされます（グレーにすると出演表出力で不参加＝FALSEになります）
                  </div>
                </div>

                {/* Single Dancer Coordinates if 1 selected */}
                {selectedPerformerIds.length === 1 &&
                  selectedPerformerId &&
                  (() => {
                    const perf = performers.find(
                      (p) => p.id === selectedPerformerId
                    );
                    if (!perf) return null;
                    const pos = activeFormation.positions[perf.id] || {
                      x: 0,
                      z: 0,
                    };
                    const gridX = (pos.x / GRID_UNIT_M).toFixed(1);
                    const gridZ = (pos.z / GRID_UNIT_M).toFixed(1);
                    return (
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-900 p-2 rounded border border-slate-800">
                        <div>
                          <span className="text-slate-400">横: </span>
                          <strong className="text-sky-300 font-mono">
                            {gridX}G ({pos.x}m)
                          </strong>
                        </div>
                        <div>
                          <span className="text-slate-400">奥行: </span>
                          <strong className="text-sky-300 font-mono">
                            {gridZ}G ({pos.z}m)
                          </strong>
                        </div>
                      </div>
                    );
                  })()}

                {/* Quick Wing Move for Selected Dancers */}
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  <button
                    onClick={() =>
                      sendSelectedPerformersToWing(activeFormation.id, 'left')
                    }
                    className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 font-semibold transition"
                  >
                    ← 下手袖へ移動
                  </button>
                  <button
                    onClick={() =>
                      sendSelectedPerformersToWing(activeFormation.id, 'right')
                    }
                    className="py-1.5 px-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-slate-200 font-semibold transition"
                  >
                    上手袖へ移動 →
                  </button>
                </div>
              </>
            ) : (
              <div className="text-[10px] leading-relaxed text-slate-400 bg-slate-900/60 border border-slate-800 rounded-lg px-2 py-1.5">
                💡 ダンサーを選択するとこの構成での色を変更できます。<span className="text-amber-300/90">グレー以外の色にすると出演しているとみなされます</span>（グレーは出演表出力時に不参加＝FALSEになります）。
              </div>
            )}
          </div>

          {/* Templates */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="text-xs font-bold text-slate-300">整列テンプレート</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'v-shape')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                ▽ V字
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'inv-v')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                △ 逆V字
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'line-1')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                ━ 横1列
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'line-2')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                ═ 前後2列
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'diagonal')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                ╱ 斜め
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'circle')}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-slate-200 transition text-left"
              >
                ◯ 円形
              </button>
              <button
                onClick={() => applyFormationTemplate(activeFormation.id, 'wings-wait')}
                className="col-span-2 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs text-amber-300 transition text-center font-semibold"
              >
                全員を左右袖へ配置
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= LIGHTING GROUPS & INDIVIDUAL DETAIL STUDIO ================= */}
      {currentStep === 'lighting' && activePreset && (
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={activePreset.name}
                onChange={(e) =>
                  updateLightingPreset(activePreset.id, { name: e.target.value })
                }
                className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded px-2.5 py-1 text-xs font-bold text-amber-300 focus:outline-none"
              />
              <button
                onClick={() => setShowLightBeams(!showLightBeams)}
                className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-amber-300 shrink-0"
              >
                ビーム:{showLightBeams ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>地明かり: {Math.round(ambientIntensity * 100)}%</span>
              <button
                onClick={() => setCurrentStep('settings')}
                className="text-sky-400 hover:text-sky-300 underline"
              >
                設定で変更 →
              </button>
            </div>
          </div>

          {/* Lighting Groups List */}
          <div className="space-y-1">
            {LIGHT_GROUPS.map((grp) => {
              const fixturesInGrp = lightFixtures.filter((f) => f.groupId === grp.id);
              const enabledCount = fixturesInGrp.filter(
                (f) => activePreset.lights[f.id]?.enabled
              ).length;
              const allOn =
                fixturesInGrp.length > 0 && enabledCount === fixturesInGrp.length;
              const anyOn = enabledCount > 0;
              const isSelGroup = selectedGroupId === grp.id;

              return (
                <div
                  key={grp.id}
                  onClick={() => selectGroup(grp.id)}
                  className={`px-2.5 py-1.5 rounded-lg border cursor-pointer transition flex items-center justify-between gap-2 ${
                    isSelGroup
                      ? 'bg-slate-800 border-amber-400 shadow'
                      : 'bg-slate-950/70 border-slate-800 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      
                      <span className="text-xs font-bold text-slate-100 truncate">
                        {grp.name.replace(/\s*\(.*?\)$/, '')}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      {fixturesInGrp.map((fx) => {
                        const st = activePreset.lights[fx.id];
                        return (
                          <span
                            key={fx.id}
                            className="w-2.5 h-2.5 rounded-full border border-white/25"
                            style={{
                              background: st?.enabled
                                ? st.rainbow
                                  ? 'linear-gradient(135deg, #ff0055, #ffdd00, #00ffcc, #3b82f6, #a855f7)'
                                  : st.color
                                : '#1e293b',
                            }}
                          />
                        );
                      })}
                      <span className="text-[10px] text-slate-400 ml-1">
                        {enabledCount}/{fixturesInGrp.length}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      selectGroup(grp.id);
                      updateLightGroupConfig(activePreset.id, grp.id, {
                        enabled: !allOn,
                        intensity: !allOn ? 2.2 : 0,
                      });
                    }}
                    className={`px-2 py-1 rounded text-[10px] font-bold shrink-0 transition ${
                      anyOn
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {allOn ? 'ON' : anyOn ? '一部ON' : 'OFF'}
                  </button>
                </div>
              );
            })}
          </div>

          {groupRepConfig && (
            <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-1 text-xs font-bold text-amber-300 border-b border-slate-800 pb-1.5">
                <span className="truncate">
                  {selectedGroupInfo.name.replace(/\s*\(.*?\)$/, '')} ({groupFixtures.length}灯)
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      selectLight(null);
                      copySelectedLighting();
                    }}
                    className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[9px] font-semibold text-slate-300 hover:text-white transition"
                    title="この照明グループの設定をコピー (Ctrl+C)"
                  >
                    コピー(Ctrl+C)
                  </button>
                  {copiedLightingClipboard && (
                    <button
                      type="button"
                      onClick={() => pasteCopiedLighting()}
                      className="px-1.5 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-[9px] font-bold text-amber-300 transition"
                      title={`コピーした照明「${copiedLightingClipboard.groupName}」の設定をこのプリセットに貼り付け (Ctrl+V)`}
                    >
                      貼付(Ctrl+V)
                    </button>
                  )}
                </div>
              </div>

              {/* Group Color & Rainbow */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">カラー</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        updateLightGroupConfig(activePreset.id, selectedGroupId, {
                          rainbow: !groupRepConfig.rainbow,
                          enabled: true,
                        })
                      }
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        groupRepConfig.rainbow
                          ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 text-slate-950 border-white'
                          : 'bg-slate-900 text-slate-300 border-slate-700'
                      }`}
                    >
                      虹色 {groupRepConfig.rainbow ? 'ON' : 'OFF'}
                    </button>
                    <input
                      type="color"
                      value={groupRepConfig.color}
                      onChange={(e) =>
                        updateLightGroupConfig(activePreset.id, selectedGroupId, {
                          color: e.target.value,
                          rainbow: false,
                          enabled: true,
                        })
                      }
                      className="w-5 h-5 rounded cursor-pointer bg-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  {COLOR_SWATCHES.map((col) => (
                    <button
                      key={col}
                      onClick={() =>
                        updateLightGroupConfig(activePreset.id, selectedGroupId, {
                          color: col,
                          rainbow: false,
                          enabled: true,
                        })
                      }
                      className="w-4.5 h-4.5 rounded-full border border-white/25 hover:scale-110 transition"
                      style={{
                        backgroundColor: col,
                        width: '18px',
                        height: '18px',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Group Brightness & Angle */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>明るさ</span>
                    <span className="text-amber-300 font-mono">
                      {Math.round((groupRepConfig.intensity / 2) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={0.1}
                    value={groupRepConfig.intensity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      updateLightGroupConfig(activePreset.id, selectedGroupId, {
                        intensity: val,
                        enabled: val > 0,
                      });
                    }}
                    className="w-full accent-amber-400"
                  />
                </div>

                <div className="space-y-0.5">
                  <div className="flex justify-between text-[11px] text-slate-300">
                    <span>絞り角</span>
                    <span className="text-sky-300 font-mono">
                      {Math.round((groupRepConfig.angle * 180) / Math.PI)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.10}
                    max={0.85}
                    step={0.02}
                    value={groupRepConfig.angle}
                    onChange={(e) =>
                      updateLightGroupConfig(activePreset.id, selectedGroupId, {
                        angle: parseFloat(e.target.value),
                      })
                    }
                    className="w-full accent-sky-400"
                  />
                </div>
              </div>

              <LightMotionControls
                config={groupRepConfig}
                onChange={(patch) =>
                  updateLightGroupConfig(activePreset.id, selectedGroupId, patch)
                }
              />

              {/* Group Fixture Count & Position Settings */}
              <div className="pt-1.5 border-t border-slate-800">
                <button
                  onClick={() => setExpandGroupLayout(!expandGroupLayout)}
                  className="w-full flex items-center justify-between text-xs font-bold text-emerald-400 py-1"
                >
                  <span className="flex items-center gap-1">
                    <Ruler className="w-3.5 h-3.5" />
                    照明追加・高さ・間隔 ({groupFixtures.length}灯)
                  </span>
                  {expandGroupLayout ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {expandGroupLayout && (
                  <div className="mt-1.5 p-2 rounded-lg bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => addFixtureToGroup(selectedGroupId)}
                        className="flex-1 py-1 px-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        追加
                      </button>
                      <button
                        onClick={() => removeFixtureFromGroup(selectedGroupId)}
                        disabled={groupFixtures.length <= 1}
                        className="py-1 px-2.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition"
                      >
                        <Minus className="w-3.5 h-3.5" />
                        減らす
                      </button>
                      <button
                        onClick={() => autoFitGroupSpacing(selectedGroupId)}
                        className="py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-emerald-300 font-semibold transition"
                      >
                        均等整列
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                      <div>
                        <span className="text-slate-400 block">
                          高さ: {currentGroupLayout.height}m
                        </span>
                        <input
                          type="range"
                          min={0.15}
                          max={9.5}
                          step={0.15}
                          value={currentGroupLayout.height}
                          onChange={(e) =>
                            updateGroupLayout(selectedGroupId, {
                              height: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          間隔: {currentGroupLayout.spacing}m
                        </span>
                        <input
                          type="range"
                          min={0.45}
                          max={6.0}
                          step={0.15}
                          value={currentGroupLayout.spacing}
                          onChange={(e) =>
                            updateGroupLayout(selectedGroupId, {
                              spacing: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>
                      <div>
                        <span className="text-slate-400 block">
                          奥行: {currentGroupLayout.offsetZ}m
                        </span>
                        <input
                          type="range"
                          min={-(stageDepth / 2 + 1.5)}
                          max={stageDepth / 2 + 2.5}
                          step={0.2}
                          value={currentGroupLayout.offsetZ}
                          onChange={(e) =>
                            updateGroupLayout(selectedGroupId, {
                              offsetZ: parseFloat(e.target.value),
                            })
                          }
                          className="w-full accent-emerald-400"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Individual Lights Detail Section */}
              <div className="pt-1.5 border-t border-slate-800">
                <button
                  onClick={() => {
                    const nextExpand = !expandIndividualLights;
                    setExpandIndividualLights(nextExpand);
                    if (!nextExpand) selectLight(null);
                  }}
                  className="w-full flex items-center justify-between text-xs font-bold text-sky-400 py-1"
                >
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3.5 h-3.5" />
                    個別設定 ({groupFixtures.length}灯)
                  </span>
                  {expandIndividualLights ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>

                {expandIndividualLights && (
                  <div className="mt-1.5 space-y-2">
                    <div className="grid grid-cols-2 gap-1">
                      {groupFixtures.map((fx) => {
                        const st = activePreset.lights[fx.id];
                        const isSel = selectedLightId === fx.id;
                        return (
                          <div
                            key={fx.id}
                            onClick={() => selectLight(fx.id)}
                            className={`p-1.5 rounded-lg border cursor-pointer transition flex items-center justify-between gap-1 ${
                              isSel
                                ? 'bg-sky-950 border-sky-400'
                                : 'bg-slate-900 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/30"
                                style={{
                                  background: st?.enabled
                                    ? st.rainbow
                                      ? 'linear-gradient(135deg, #ff0055, #00ffcc, #3b82f6)'
                                      : st.color
                                    : '#1e293b',
                                }}
                              />
                              <span className="text-[11px] font-semibold text-slate-200 truncate">
                                {fx.name.replace(
                                  /^.*?(#\d+|下手.*|上手.*|\(.*?\))$/,
                                  '$1'
                                ) || fx.name}
                              </span>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLightConfig(activePreset.id, fx.id, {
                                  enabled: !st?.enabled,
                                  intensity: !st?.enabled
                                    ? Math.max(2.0, st?.intensity || 2.0)
                                    : st?.intensity,
                                });
                              }}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                st?.enabled
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                            >
                              {st?.enabled ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {selectedLight && activeLightConfig && (
                      <div className="p-2.5 rounded-lg bg-slate-900 border border-sky-500/40 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="text-xs font-bold text-sky-300 truncate">
                            {selectedLight.name}
                          </span>
                          <button
                            onClick={() =>
                              updateLightConfig(activePreset.id, selectedLight.id, {
                                rainbow: !activeLightConfig.rainbow,
                                enabled: true,
                              })
                            }
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              activeLightConfig.rainbow
                                ? 'bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 text-slate-950'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            虹色
                          </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 items-center text-[11px]">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">色:</span>
                            <input
                              type="color"
                              value={activeLightConfig.color}
                              onChange={(e) =>
                                updateLightConfig(activePreset.id, selectedLight.id, {
                                  color: e.target.value,
                                  rainbow: false,
                                })
                              }
                              className="w-5 h-5 rounded cursor-pointer bg-transparent"
                            />
                          </div>
                          <div className="col-span-2 flex items-center gap-1">
                            <span className="text-slate-400 shrink-0">光量:</span>
                            <input
                              type="range"
                              min={0}
                              max={3}
                              step={0.1}
                              value={activeLightConfig.intensity}
                              onChange={(e) =>
                                updateLightConfig(activePreset.id, selectedLight.id, {
                                  intensity: parseFloat(e.target.value),
                                  enabled: parseFloat(e.target.value) > 0,
                                })
                              }
                              className="flex-1 accent-sky-400"
                            />
                          </div>
                        </div>

                        <LightMotionControls
                          config={activeLightConfig}
                          onChange={(patch) =>
                            updateLightConfig(activePreset.id, selectedLight.id, patch)
                          }
                        />

                        <div className="grid grid-cols-3 gap-1.5 text-[10px] pt-1 border-t border-slate-800">
                          <div>
                            <span className="text-slate-400 block">
                              設置X: {selectedLight.mountPosition[0]}m
                            </span>
                            <input
                              type="range"
                              min={-(stageWidth / 2 + 1)}
                              max={stageWidth / 2 + 1}
                              step={0.2}
                              value={selectedLight.mountPosition[0]}
                              onChange={(e) =>
                                updateFixturePosition(selectedLight.id, [
                                  parseFloat(e.target.value),
                                  selectedLight.mountPosition[1],
                                  selectedLight.mountPosition[2],
                                ])
                              }
                              className="w-full accent-emerald-400"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              高さY: {selectedLight.mountPosition[1]}m
                            </span>
                            <input
                              type="range"
                              min={0.15}
                              max={9.5}
                              step={0.2}
                              value={selectedLight.mountPosition[1]}
                              onChange={(e) =>
                                updateFixturePosition(selectedLight.id, [
                                  selectedLight.mountPosition[0],
                                  parseFloat(e.target.value),
                                  selectedLight.mountPosition[2],
                                ])
                              }
                              className="w-full accent-emerald-400"
                            />
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              奥行Z: {selectedLight.mountPosition[2]}m
                            </span>
                            <input
                              type="range"
                              min={-(stageDepth / 2 + 1.5)}
                              max={stageDepth / 2 + 2.5}
                              step={0.2}
                              value={selectedLight.mountPosition[2]}
                              onChange={(e) =>
                                updateFixturePosition(selectedLight.id, [
                                  selectedLight.mountPosition[0],
                                  selectedLight.mountPosition[1],
                                  parseFloat(e.target.value),
                                ])
                              }
                              className="w-full accent-emerald-400"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1 border-t border-slate-800">
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-300">
                            <Crosshair className="w-3 h-3" />
                            照射ターゲット
                          </div>
                          <select
                            value={activeLightConfig.followPerformerId || ''}
                            onChange={(e) => {
                              const val = e.target.value || null;
                              const perfPos =
                                val && activeFormation
                                  ? activeFormation.positions[val]
                                  : null;
                              updateLightConfig(activePreset.id, selectedLight.id, {
                                followPerformerId: val,
                                ...(perfPos
                                  ? { targetX: perfPos.x, targetZ: perfPos.z }
                                  : {}),
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
                          >
                            <option value="">座標指定</option>
                            {performers.map((p, idx) => (
                              <option key={p.id} value={p.id}>
                                {idx + 1}. {p.name}
                              </option>
                            ))}
                          </select>

                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-slate-400 block">
                                照射X: {activeLightConfig.targetX}m
                              </span>
                              <input
                                type="range"
                                min={-stageWidth / 2}
                                max={stageWidth / 2}
                                step={0.45}
                                value={activeLightConfig.targetX}
                                onChange={(e) =>
                                  updateLightConfig(
                                    activePreset.id,
                                    selectedLight.id,
                                    {
                                      targetX: parseFloat(e.target.value),
                                      followPerformerId: null,
                                    }
                                  )
                                }
                                className="w-full accent-amber-400"
                              />
                            </div>
                            <div>
                              <span className="text-slate-400 block">
                                照射Z: {activeLightConfig.targetZ}m
                              </span>
                              <input
                                type="range"
                                min={-stageDepth / 2}
                                max={stageDepth / 2}
                                step={0.45}
                                value={activeLightConfig.targetZ}
                                onChange={(e) =>
                                  updateLightConfig(
                                    activePreset.id,
                                    selectedLight.id,
                                    {
                                      targetZ: parseFloat(e.target.value),
                                      followPerformerId: null,
                                    }
                                  )
                                }
                                className="w-full accent-amber-400"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= TIMELINE & LISTS INSPECTOR ================= */}
      {currentStep === 'timeline' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3.5 py-2 bg-slate-950 border-b border-slate-800 flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            <span>タイムライン秒数設定・キュー一覧</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
            {(overlappedFormationIds.size > 0 ||
              overlappedLightingIds.size > 0) && (
              <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/80 text-rose-200 text-xs space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-rose-300">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>タイムラインが重なっています</span>
                </div>
                <p className="text-[11px] text-rose-200/90 leading-relaxed">
                  同じトラック内で時間帯が重複しているバー（赤枠表示）があります。開始時間または終了時間を調整してください。
                </p>
              </div>
            )}

            {selectedFC && (
              <div className="bg-slate-950 border border-sky-500/50 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-xs font-bold text-sky-400">
                    配置キュー設定
                  </span>
                  {formationCues.length > 1 && (
                    <button
                      onClick={() => deleteFormationCue(selectedFC.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedFC.formationId}
                  onChange={(e) =>
                    updateFormationCue(selectedFC.id, {
                      formationId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-slate-100 font-semibold"
                >
                  {formations.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-slate-400">
                      開始時間
                    </label>
                    <TimeCodeInput
                      value={selectedFC.time}
                      onChange={(newStart) => {
                        const currentEnd =
                          Math.round(
                            (selectedFC.time + Math.max(0.01, selectedFC.duration)) * 100
                          ) / 100;
                        if (newStart < currentEnd) {
                          updateFormationCue(selectedFC.id, {
                            time: newStart,
                            duration: Math.max(
                              0.01,
                              Math.round((currentEnd - newStart) * 100) / 100
                            ),
                          });
                        } else {
                          updateFormationCue(selectedFC.id, { time: newStart });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-sky-500 rounded px-2 py-1 text-xs text-sky-300"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-sky-300 font-semibold">
                      終了時間
                    </label>
                    <TimeCodeInput
                      value={
                        Math.round(
                          (selectedFC.time + Math.max(0.01, selectedFC.duration)) * 100
                        ) / 100
                      }
                      min={Math.round((selectedFC.time + 0.01) * 100) / 100}
                      onChange={(newEnd) => {
                        const nextDur = Math.max(
                          0.01,
                          Math.round((newEnd - selectedFC.time) * 100) / 100
                        );
                        updateFormationCue(selectedFC.id, {
                          duration: nextDur,
                        });
                      }}
                      className="w-full bg-slate-900 border border-sky-500/60 focus:border-sky-400 rounded px-2 py-1 text-xs text-sky-300 font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    selectFormation(selectedFC.formationId);
                    setCurrentStep('formations');
                  }}
                  className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-sky-300 font-semibold"
                >
                  立ち位置を編集 →
                </button>
              </div>
            )}

            {selectedLC && (
              <div className="bg-slate-950 border border-amber-500/50 rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-xs font-bold text-amber-400">
                    照明キュー設定
                  </span>
                  {lightingCues.length > 1 && (
                    <button
                      onClick={() => deleteLightingCue(selectedLC.id)}
                      className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <select
                  value={selectedLC.presetId}
                  onChange={(e) =>
                    updateLightingCue(selectedLC.id, {
                      presetId: e.target.value,
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-amber-200 font-semibold"
                >
                  {lightingPresets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-slate-400">
                      開始時間
                    </label>
                    <TimeCodeInput
                      value={selectedLC.time}
                      onChange={(newStart) => {
                        const currentEnd =
                          Math.round(
                            (selectedLC.time + Math.max(0.01, selectedLC.duration)) * 100
                          ) / 100;
                        if (newStart < currentEnd) {
                          updateLightingCue(selectedLC.id, {
                            time: newStart,
                            duration: Math.max(
                              0.01,
                              Math.round((currentEnd - newStart) * 100) / 100
                            ),
                          });
                        } else {
                          updateLightingCue(selectedLC.id, { time: newStart });
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 focus:border-amber-500 rounded px-2 py-1 text-xs text-amber-300"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] text-amber-300 font-semibold">
                      終了時間
                    </label>
                    <TimeCodeInput
                      value={
                        Math.round(
                          (selectedLC.time + Math.max(0.01, selectedLC.duration)) * 100
                        ) / 100
                      }
                      min={Math.round((selectedLC.time + 0.01) * 100) / 100}
                      onChange={(newEnd) => {
                        const nextDur = Math.max(
                          0.01,
                          Math.round((newEnd - selectedLC.time) * 100) / 100
                        );
                        updateLightingCue(selectedLC.id, {
                          duration: nextDur,
                        });
                      }}
                      className="w-full bg-slate-900 border border-amber-500/60 focus:border-amber-400 rounded px-2 py-1 text-xs text-amber-300 font-bold"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    selectPreset(selectedLC.presetId);
                    setCurrentStep('lighting');
                  }}
                  className="w-full py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] text-amber-300 font-semibold"
                >
                  照明を編集 →
                </button>
              </div>
            )}

            {/* 1. 配置キュー一覧 */}
            <div className="bg-slate-950/70 border border-sky-500/30 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                  <LayoutGrid className="w-3.5 h-3.5" />
                  配置キュー一覧 ({formationCues.length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  開始 〜 終了
                </span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {formationCues.map((fc) => {
                  const f = formations.find((x) => x.id === fc.formationId);
                  const isOver = overlappedFormationIds.has(fc.id);
                  const endTime =
                    Math.round((fc.time + Math.max(0.01, fc.duration)) * 100) / 100;
                  return (
                    <div
                      key={fc.id}
                      onClick={() => {
                        selectFormationCue(fc.id);
                        setCurrentTime(fc.time);
                      }}
                      className={`px-2 py-1 rounded text-xs flex items-center justify-between gap-1.5 cursor-pointer ${
                        isOver
                          ? 'bg-rose-950/90 border border-rose-500 text-rose-200'
                          : selectedFormationCueId === fc.id
                          ? 'bg-sky-600/30 border border-sky-500 text-white'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {f?.name}
                      </span>
                      <span className="text-[10px] text-sky-300 shrink-0 font-mono">
                        {formatTimestamp(fc.time)}〜{formatTimestamp(endTime)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. 照明キュー一覧 */}
            <div className="bg-slate-950/70 border border-amber-500/30 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 flex items-center gap-1">
                  <Lightbulb className="w-3.5 h-3.5" />
                  照明キュー一覧 ({lightingCues.length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  開始 〜 終了
                </span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {lightingCues.map((lc) => {
                  const p = lightingPresets.find((x) => x.id === lc.presetId);
                  const isOver = overlappedLightingIds.has(lc.id);
                  const endTime =
                    Math.round((lc.time + Math.max(0.01, lc.duration)) * 100) / 100;
                  return (
                    <div
                      key={lc.id}
                      onClick={() => {
                        selectLightingCue(lc.id);
                        setCurrentTime(lc.time);
                      }}
                      className={`px-2 py-1 rounded text-xs flex items-center justify-between gap-1.5 cursor-pointer ${
                        isOver
                          ? 'bg-rose-950/90 border border-rose-500 text-rose-200'
                          : selectedLightingCueId === lc.id
                          ? 'bg-amber-500/30 border border-amber-400 text-white'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate font-semibold">
                        {p?.name}
                      </span>
                      <span className="text-[10px] text-amber-300 shrink-0 font-mono">
                        {formatTimestamp(lc.time)}〜{formatTimestamp(endTime)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
