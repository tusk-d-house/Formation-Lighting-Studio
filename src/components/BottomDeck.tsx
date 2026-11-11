import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Music,
  Volume2,
  VolumeX,
  FileDown,
  FileSpreadsheet,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Pin,
  SkipBack,
  SkipForward,
} from 'lucide-react';
import { useFormationStore } from '../store/useFormationStore';
import { formatTimestamp } from '../utils/interpolation';
import { saveProjectAudio, decodeAudioWaveform } from '../utils/audioStorage';
import { downloadAttendanceXlsx } from '../utils/exportAttendanceSheet';
import { TimeCodeInput } from './TimeCodeInput';

interface CueDragState {
  track: 'formation' | 'lighting';
  cueId: string;
  mode: 'move' | 'resize-left' | 'resize-right';
  startClientX: number;
  initialTime: number;
  initialDuration: number;
}

const findOverlappingCueIds = <
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

const WaveformCanvas: React.FC<{
  peaks: number[];
  zoom: number;
  duration: number;
  audioDuration: number | null;
}> = ({ peaks, zoom, duration, audioDuration }) => {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const draw = () => {
      const w = Math.max(1, Math.min(16384, Math.floor(wrap.clientWidth)));
      const h = Math.max(1, Math.floor(wrap.clientHeight));
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const data =
        peaks.length > 0
          ? peaks
          : Array.from({ length: 180 }, (_, i) =>
              0.2 + 0.6 * Math.abs(Math.sin(i * 0.35))
            );
      const n = data.length;
      const mid = h / 2;
      const safeTimelineDur = Math.max(0.01, duration);
      const effAudioDur =
        peaks.length > 0 && audioDuration && audioDuration > 0
          ? audioDuration
          : safeTimelineDur;

      ctx.fillStyle = 'rgba(14,165,233,0.6)';
      for (let x = 0; x < w; x++) {
        const t0 = (x / w) * safeTimelineDur;
        const t1 = ((x + 1) / w) * safeTimelineDur;
        if (t0 >= effAudioDur) continue;
        const from = Math.max(0, Math.floor((t0 / effAudioDur) * n));
        const to = Math.min(n, Math.max(from + 1, Math.ceil((t1 / effAudioDur) * n)));
        let m = 0;
        for (let k = from; k < to; k++) {
          if (data[k] > m) m = data[k];
        }
        const bar = Math.max(1, m * h * 0.9);
        ctx.fillRect(x, mid - bar / 2, 1, bar);
      }
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(wrap);
    return () => ro.disconnect();
  }, [peaks, zoom, duration, audioDuration]);

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 pointer-events-none opacity-80"
    >
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};

export const BottomDeck: React.FC = () => {
  const {
    projectName,
    currentStep,
    stageWidth,
    stageDepth,
    wingWidth,
    performers,
    formations,
    activeFormationId,
    lightingPresets,
    activePresetId,
    formationCues,
    lightingCues,
    timelinePins,
    selectedFormationCueId,
    selectedLightingCueId,
    timelineZoom,
    isPlaying,
    currentTime,
    duration,
    audioDuration,
    audioUrl,
    audioFileName,
    audioWaveform,
    useDemoBeat,
    selectFormation,
    addFormation,
    duplicateFormation,
    deleteFormation,
    moveFormationOrder,
    reorderFormations,
    selectPreset,
    addLightingPreset,
    duplicateLightingPreset,
    deleteLightingPreset,
    reorderLightingPresets,
    selectFormationCue,
    selectLightingCue,
    addFormationCue,
    updateFormationCue,
    addLightingCue,
    updateLightingCue,
    addTimelinePin,
    removePreviousTimelinePin,
    removeTimelinePin,
    jumpToPrevTimelinePin,
    jumpToNextTimelinePin,
    setTimelineZoom,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setAudioData,
    setUseDemoBeat,
    setShowPdfModal,
    pushHistorySnapshot,
  } = useFormationStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeatIndexRef = useRef<number>(-1);
  const timelineContentRef = useRef<HTMLDivElement | null>(null);
  const formationsScrollRef = useRef<HTMLDivElement | null>(null);
  const presetsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const [dragState, setDragState] = useState<CueDragState | null>(null);
  const [snappedPinTime, setSnappedPinTime] = useState<number | null>(null);
  const [draggedFormationIdx, setDraggedFormationIdx] = useState<number | null>(null);
  const [formationInsertIdx, setFormationInsertIdx] = useState<number | null>(null);
  const [draggedPresetIdx, setDraggedPresetIdx] = useState<number | null>(null);
  const [presetInsertIdx, setPresetInsertIdx] = useState<number | null>(null);

  // Apply timeline zoom anchored around the playhead (red vertical line / currentTime)
  const applyZoomWithTimeAnchor = (nextZoom: number) => {
    const clampedZoom = Math.max(
      1,
      Math.min(40, Math.round(nextZoom * 10) / 10)
    );
    if (clampedZoom === timelineZoom) return;

    const scrollEl = timelineScrollRef.current;
    if (!scrollEl || duration <= 0) {
      setTimelineZoom(clampedZoom);
      return;
    }

    const viewportW = scrollEl.clientWidth;
    const currentScrollLeft = scrollEl.scrollLeft;
    const currentContentW = scrollEl.scrollWidth;
    const oldZoom = timelineZoom;

    // Content X coordinate of current time (red line) before zoom
    const redLineContentX = (currentTime / duration) * currentContentW;
    // Viewport-relative X position of the red line
    let viewX = redLineContentX - currentScrollLeft;

    // If red line is out of viewport view, gently center it
    if (viewX < 20 || viewX > viewportW - 20) {
      viewX = viewportW / 2;
    }

    const zoomRatio = clampedZoom / oldZoom;
    const newContentW = currentContentW * zoomRatio;
    const newRedLineContentX = (currentTime / duration) * newContentW;
    const targetScrollLeft = Math.max(0, newRedLineContentX - viewX);

    setTimelineZoom(clampedZoom);

    requestAnimationFrame(() => {
      if (timelineScrollRef.current) {
        timelineScrollRef.current.scrollLeft = targetScrollLeft;
      }
    });
  };

  // Wheel horizontal scrolling & touchpad pinch-to-zoom on the timeline
  useEffect(() => {
    const el =
      currentStep === 'formations'
        ? formationsScrollRef.current
        : currentStep === 'lighting'
        ? presetsScrollRef.current
        : timelineScrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        if (currentStep === 'timeline') {
          e.preventDefault();
          const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
          const nextZoom = timelineZoom * zoomFactor;
          applyZoomWithTimeAnchor(nextZoom);
        }
      } else {
        if (e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
          el.scrollLeft += e.deltaY;
        }
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [currentStep, timelineZoom, currentTime, duration, setTimelineZoom]);

  const playSynthBeat = (beatNumber: number) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const isDownbeat = beatNumber % 4 === 0;
      osc.type = isDownbeat ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(isDownbeat ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(isDownbeat ? 0.12 : 0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      if (audioRef.current) audioRef.current.pause();
      lastBeatIndexRef.current = -1;
      return;
    }

    const initialSt = useFormationStore.getState();
    if (audioUrl && audioRef.current && !initialSt.isRecordingVideo) {
      audioRef.current.currentTime = currentTime;
      audioRef.current.play().catch(() => {});
    } else if (audioRef.current && initialSt.isRecordingVideo) {
      audioRef.current.pause();
    }

    let animId: number;
    let lastTs = performance.now();

    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;

      const st = useFormationStore.getState();
      let nextTime = st.currentTime + dt;

      if (
        st.audioUrl &&
        audioRef.current &&
        !audioRef.current.paused &&
        !st.isRecordingVideo
      ) {
        nextTime = audioRef.current.currentTime;
      }

      if (!st.audioUrl && st.useDemoBeat && !st.isRecordingVideo) {
        const beatIdx = Math.floor(nextTime * 2);
        if (beatIdx !== lastBeatIndexRef.current) {
          lastBeatIndexRef.current = beatIdx;
          playSynthBeat(beatIdx);
        }
      }

      if (nextTime >= st.duration) {
        st.setCurrentTime(0);
        st.setIsPlaying(false);
        return;
      }

      st.setCurrentTime(nextTime);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, audioUrl]);

  // Global mouse move / up handler for dragging & edge-resizing timeline cues
  useEffect(() => {
    if (!dragState) return;

    const handleMouseMove = (e: MouseEvent) => {
      const container = timelineContentRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0) return;

      const deltaPx = e.clientX - dragState.startClientX;
      const deltaSec = (deltaPx / rect.width) * duration;
      // Magnetic snap threshold (~10px on screen, minimum 0.12s)
      const snapThresholdSec = Math.max(0.12, (10 / rect.width) * duration);
      const pins = useFormationStore.getState().timelinePins;

      if (dragState.mode === 'move') {
        const rawStart = Math.max(
          0,
          Math.min(duration - 0.01, dragState.initialTime + deltaSec)
        );
        let newTime = Math.round(rawStart * 100) / 100;
        let activeSnapPin: number | null = null;
        let bestDist = snapThresholdSec;

        for (const pin of pins) {
          // Check start edge snap to pin
          const distStart = Math.abs(rawStart - pin);
          if (distStart <= bestDist) {
            bestDist = distStart;
            newTime = Math.max(0, Math.min(duration - 0.01, pin));
            activeSnapPin = pin;
          }
          // Check right/end edge snap to pin
          const rawEnd = rawStart + dragState.initialDuration;
          const distEnd = Math.abs(rawEnd - pin);
          if (
            distEnd <= bestDist &&
            pin - dragState.initialDuration >= 0 &&
            pin - dragState.initialDuration <= duration - 0.01
          ) {
            bestDist = distEnd;
            newTime = Math.round((pin - dragState.initialDuration) * 100) / 100;
            activeSnapPin = pin;
          }
        }

        setSnappedPinTime(activeSnapPin);
        if (dragState.track === 'formation') {
          updateFormationCue(dragState.cueId, { time: newTime });
        } else {
          updateLightingCue(dragState.cueId, { time: newTime });
        }
        setCurrentTime(newTime);
      } else if (dragState.mode === 'resize-right') {
        const rawEnd = Math.max(
          dragState.initialTime + 0.01,
          Math.min(duration, dragState.initialTime + dragState.initialDuration + deltaSec)
        );
        let snappedEnd = Math.round(rawEnd * 100) / 100;
        let activeSnapPin: number | null = null;
        let bestDist = snapThresholdSec;

        for (const pin of pins) {
          if (pin >= dragState.initialTime + 0.01 && pin <= duration) {
            const dist = Math.abs(rawEnd - pin);
            if (dist <= bestDist) {
              bestDist = dist;
              snappedEnd = pin;
              activeSnapPin = pin;
            }
          }
        }

        setSnappedPinTime(activeSnapPin);
        const newDur = Math.max(
          0.01,
          Math.min(
            duration - dragState.initialTime,
            Math.round((snappedEnd - dragState.initialTime) * 100) / 100
          )
        );
        if (dragState.track === 'formation') {
          updateFormationCue(dragState.cueId, { duration: newDur });
        } else {
          updateLightingCue(dragState.cueId, { duration: newDur });
        }
      } else if (dragState.mode === 'resize-left') {
        const endSec = dragState.initialTime + dragState.initialDuration;
        const rawStart = Math.max(
          0,
          Math.min(endSec - 0.01, dragState.initialTime + deltaSec)
        );
        let newStart = Math.round(rawStart * 100) / 100;
        let activeSnapPin: number | null = null;
        let bestDist = snapThresholdSec;

        for (const pin of pins) {
          if (pin >= 0 && pin <= endSec - 0.01) {
            const dist = Math.abs(rawStart - pin);
            if (dist <= bestDist) {
              bestDist = dist;
              newStart = pin;
              activeSnapPin = pin;
            }
          }
        }

        setSnappedPinTime(activeSnapPin);
        const newDur = Math.max(0.01, Math.round((endSec - newStart) * 100) / 100);
        if (dragState.track === 'formation') {
          updateFormationCue(dragState.cueId, { time: newStart, duration: newDur });
        } else {
          updateLightingCue(dragState.cueId, { time: newStart, duration: newDur });
        }
        setCurrentTime(newStart);
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
      setSnappedPinTime(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, duration, updateFormationCue, updateLightingCue, setCurrentTime]);

  const seekToPointerX = (clientX: number, fallbackEl: HTMLElement) => {
    const container = timelineContentRef.current || fallbackEl;
    const rect = container.getBoundingClientRect();
    if (rect.width <= 0) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const t = Math.round(ratio * duration * 100) / 100;
    setCurrentTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);

    try {
      const arrayBuf = await file.arrayBuffer();
      const { peaks: normalized, duration: decodedDur } = await decodeAudioWaveform(
        arrayBuf
      );
      setAudioData(url, file.name, normalized, decodedDur);

      const projId = useFormationStore.getState().activeProjectId;
      if (projId) {
        saveProjectAudio(
          projId,
          arrayBuf,
          file.name,
          file.type || 'audio/mpeg',
          normalized,
          decodedDur
        )
          .then(() => {
            useFormationStore.getState().saveCurrentProject();
          })
          .catch(() => {});
      }
    } catch {
      setAudioData(url, file.name, []);
    }
  };

  const formatTime = (sec: number) => formatTimestamp(sec);

  // Format ruler tick label cleanly as "xx:xx.x"
  const formatRulerTick = (sec: number) => formatTimestamp(sec);

  // ================= STEP 1: FORMATION CARDS STRIP =================
  if (currentStep === 'formations') {
    const totalW = stageWidth + wingWidth * 2;

    const executeFormationReorder = (fromIdx: number | null, toSlot: number | null) => {
      if (fromIdx !== null && toSlot !== null && !isNaN(fromIdx)) {
        const targetIdx = toSlot > fromIdx ? toSlot - 1 : toSlot;
        if (targetIdx !== fromIdx && targetIdx >= 0 && targetIdx < formations.length) {
          reorderFormations(fromIdx, targetIdx);
        }
      }
      setDraggedFormationIdx(null);
      setFormationInsertIdx(null);
    };

    const handleFormationContainerDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData('text/plain');
      const fromIdx = fromStr !== '' ? parseInt(fromStr, 10) : draggedFormationIdx;
      if (fromIdx !== null && formationInsertIdx !== null) {
        executeFormationReorder(fromIdx, formationInsertIdx);
      } else {
        setDraggedFormationIdx(null);
        setFormationInsertIdx(null);
      }
    };

    return (
      <footer className="h-full bg-slate-900 border-t border-slate-800 flex flex-col select-none shrink-0 print:hidden">
        <div className="px-4 py-1.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-sky-400">
              フォーメーション ({formations.length})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => downloadAttendanceXlsx(projectName, performers, formations)}
              title="ダンサーごとの出演表(.xlsx)を出力します（グレー以外の色を出演＝TRUEと判定）"
              className="px-2.5 py-1 rounded bg-teal-600/20 hover:bg-teal-600/30 border border-teal-500/40 text-teal-300 text-xs font-bold flex items-center gap-1 transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              出演表(Excel)
            </button>
            <button
              onClick={() => setShowPdfModal(true)}
              className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1 transition"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF化
            </button>
            <button
              onClick={addFormation}
              className="px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              追加
            </button>
          </div>
        </div>

        <div
          ref={formationsScrollRef}
          className="flex-1 px-4 py-2.5 overflow-x-auto flex items-center gap-2.5"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={handleFormationContainerDrop}
        >
          {formations.map((f, idx) => {
            const isSelected = f.id === activeFormationId;
            const isBeingDragged = draggedFormationIdx === idx;
            const showLeftIndicator =
              draggedFormationIdx !== null &&
              formationInsertIdx === idx &&
              formationInsertIdx !== draggedFormationIdx &&
              formationInsertIdx !== draggedFormationIdx + 1;
            const showRightIndicator =
              draggedFormationIdx !== null &&
              idx === formations.length - 1 &&
              formationInsertIdx === formations.length &&
              draggedFormationIdx !== formations.length - 1;

            return (
              <div
                key={f.id}
                draggable
                onDragStart={(e) => {
                  setDraggedFormationIdx(idx);
                  e.dataTransfer.setData('text/plain', String(idx));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nextInsert =
                    e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
                  if (formationInsertIdx !== nextInsert) {
                    setFormationInsertIdx(nextInsert);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const targetSlot =
                    e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
                  const fromStr = e.dataTransfer.getData('text/plain');
                  const fromIdx = fromStr !== '' ? parseInt(fromStr, 10) : draggedFormationIdx;
                  executeFormationReorder(fromIdx, targetSlot);
                }}
                onDragEnd={() => {
                  setDraggedFormationIdx(null);
                  setFormationInsertIdx(null);
                }}
                onClick={() => selectFormation(f.id)}
                className={`relative w-48 h-full rounded-xl border p-2 cursor-grab active:cursor-grabbing transition flex flex-col justify-between shrink-0 ${
                  isBeingDragged
                    ? 'opacity-45 scale-95 border-sky-400/50 bg-slate-900'
                    : isSelected
                    ? 'bg-slate-800 border-sky-400 shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 hover:bg-slate-800/50'
                }`}
              >
                {/* Left Drop Target Indicator */}
                {showLeftIndicator && (
                  <div className="absolute -left-1.5 top-1 bottom-1 w-1 bg-sky-400 rounded-full shadow-[0_0_10px_#38bdf8] pointer-events-none z-30" />
                )}
                {/* Right Drop Target Indicator (for last item) */}
                {showRightIndicator && (
                  <div className="absolute -right-1.5 top-1 bottom-1 w-1 bg-sky-400 rounded-full shadow-[0_0_10px_#38bdf8] pointer-events-none z-30" />
                )}
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {idx + 1}. {f.name.replace(/^Formation \d+:\s*/, '')}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFormationOrder(f.id, 'left');
                        }}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          moveFormationOrder(f.id, 'right');
                        }}
                        disabled={idx === formations.length - 1}
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateFormation(f.id);
                        }}
                        className="p-0.5 text-slate-400 hover:text-sky-300"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                      {formations.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFormation(f.id);
                          }}
                          className="p-0.5 text-slate-400 hover:text-rose-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 my-1 bg-slate-900 rounded border border-slate-800 overflow-hidden flex items-center justify-center">
                    <svg
                      viewBox={`${-totalW / 2 - 0.6} ${-stageDepth / 2 - 0.6} ${
                        totalW + 1.2
                      } ${stageDepth + 1.2}`}
                      className="w-full h-full"
                    >
                      <rect
                        x={-totalW / 2}
                        y={-stageDepth / 2}
                        width={wingWidth}
                        height={stageDepth}
                        fill="#04070d"
                        stroke="#1e293b"
                        strokeWidth={0.1}
                      />
                      <rect
                        x={stageWidth / 2}
                        y={-stageDepth / 2}
                        width={wingWidth}
                        height={stageDepth}
                        fill="#04070d"
                        stroke="#1e293b"
                        strokeWidth={0.1}
                      />
                      <rect
                        x={-stageWidth / 2}
                        y={-stageDepth / 2}
                        width={stageWidth}
                        height={stageDepth}
                        fill="#090d16"
                        stroke="#334155"
                        strokeWidth={0.14}
                      />
                      <line
                        x1={-stageWidth / 2}
                        y1={-stageDepth / 2}
                        x2={-stageWidth / 2}
                        y2={stageDepth / 2}
                        stroke="#e11d48"
                        strokeWidth={0.18}
                      />
                      <line
                        x1={stageWidth / 2}
                        y1={-stageDepth / 2}
                        x2={stageWidth / 2}
                        y2={stageDepth / 2}
                        stroke="#e11d48"
                        strokeWidth={0.18}
                      />
                      {performers.map((p) => {
                        const pos = f.positions[p.id] || { x: 0, z: 0 };
                        const dCol = f.colors?.[p.id] || p.color;
                        const inWing = Math.abs(pos.x) > stageWidth / 2 + 0.05;
                        return (
                          <circle
                            key={p.id}
                            cx={pos.x}
                            cy={pos.z}
                            r={0.42}
                            fill={dCol}
                            opacity={inWing ? 0.45 : 1}
                          />
                        );
                      })}
                    </svg>
                  </div>

                  <div className="text-[10px] text-slate-400 truncate">
                    {f.notes || 'メモなし'}
                  </div>
                </div>
            );
          })}

          <button
            onClick={addFormation}
            className="w-36 h-full rounded-xl border border-dashed border-slate-700 hover:border-sky-500 hover:bg-slate-800/40 text-slate-400 hover:text-sky-300 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>フォーメーション追加</span>
          </button>
        </div>
      </footer>
    );
  }

  // ================= STEP 2: LIGHTING PRESETS CARDS STRIP =================
  if (currentStep === 'lighting') {
    const executePresetReorder = (fromIdx: number | null, toSlot: number | null) => {
      if (fromIdx !== null && toSlot !== null && !isNaN(fromIdx)) {
        const targetIdx = toSlot > fromIdx ? toSlot - 1 : toSlot;
        if (targetIdx !== fromIdx && targetIdx >= 0 && targetIdx < lightingPresets.length) {
          reorderLightingPresets(fromIdx, targetIdx);
        }
      }
      setDraggedPresetIdx(null);
      setPresetInsertIdx(null);
    };

    const handlePresetContainerDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const fromStr = e.dataTransfer.getData('text/plain');
      const fromIdx = fromStr !== '' ? parseInt(fromStr, 10) : draggedPresetIdx;
      if (fromIdx !== null && presetInsertIdx !== null) {
        executePresetReorder(fromIdx, presetInsertIdx);
      } else {
        setDraggedPresetIdx(null);
        setPresetInsertIdx(null);
      }
    };

    return (
      <footer className="h-full bg-slate-900 border-t border-slate-800 flex flex-col select-none shrink-0 print:hidden">
        <div className="px-4 py-1.5 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-amber-400">
              照明プリセット ({lightingPresets.length})
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 ml-2">
              <span>確認用配置:</span>
              <select
                value={activeFormationId}
                onChange={(e) => selectFormation(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-200"
              >
                {formations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={addLightingPreset}
            className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            新規照明プリセット作成 (N)
          </button>
        </div>

        <div
          ref={presetsScrollRef}
          className="flex-1 px-4 py-2.5 overflow-x-auto flex items-center gap-2.5"
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          }}
          onDrop={handlePresetContainerDrop}
        >
          {lightingPresets.map((preset, idx) => {
            const isSelected = preset.id === activePresetId;
            const isBeingDragged = draggedPresetIdx === idx;
            const lightEntries = Object.entries(preset.lights);
            const onCount = lightEntries.filter(
              ([, l]) => l.enabled && l.intensity > 0
            ).length;
            const hasRainbow = lightEntries.some(([, l]) => l.enabled && l.rainbow);
            const showLeftIndicator =
              draggedPresetIdx !== null &&
              presetInsertIdx === idx &&
              presetInsertIdx !== draggedPresetIdx &&
              presetInsertIdx !== draggedPresetIdx + 1;
            const showRightIndicator =
              draggedPresetIdx !== null &&
              idx === lightingPresets.length - 1 &&
              presetInsertIdx === lightingPresets.length &&
              draggedPresetIdx !== lightingPresets.length - 1;

            return (
              <div
                key={preset.id}
                draggable
                onDragStart={(e) => {
                  setDraggedPresetIdx(idx);
                  e.dataTransfer.setData('text/plain', String(idx));
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nextInsert =
                    e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
                  if (presetInsertIdx !== nextInsert) {
                    setPresetInsertIdx(nextInsert);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  const targetSlot =
                    e.clientX < rect.left + rect.width / 2 ? idx : idx + 1;
                  const fromStr = e.dataTransfer.getData('text/plain');
                  const fromIdx = fromStr !== '' ? parseInt(fromStr, 10) : draggedPresetIdx;
                  executePresetReorder(fromIdx, targetSlot);
                }}
                onDragEnd={() => {
                  setDraggedPresetIdx(null);
                  setPresetInsertIdx(null);
                }}
                onClick={() => selectPreset(preset.id)}
                className={`relative w-60 h-full rounded-xl border p-3 cursor-grab active:cursor-grabbing transition flex flex-col justify-between shrink-0 ${
                  isBeingDragged
                    ? 'opacity-45 scale-95 border-amber-400/50 bg-slate-900'
                    : isSelected
                    ? 'bg-slate-800 border-amber-400 shadow-lg'
                    : 'bg-slate-950/80 border-slate-800 hover:bg-slate-800/50'
                }`}
              >
                {/* Left Drop Target Indicator */}
                {showLeftIndicator && (
                  <div className="absolute -left-1.5 top-1 bottom-1 w-1 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24] pointer-events-none z-30" />
                )}
                {/* Right Drop Target Indicator (for last item) */}
                {showRightIndicator && (
                  <div className="absolute -right-1.5 top-1 bottom-1 w-1 bg-amber-400 rounded-full shadow-[0_0_10px_#fbbf24] pointer-events-none z-30" />
                )}
                  <div className="flex items-start justify-between gap-1">
                    <span className="text-xs font-bold text-slate-100 truncate">
                      {idx + 1}. {preset.name.replace(/^Preset \d+:\s*/, '')}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx > 0) reorderLightingPresets(idx, idx - 1);
                        }}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (idx < lightingPresets.length - 1)
                            reorderLightingPresets(idx, idx + 1);
                        }}
                        disabled={idx === lightingPresets.length - 1}
                        className="p-0.5 text-slate-400 hover:text-white disabled:opacity-20"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateLightingPreset(preset.id);
                        }}
                        className="text-slate-400 hover:text-amber-300 p-0.5"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {lightingPresets.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteLightingPreset(preset.id);
                          }}
                          className="text-slate-400 hover:text-rose-400 p-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 my-1 flex-wrap">
                    {hasRainbow && (
                      <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-gradient-to-r from-rose-500 via-amber-400 to-cyan-400 text-slate-950">
                        RAINBOW
                      </span>
                    )}
                    <span className="text-[11px] text-slate-300">
                      点灯中: <strong className="text-amber-300">{onCount}</strong> /{' '}
                      {lightEntries.length}灯
                    </span>
                  </div>
                </div>
            );
          })}

          <button
            onClick={addLightingPreset}
            className="w-40 h-full rounded-xl border border-dashed border-slate-700 hover:border-amber-400 hover:bg-slate-800/40 text-slate-400 hover:text-amber-300 flex flex-col items-center justify-center gap-1 text-xs font-semibold transition shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>プリセット追加</span>
          </button>
        </div>
      </footer>
    );
  }

  // ================= STEP 3: MULTI-TRACK TIMELINE WITH DYNAMIC RULER & DRAG-RESIZE BLOCKS =================
  // Dynamically compute tick intervals based on visible seconds (duration / timelineZoom)
  // so 5-minute (~300s) audio tracks always display clean, non-overlapping time marks!
  const visibleSeconds = duration / timelineZoom;
  let tickStep = 1;
  let majorStep = 5;

  if (visibleSeconds > 240) {
    tickStep = 10;
    majorStep = 30;
  } else if (visibleSeconds > 120) {
    tickStep = 5;
    majorStep = 15;
  } else if (visibleSeconds > 60) {
    tickStep = 2;
    majorStep = 10;
  } else if (visibleSeconds > 30) {
    tickStep = 1;
    majorStep = 5;
  } else if (visibleSeconds > 14) {
    tickStep = 0.5;
    majorStep = 2;
  } else if (visibleSeconds > 6) {
    tickStep = 0.2;
    majorStep = 1;
  } else if (visibleSeconds > 2) {
    tickStep = 0.1;
    majorStep = 0.5;
  } else {
    tickStep = 0.05;
    majorStep = 0.2;
  }

  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += tickStep) {
    ticks.push(Math.round(t * 100) / 100);
  }

  const overlappedFormationIds = findOverlappingCueIds(formationCues);
  const overlappedLightingIds = findOverlappingCueIds(lightingCues);
  const totalOverlapCount =
    overlappedFormationIds.size + overlappedLightingIds.size;

  return (
    <footer className="h-full bg-slate-900 border-t border-slate-800 flex flex-col select-none shrink-0 print:hidden">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={(e) => {
            const dur = e.currentTarget.duration;
            if (dur && isFinite(dur) && dur > 0) {
              const exactDur = Number(dur.toFixed(2));
              setDuration(exactDur);
              useFormationStore.setState({ audioDuration: dur });
            }
          }}
        />
      )}

      {/* Top Transport & Zoom Controls Bar */}
      <div className="px-2 py-1 border-b border-slate-800 bg-slate-950/70 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 max-h-[45%] overflow-y-auto shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`px-3.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 shadow transition ${
              isPlaying
                ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                : 'bg-sky-500 text-white hover:bg-sky-400'
            }`}
            title="スペースキー (Space) でも再生・一時停止できます"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                一時停止 (Space)
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                再生 (Space)
              </>
            )}
          </button>

          <button
            onClick={() => {
              setIsPlaying(false);
              setCurrentTime(0);
              if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="先頭(0秒)へ戻す (0キー / Homeキー)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-sky-400">
            {formatTime(currentTime)}{' '}
            <span className="text-slate-500">/ {formatTime(duration)}</span>
          </div>

          {/* Pin Controls: Place Pin at Playhead, Jump Prev/Next Pin, Delete Previous Pin */}
          <div className="flex items-center gap-1 bg-slate-900/95 border border-emerald-500/40 rounded-lg px-1.5 py-0.5 ml-1">
            <button
              onClick={() => addTimelinePin(currentTime)}
              className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold flex items-center gap-1 shadow transition"
              title="現在の再生位置（赤い線）にスナップ用ピンを置きます (Pキー)"
            >
              <Pin className="w-3 h-3 fill-current" />
              <span>ピンを置く</span>
            </button>
            <button
              onClick={() => {
                const target = jumpToPrevTimelinePin();
                if (target !== null && audioRef.current) {
                  audioRef.current.currentTime = target;
                }
              }}
              disabled={timelinePins.length === 0}
              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-emerald-300 text-[11px] font-semibold flex items-center gap-0.5 transition"
              title="再生位置を前のピンに移動"
            >
              <SkipBack className="w-3 h-3" />
              <span>前のピン</span>
            </button>
            <button
              onClick={() => {
                const target = jumpToNextTimelinePin();
                if (target !== null && audioRef.current) {
                  audioRef.current.currentTime = target;
                }
              }}
              disabled={timelinePins.length === 0}
              className="px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-35 text-emerald-300 text-[11px] font-semibold flex items-center gap-0.5 transition"
              title="再生位置を次のピンに移動"
            >
              <span>次のピン</span>
              <SkipForward className="w-3 h-3" />
            </button>
            <button
              onClick={() => removePreviousTimelinePin()}
              disabled={timelinePins.length === 0}
              className="px-1.5 py-1 rounded bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 disabled:opacity-35 text-rose-300 text-[11px] font-semibold flex items-center gap-0.5 transition"
              title="直前のピンを削除"
            >
              <Trash2 className="w-3 h-3" />
              <span>直前のピン削除</span>
            </button>
          </div>

          {totalOverlapCount > 0 && (
            <div className="px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/70 text-rose-300 text-[11px] font-bold flex items-center gap-1.5 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>タイムラインが重なっています ({totalOverlapCount}箇所)</span>
            </div>
          )}
        </div>

        {/* Center: Audio File & Metronome + Timeline Zoom Controls */}
        <div className="flex items-center gap-2.5">
          <label className="cursor-pointer px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-100 flex items-center gap-1.5 transition">
            <Music className="w-3.5 h-3.5 text-sky-400" />
            <span className="max-w-[140px] truncate">
              {audioFileName ? audioFileName : '音声読込(MP3/WAV)'}
            </span>
            <input
              type="file"
              accept="audio/*"
              onChange={handleAudioUpload}
              className="hidden"
            />
          </label>

          {!audioUrl && (
            <button
              onClick={() => setUseDemoBeat(!useDemoBeat)}
              className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 border transition ${
                useDemoBeat
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {useDemoBeat ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span>カウント音</span>
            </button>
          )}

          {/* Timeline Zoom Controls (1x to 40x for high precision editing) */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1">
            <button
              onClick={() => applyZoomWithTimeAnchor(timelineZoom - 0.5)}
              className="text-slate-400 hover:text-white"
              title="タイムラインを縮小 (現在時間・赤い線を軸に縮小)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min={1}
              max={40}
              step={0.5}
              value={timelineZoom}
              onChange={(e) => applyZoomWithTimeAnchor(parseFloat(e.target.value))}
              className="w-24 accent-sky-400"
              title="タイムライン拡大・縮小 (現在時間・赤い線を軸に拡大縮小)"
            />
            <button
              onClick={() => applyZoomWithTimeAnchor(timelineZoom + 0.5)}
              className="text-slate-400 hover:text-white"
              title="タイムラインを拡大 (現在時間・赤い線を軸に拡大)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-sky-400 w-8 text-right">
              {timelineZoom}x
            </span>
          </div>
        </div>

        {/* Right: Quick Add Cues */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() =>
              addFormationCue(currentTime, formations[0]?.id || 'f1', 3.0)
            }
            className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            配置維持バー追加
          </button>
          <button
            onClick={() =>
              addLightingCue(currentTime, lightingPresets[0]?.id || 'lp1', 3.0)
            }
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1 shadow transition"
          >
            <Plus className="w-3.5 h-3.5" />
            照明維持バー追加
          </button>
        </div>
      </div>

      {/* Scrollable Zoomable Timeline Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Fixed Track Labels Column */}
        <div className="w-24 bg-slate-950 border-r border-slate-800 flex flex-col justify-between py-1.5 shrink-0 text-[11px] font-bold">
          <div className="h-6 px-2.5 flex items-center text-slate-400 border-b border-slate-800/80">
            秒数
          </div>
          <div className="h-10 px-2.5 flex items-center text-slate-300">
            音源
          </div>
          <div className="h-11 px-2.5 flex items-center justify-between text-sky-400">
            <span>配置</span>
            {overlappedFormationIds.size > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="h-11 px-2.5 flex items-center justify-between text-amber-400">
            <span>照明</span>
            {overlappedLightingIds.size > 0 && (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
        </div>

        {/* Right Horizontally Scrollable Tracks Container */}
        <div
          ref={timelineScrollRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative bg-slate-950/60"
        >
          <div
            ref={timelineContentRef}
            style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}
            className="min-h-[170px] h-full flex flex-col justify-between py-1.5 relative"
          >
            {/* Timeline Pins Vertical Guide Lines across all tracks */}
            {timelinePins.map((pinTime) => {
              const leftPct = Math.min(100, Math.max(0, (pinTime / duration) * 100));
              const isSnapped =
                snappedPinTime !== null && Math.abs(snappedPinTime - pinTime) < 0.05;
              return (
                <div
                  key={`pin-line-${pinTime}`}
                  style={{ left: `${leftPct}%` }}
                  className={`absolute top-0 bottom-0 z-25 pointer-events-none transition-all ${
                    isSnapped
                      ? 'w-0.5 bg-emerald-300 shadow-[0_0_12px_#34d399]'
                      : 'w-px border-l border-dashed border-emerald-400/75'
                  }`}
                />
              );
            })}

            {/* Playhead Vertical Line across all tracks */}
            <div
              style={{ left: `${(currentTime / duration) * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30 pointer-events-none"
            >
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 -ml-1 -mt-0.5 shadow" />
            </div>

            {/* Row 0: Dynamic Seconds Ruler (秒数の印) */}
            <div className="relative h-6 border-b border-slate-800 flex items-end select-none">
              {ticks.map((sec) => {
                const leftPct = (sec / duration) * 100;
                const isMajor = Math.abs(sec % majorStep) < 0.001 || Math.abs((sec % majorStep) - majorStep) < 0.001;
                return (
                  <div
                    key={`tick-${sec}`}
                    style={{ left: `${leftPct}%` }}
                    className="absolute top-0 bottom-0 flex flex-col justify-end pointer-events-none"
                  >
                    {isMajor && (
                      <span className="text-[10px] font-mono -ml-3 mb-0.5 text-sky-300 font-bold whitespace-nowrap">
                        {formatRulerTick(sec)}
                      </span>
                    )}
                    <div
                      className={`w-px ${
                        isMajor ? 'h-2.5 bg-sky-400' : 'h-1.5 bg-slate-700'
                      }`}
                    />
                  </div>
                );
              })}

              {/* Pin Head Markers on the Ruler (Click to seek, Shift+Click or Right-Click to delete) */}
              {timelinePins.map((pinTime) => {
                const leftPct = Math.min(100, Math.max(0, (pinTime / duration) * 100));
                const isSnapped =
                  snappedPinTime !== null && Math.abs(snappedPinTime - pinTime) < 0.005;
                return (
                  <button
                    key={`pin-head-${pinTime}`}
                    type="button"
                    style={{ left: `${leftPct}%` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        removeTimelinePin(pinTime);
                        return;
                      }
                      setCurrentTime(pinTime);
                      if (audioRef.current) audioRef.current.currentTime = pinTime;
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeTimelinePin(pinTime);
                    }}
                    title={`ピン: ${formatTime(pinTime)}（クリックで移動 / 右クリックで削除）`}
                    className={`absolute top-0 -ml-2 px-1 py-0.5 rounded-b text-[9px] font-mono font-bold flex items-center gap-0.5 z-50 transition ${
                      isSnapped
                        ? 'bg-emerald-300 text-slate-950 scale-110 shadow-[0_0_10px_#34d399]'
                        : 'bg-emerald-500/90 hover:bg-emerald-400 text-slate-950 shadow'
                    }`}
                  >
                    <Pin className="w-2.5 h-2.5 fill-current" />
                  </button>
                );
              })}

              {/* Click/Drag anywhere on ruler to seek */}
              <div
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seekToPointerX(e.clientX, e.currentTarget);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    seekToPointerX(e.clientX, e.currentTarget);
                  }
                }}
                className="absolute inset-0 w-full h-full cursor-pointer z-40"
              />
            </div>

            {/* Row 1: Audio Waveform Track */}
            <div className="relative h-10 bg-slate-950/90 border-b border-slate-800/80 flex items-center overflow-hidden">
              <WaveformCanvas
                peaks={audioWaveform}
                zoom={timelineZoom}
                duration={duration}
                audioDuration={audioDuration}
              />

              <div
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  seekToPointerX(e.clientX, e.currentTarget);
                }}
                onPointerMove={(e) => {
                  if (e.buttons === 1) {
                    seekToPointerX(e.clientX, e.currentTarget);
                  }
                }}
                className="w-full h-full cursor-pointer z-30"
              />
            </div>

            {/* Row 2: Formation Hold Cues Track (Draggable + Edge-Resizable) */}
            <div className="relative h-11 bg-slate-950/90 border-b border-slate-800/80 flex items-center">
              {formationCues.map((cue) => {
                const holdDur = Math.max(0.01, cue.duration ?? 3.0);
                const leftPct = Math.min(99.8, (cue.time / duration) * 100);
                const widthPct = Math.max(0.005, Math.min(100 - leftPct, (holdDur / duration) * 100));
                const form = formations.find((f) => f.id === cue.formationId);
                const isSel = selectedFormationCueId === cue.id;
                const isOverlapping = overlappedFormationIds.has(cue.id);

                return (
                  <div
                    key={cue.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      pushHistorySnapshot();
                      selectFormationCue(cue.id);
                      setCurrentTime(cue.time);
                      setDragState({
                        track: 'formation',
                        cueId: cue.id,
                        mode: 'move',
                        startClientX: e.clientX,
                        initialTime: cue.time,
                        initialDuration: holdDur,
                      });
                    }}
                    className={`group absolute top-1 bottom-1 rounded-md text-[11px] font-bold flex items-center justify-between border transition cursor-grab active:cursor-grabbing overflow-hidden ${
                      isOverlapping
                        ? 'bg-rose-900/90 text-white border-rose-400 ring-2 ring-rose-500/70 shadow-lg z-20'
                        : isSel
                        ? 'bg-sky-600/90 text-white border-white shadow-lg z-20'
                        : 'bg-sky-950/90 text-sky-200 border-sky-500/60 hover:bg-sky-900 z-10'
                    }`}
                    title={
                      isOverlapping
                        ? '他の配置バーと時間帯が重なっています！開始時間または終了時間を調整してください'
                        : `配置: ${form?.name || ''} (${formatTime(cue.time)}〜${formatTime(cue.time + holdDur)})`
                    }
                  >
                    {/* Left Edge Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        pushHistorySnapshot();
                        selectFormationCue(cue.id);
                        setDragState({
                          track: 'formation',
                          cueId: cue.id,
                          mode: 'resize-left',
                          startClientX: e.clientX,
                          initialTime: cue.time,
                          initialDuration: holdDur,
                        });
                      }}
                      className="w-1.5 hover:w-2.5 h-full bg-white/20 hover:bg-white/50 cursor-ew-resize flex items-center justify-center shrink-0 transition-all z-10"
                      title="左端をドラッグして開始時間を変更"
                    >
                      <div className="w-0.5 h-3 bg-white/80 rounded" />
                    </div>

                    {/* Cue Label */}
                    <div className="px-1 truncate flex items-center gap-1 pointer-events-none min-w-0 flex-1">
                      {isOverlapping && (
                        <span className="px-1 py-0.2 rounded bg-rose-500 text-white text-[9px] font-extrabold shrink-0">
                          重複
                        </span>
                      )}
                      <span className="truncate">
                        {form
                          ? form.name.replace(/^Formation \d+:\s*/, '')
                          : 'Formation'}
                      </span>
                      <span className="text-[10px] opacity-85 font-mono shrink-0">
                        ({formatTime(cue.time)}〜{formatTime(cue.time + holdDur)})
                      </span>
                    </div>

                    {/* Right Edge Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        pushHistorySnapshot();
                        selectFormationCue(cue.id);
                        setDragState({
                          track: 'formation',
                          cueId: cue.id,
                          mode: 'resize-right',
                          startClientX: e.clientX,
                          initialTime: cue.time,
                          initialDuration: holdDur,
                        });
                      }}
                      className="w-1.5 hover:w-2.5 h-full bg-white/20 hover:bg-white/50 cursor-ew-resize flex items-center justify-center shrink-0 transition-all z-10"
                      title="右端をドラッグして終了時間を変更"
                    >
                      <div className="w-0.5 h-3 bg-white/80 rounded" />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 3: Lighting Hold Cues Track (Draggable + Edge-Resizable) */}
            <div className="relative h-11 bg-slate-950/90 flex items-center">
              {lightingCues.map((cue) => {
                const holdDur = Math.max(0.01, cue.duration ?? 3.0);
                const leftPct = Math.min(99.8, (cue.time / duration) * 100);
                const widthPct = Math.max(0.005, Math.min(100 - leftPct, (holdDur / duration) * 100));
                const preset = lightingPresets.find((p) => p.id === cue.presetId);
                const isSel = selectedLightingCueId === cue.id;
                const isOverlapping = overlappedLightingIds.has(cue.id);

                return (
                  <div
                    key={cue.id}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%`, minWidth: '8px' }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      pushHistorySnapshot();
                      selectLightingCue(cue.id);
                      setCurrentTime(cue.time);
                      setDragState({
                        track: 'lighting',
                        cueId: cue.id,
                        mode: 'move',
                        startClientX: e.clientX,
                        initialTime: cue.time,
                        initialDuration: holdDur,
                      });
                    }}
                    className={`group absolute top-1 bottom-1 rounded-md text-[11px] font-bold flex items-center justify-between border transition cursor-grab active:cursor-grabbing overflow-hidden ${
                      isOverlapping
                        ? 'bg-rose-900/90 text-white border-rose-400 ring-2 ring-rose-500/70 shadow-lg z-20'
                        : isSel
                        ? 'bg-amber-500/95 text-slate-950 border-white shadow-lg z-20'
                        : 'bg-amber-950/90 text-amber-200 border-amber-500/60 hover:bg-amber-900 z-10'
                    }`}
                    title={
                      isOverlapping
                        ? '他の照明バーと時間帯が重なっています！開始時間または終了時間を調整してください'
                        : `照明: ${preset?.name || ''} (${formatTime(cue.time)}〜${formatTime(cue.time + holdDur)})`
                    }
                  >
                    {/* Left Edge Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        pushHistorySnapshot();
                        selectLightingCue(cue.id);
                        setDragState({
                          track: 'lighting',
                          cueId: cue.id,
                          mode: 'resize-left',
                          startClientX: e.clientX,
                          initialTime: cue.time,
                          initialDuration: holdDur,
                        });
                      }}
                      className="w-1.5 hover:w-2.5 h-full bg-black/20 hover:bg-white/40 cursor-ew-resize flex items-center justify-center shrink-0 transition-all z-10"
                      title="左端をドラッグして開始時間を変更"
                    >
                      <div className="w-0.5 h-3 bg-current opacity-70 rounded" />
                    </div>

                    {/* Cue Label */}
                    <div className="px-1 truncate flex items-center gap-1 pointer-events-none min-w-0 flex-1">
                      {isOverlapping && (
                        <span className="px-1 py-0.2 rounded bg-rose-500 text-white text-[9px] font-extrabold shrink-0">
                          重複
                        </span>
                      )}
                      <span className="truncate">
                        {preset
                          ? preset.name.replace(/^Preset \d+:\s*/, '')
                          : 'Preset'}
                      </span>
                      <span className="text-[10px] opacity-85 font-mono shrink-0">
                        ({formatTime(cue.time)}〜{formatTime(cue.time + holdDur)})
                      </span>
                    </div>

                    {/* Right Edge Resize Handle */}
                    <div
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        pushHistorySnapshot();
                        selectLightingCue(cue.id);
                        setDragState({
                          track: 'lighting',
                          cueId: cue.id,
                          mode: 'resize-right',
                          startClientX: e.clientX,
                          initialTime: cue.time,
                          initialDuration: holdDur,
                        });
                      }}
                      className="w-1.5 hover:w-2.5 h-full bg-black/20 hover:bg-white/40 cursor-ew-resize flex items-center justify-center shrink-0 transition-all z-10"
                      title="右端をドラッグして終了時間を変更"
                    >
                      <div className="w-0.5 h-3 bg-current opacity-70 rounded" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
