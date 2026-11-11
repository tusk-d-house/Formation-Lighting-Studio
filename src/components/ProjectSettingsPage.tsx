import React, { useState } from 'react';
import {
  Settings,
  Users,
  FileDown,
  FileSpreadsheet,
  Video,
  Download,
  Plus,
  Minus,
  Trash2,
  Building2,
  Sparkles,
  CheckCircle2,
  Eye,
  EyeOff,
  Keyboard,
  RotateCw,
  ArrowUpDown,
  Save,
  FilePlus2,
  FolderOpen,
} from 'lucide-react';
import { useFormationStore, GRID_UNIT_M } from '../store/useFormationStore';
import { formatTimestamp, computeStageState } from '../utils/interpolation';
import { draw2DStageCanvas } from '../utils/draw2DStageCanvas';
import { downloadAttendanceXlsx } from '../utils/exportAttendanceSheet';
import { ThemeSwitcher } from './ThemeSwitcher';

export const ProjectSettingsPage: React.FC = () => {
  const {
    projectName,
    stageGridCols,
    stageGridRows,
    wingGridCols,
    stageWidth,
    stageDepth,
    wingWidth,
    stageTheme,
    stageInverted,
    showDancerNames,
    dancerScale,
    ambientIntensity,
    ambientColor,
    performers,
    formations,
    duration,
    isRecordingVideo,
    setProjectName,
    setStageGridDimensions,
    setStageTheme,
    flipStageOrientation,
    setShowDancerNames,
    setDancerScale,
    setProjectAmbient,
    setPerformerCount,
    addPerformer,
    updatePerformer,
    removePerformer,
    setShowPdfModal,
    setCurrentStep,
    setViewportMode,
    setIsRecordingVideo,
    setCurrentTime,
    setIsPlaying,
    exportProjectJson,
    saveProjectFile,
    associatedFilePath,
  } = useFormationStore();

  const [videoRenderMode, setVideoRenderMode] = useState<'3d' | '2d'>('3d');
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveOverwrite = async () => {
    setIsSaving(true);
    await saveProjectFile(false);
    setIsSaving(false);
  };

  const handleSaveAs = async () => {
    setIsSaving(true);
    await saveProjectFile(true);
    setIsSaving(false);
  };

  const handleCompileMp4Video = () => {
    if (isRecordingVideo) return;

    // Initialize & unlock AudioContext directly on user click so audio is never blocked by autoplay rules
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx: AudioContext | null = AudioCtx ? new AudioCtx() : null;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const mode = videoRenderMode;
    setIsRecordingVideo(true);
    setCurrentStep('timeline');
    setViewportMode(mode);

    setTimeout(() => {
      if (mode === '3d') {
        const webglCanvas = document.getElementById(
          'stage-3d-webgl-canvas'
        ) as HTMLCanvasElement | null;
        if (!webglCanvas) {
          if (audioCtx) audioCtx.close().catch(() => {});
          setIsRecordingVideo(false);
          return;
        }
      }

      // Set up Web Audio routing -> both speakers (audioCtx.destination) AND video recorder (audioDest)
      const initialSt = useFormationStore.getState();
      const audioDest = audioCtx ? audioCtx.createMediaStreamDestination() : null;
      let keepAliveOsc: OscillatorNode | null = null;
      let recAudio: HTMLAudioElement | null = null;
      let lastBeatIdx = -1;

      if (audioCtx && audioDest) {
        try {
          keepAliveOsc = audioCtx.createOscillator();
          const silentGain = audioCtx.createGain();
          silentGain.gain.value = 0.0001;
          keepAliveOsc.connect(silentGain);
          silentGain.connect(audioDest);
          keepAliveOsc.start();
        } catch {
          // ignore
        }

        if (initialSt.audioUrl) {
          try {
            recAudio = new Audio(initialSt.audioUrl);
            recAudio.crossOrigin = 'anonymous';
            recAudio.currentTime = 0;
            const mediaSource = audioCtx.createMediaElementSource(recAudio);
            // Send inserted music to both the recorded video file AND user's speakers
            mediaSource.connect(audioDest);
            mediaSource.connect(audioCtx.destination);
          } catch (e) {
            console.warn('Audio source attach warning:', e);
          }
        }
      }

      const triggerSynthBeatToStream = (beatNumber: number) => {
        if (!audioCtx || !audioDest) return;
        try {
          const osc = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          const isDownbeat = beatNumber % 4 === 0;
          osc.type = isDownbeat ? 'triangle' : 'sine';
          osc.frequency.setValueAtTime(
            isDownbeat ? 880 : 440,
            audioCtx.currentTime
          );
          gain.gain.setValueAtTime(
            isDownbeat ? 0.12 : 0.05,
            audioCtx.currentTime
          );
          gain.gain.exponentialRampToValueAtTime(
            0.001,
            audioCtx.currentTime + 0.09
          );
          osc.connect(gain);
          gain.connect(audioDest);
          gain.connect(audioCtx.destination);
          osc.start();
          osc.stop(audioCtx.currentTime + 0.09);
        } catch {
          // ignore
        }
      };

      // Use an offscreen 2D canvas with fixed even HD dimensions (1280x720)
      // so H.264/VP9 encoders never fail due to odd WebGL canvas dimensions,
      // and actively push frames at 30fps via requestAnimationFrame.
      const recCanvas = document.createElement('canvas');
      recCanvas.width = 1280;
      recCanvas.height = 720;
      const ctx = recCanvas.getContext('2d');
      if (!ctx) {
        if (audioCtx) audioCtx.close().catch(() => {});
        setIsRecordingVideo(false);
        return;
      }

      let activeRecording = true;
      let animFrameId = 0;

      const renderCompositeFrame = () => {
        if (!activeRecording) return;
        const st = useFormationStore.getState();

        // Sync timeline clock to inserted audio playback and trigger demo beat if no audio file
        if (recAudio && !recAudio.paused && !recAudio.ended) {
          st.setCurrentTime(recAudio.currentTime);
        } else if (!st.audioUrl && st.useDemoBeat && st.isPlaying) {
          const beatIdx = Math.floor(st.currentTime * 2);
          if (beatIdx !== lastBeatIdx) {
            lastBeatIdx = beatIdx;
            triggerSynthBeatToStream(beatIdx);
          }
        }

        if (mode === '2d') {
          // Compute real-time interpolated stage state and draw crisp 2D stage
          const currentStageState = computeStageState({
            step: st.currentStep,
            performers: st.performers,
            formations: st.formations,
            activeFormationId: st.activeFormationId,
            lightFixtures: st.lightFixtures,
            lightingPresets: st.lightingPresets,
            activePresetId: st.activePresetId,
            formationCues: st.formationCues,
            lightingCues: st.lightingCues,
            ambientIntensity: st.ambientIntensity,
            ambientColor: st.ambientColor,
            currentTime: st.currentTime,
            rainbowClock: performance.now() * 0.0015,
          });
          draw2DStageCanvas(ctx, recCanvas.width, recCanvas.height, currentStageState, st);
        } else {
          // 3D WebGL mode
          const srcCanvas = document.getElementById(
            'stage-3d-webgl-canvas'
          ) as HTMLCanvasElement | null;
          ctx.fillStyle = '#020617';
          ctx.fillRect(0, 0, recCanvas.width, recCanvas.height);

          if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
            const scale = Math.min(
              recCanvas.width / srcCanvas.width,
              recCanvas.height / srcCanvas.height
            );
            const drawW = Math.round(srcCanvas.width * scale);
            const drawH = Math.round(srcCanvas.height * scale);
            const dx = Math.round((recCanvas.width - drawW) / 2);
            const dy = Math.round((recCanvas.height - drawH) / 2);
            ctx.drawImage(srcCanvas, dx, dy, drawW, drawH);
          }

          // Draw subtle timecode & project title watermark so the 2D buffer is guaranteed dirty every frame
          ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
          ctx.fillRect(16, 16, 320, 36);
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 15px sans-serif';
          ctx.fillText(
            `${st.projectName}   ${formatTimestamp(st.currentTime)}`,
            28,
            39
          );
        }

        animFrameId = requestAnimationFrame(renderCompositeFrame);
      };

      renderCompositeFrame();

      const videoStream = recCanvas.captureStream(30);
      const hasAudioTrack = Boolean(
        audioDest && audioDest.stream.getAudioTracks().length > 0
      );
      const stream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...(audioDest ? audioDest.stream.getAudioTracks() : []),
      ]);

      const pickSupportedMime = (preferSoftwareWebm = false): string => {
        const candidates = preferSoftwareWebm
          ? hasAudioTrack
            ? [
                'video/webm;codecs=vp9,opus',
                'video/webm;codecs=vp8,opus',
                'video/webm',
              ]
            : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
          : hasAudioTrack
          ? [
              'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
              'video/mp4',
              'video/webm;codecs=vp9,opus',
              'video/webm;codecs=vp8,opus',
              'video/webm',
            ]
          : [
              'video/mp4;codecs=avc1.42E01E',
              'video/mp4;codecs=avc1',
              'video/webm;codecs=h264',
              'video/webm;codecs=vp9',
              'video/webm;codecs=vp8',
              'video/webm',
            ];
        return (
          candidates.find((t) => MediaRecorder.isTypeSupported(t)) ||
          'video/webm'
        );
      };

      const cleanupAudioAndTracks = () => {
        if (recAudio) {
          try {
            recAudio.pause();
            recAudio.src = '';
          } catch {
            // ignore
          }
        }
        if (keepAliveOsc) {
          try {
            keepAliveOsc.stop();
          } catch {
            // ignore
          }
        }
        if (audioCtx) {
          audioCtx.close().catch(() => {});
        }
        stream.getTracks().forEach((t) => t.stop());
      };

      const startRecorderSession = (preferSoftwareWebm: boolean) => {
        const mimeType = pickSupportedMime(preferSoftwareWebm);
        const isMp4 = mimeType.includes('mp4');
        const ext = isMp4 ? 'mp4' : 'webm';

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(stream, {
            mimeType,
            videoBitsPerSecond: 5_000_000,
            audioBitsPerSecond: 192_000,
          });
        } catch {
          recorder = new MediaRecorder(stream);
        }

        const chunks: Blob[] = [];
        let totalBytes = 0;
        let switchedToFallback = false;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
            totalBytes += e.data.size;
          }
        };

        recorder.onstop = () => {
          if (switchedToFallback) return;
          activeRecording = false;
          cancelAnimationFrame(animFrameId);
          cleanupAudioAndTracks();
          setIsRecordingVideo(false);

          if (chunks.length === 0 || totalBytes === 0) return;

          const blob = new Blob(chunks, {
            type: isMp4 ? 'video/mp4' : 'video/webm',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const suffix = mode === '2d' ? '2D_formation' : '3D_preview';
          a.download = `${projectName.replace(/\s+/g, '_')}_${suffix}.${ext}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        };

        setIsRecordingVideo(true);
        setCurrentTime(0);
        lastBeatIdx = -1;
        if (recAudio) {
          recAudio.currentTime = 0;
          recAudio.play().catch(() => {});
        }
        setIsPlaying(true);
        recorder.start(200);

        // Watchdog: if hardware H.264/MP4 encoder in Chromium produces 0 bytes after 650ms,
        // automatically switch to software VP9+Opus/WebM encoder so the file is NEVER 0 KB!
        if (!preferSoftwareWebm) {
          setTimeout(() => {
            if (!activeRecording || recorder.state === 'inactive') return;
            try {
              recorder.requestData();
            } catch {
              // ignore
            }
            setTimeout(() => {
              if (activeRecording && totalBytes === 0) {
                switchedToFallback = true;
                try {
                  recorder.stop();
                } catch {
                  // ignore
                }
                startRecorderSession(true);
              }
            }, 150);
          }, 650);
        }

        const checkInterval = setInterval(() => {
          if (switchedToFallback) {
            clearInterval(checkInterval);
            return;
          }
          const st = useFormationStore.getState();
          if (!st.isPlaying || st.currentTime >= st.duration - 0.15) {
            clearInterval(checkInterval);
            if (recorder.state === 'recording') {
              try {
                recorder.requestData();
              } catch {
                // ignore
              }
              setTimeout(() => {
                if (recorder.state !== 'inactive') {
                  recorder.stop();
                }
              }, 150);
            }
          }
        }, 200);
      };

      try {
        startRecorderSession(false);
      } catch (err) {
        console.error(err);
        activeRecording = false;
        cancelAnimationFrame(animFrameId);
        cleanupAudioAndTracks();
        setIsRecordingVideo(false);
      }
    }, 400);
  };

  return (
    <div className="flex-1 bg-slate-950 overflow-y-auto p-6 select-none">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Page Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h1 className="text-base font-extrabold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-sky-400" />
            プロジェクト設定・保存・出力
          </h1>
          <button
            onClick={() => setCurrentStep('formations')}
            className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold shadow transition"
          >
            編集画面へ戻る →
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* COLUMN 1: STAGE & DISPLAY SETTINGS */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="text-sm font-bold text-sky-400 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Building2 className="w-4 h-4" />
              1. ステージ・表示設定
            </div>

            {/* Project Name */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">
                プロジェクト名
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-3 py-1.5 text-xs font-bold text-white focus:outline-none"
              />
            </div>

            {/* Stage Appearance Theme */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                ステージ外観
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setStageTheme('hall')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                    stageTheme === 'hall'
                      ? 'bg-amber-500/15 border-amber-400 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">ホール仕様</span>
                  {stageTheme === 'hall' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                  )}
                </button>

                <button
                  onClick={() => setStageTheme('clubhouse')}
                  className={`p-2.5 rounded-xl border text-left transition flex items-center justify-between ${
                    stageTheme === 'clubhouse'
                      ? 'bg-cyan-500/15 border-cyan-400 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="text-xs font-bold">クラブハウス</span>
                  {stageTheme === 'clubhouse' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </button>
              </div>
            </div>

            {/* App Theme Color */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                テーマカラー
              </label>
              <ThemeSwitcher />
            </div>

            {/* Dancer Name Display Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs font-semibold text-slate-300">
                ダンサーの名前の表示
              </span>
              <button
                onClick={() => setShowDancerNames(!showDancerNames)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition ${
                  showDancerNames
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                    : 'bg-slate-950 border-slate-700 text-slate-400'
                }`}
              >
                {showDancerNames ? (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    表示 ON
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    非表示 OFF
                  </>
                )}
              </button>
            </div>

            {/* Dancer Size (Scale) Slider */}
            <div className="space-y-1 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  ダンサーの表示サイズ:
                </span>
                <span className="font-bold text-sky-400">
                  {Math.round((dancerScale || 0.72) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.35}
                max={1.3}
                step={0.05}
                value={dancerScale || 0.72}
                onChange={(e) => setDancerScale(parseFloat(e.target.value))}
                className="w-full accent-sky-500"
              />
            </div>

            {/* Stage Orientation Flip (ステージの向き反転) */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                  ステージの向き反転
                </label>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    stageInverted
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {stageInverted ? '反転中 (客席奥側 / FRONT奥)' : '通常 (客席手前 / FRONT手前)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                客席側(FRONT)と奥側(BACK)の向きを反転します。ダンサー視点での確認や練習時の向き切り替えに使えます。
              </p>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => flipStageOrientation(false)}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex flex-col items-center justify-center gap-1 transition shadow group text-center"
                  title="ダンサーの位置はそのまま固定し、ステージのFRONT/BACKの向きだけを反転します"
                >
                  <span className="text-sky-400 group-hover:text-sky-300 flex items-center gap-1">
                    <RotateCw className="w-3.5 h-3.5" />
                    ステージのみ反転
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    ダンサー位置は維持
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => flipStageOrientation(true)}
                  className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 hover:text-white flex flex-col items-center justify-center gap-1 transition shadow group text-center"
                  title="ステージの向き反転に合わせて、全フォーメーションのダンサーの配置も上下左右（180°）反転します"
                >
                  <span className="text-amber-400 group-hover:text-amber-300 flex items-center gap-1">
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    ダンサーごと反転
                  </span>
                  <span className="text-[10px] font-normal text-slate-400">
                    上下左右とも反転
                  </span>
                </button>
              </div>
            </div>

            {/* Stage Dimensions in 90cm Grids */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">
                  ステージサイズ
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-semibold">
                  1グリッド = 90cm ({GRID_UNIT_M}m)
                </span>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">横幅:</span>
                  <span className="font-bold text-sky-400">
                    {stageGridCols}グリッド ({stageWidth}m)
                  </span>
                </div>
                <input
                  type="range"
                  min={6}
                  max={28}
                  step={2}
                  value={stageGridCols}
                  onChange={(e) =>
                    setStageGridDimensions(
                      parseInt(e.target.value, 10),
                      stageGridRows
                    )
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">奥行:</span>
                  <span className="font-bold text-sky-400">
                    {stageGridRows}グリッド ({stageDepth}m)
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={20}
                  step={2}
                  value={stageGridRows}
                  onChange={(e) =>
                    setStageGridDimensions(
                      stageGridCols,
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="w-full accent-sky-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">左右袖 (待機幅):</span>
                  <span className="font-bold text-amber-400">
                    片側 {wingGridCols}グリッド ({wingWidth}m)
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  step={1}
                  value={wingGridCols}
                  onChange={(e) =>
                    setStageGridDimensions(
                      stageGridCols,
                      stageGridRows,
                      parseInt(e.target.value, 10)
                    )
                  }
                  className="w-full accent-amber-400"
                />
              </div>

              {/* Project-wide Ambient Light */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">
                    地明かり (ベース照明)
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-400">
                    {Math.round(ambientIntensity * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <input
                    type="range"
                    min={0}
                    max={1.2}
                    step={0.05}
                    value={ambientIntensity}
                    onChange={(e) =>
                      setProjectAmbient(parseFloat(e.target.value))
                    }
                    className="flex-1 accent-amber-400"
                  />
                  <input
                    type="color"
                    value={ambientColor}
                    onChange={(e) =>
                      setProjectAmbient(ambientIntensity, e.target.value)
                    }
                    className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* COLUMN 2: DANCERS CONFIGURATION (Up to 80 Dancers) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="text-sm font-bold text-sky-400 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  2. ダンサー編成 (最大80人)
                </div>
                <div className="flex items-center gap-1 bg-slate-950 border border-slate-700 rounded-lg p-1">
                  <button
                    onClick={() => setPerformerCount(performers.length - 1)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={performers.length}
                    onChange={(e) =>
                      setPerformerCount(parseInt(e.target.value, 10) || 1)
                    }
                    className="w-11 text-center bg-transparent font-bold text-xs text-sky-400 focus:outline-none"
                  />
                  <span className="text-[11px] text-slate-400 pr-1">人</span>
                  <button
                    onClick={() => setPerformerCount(performers.length + 1)}
                    className="p-1 rounded hover:bg-slate-800 text-slate-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="range"
                min={1}
                max={80}
                value={performers.length}
                onChange={(e) =>
                  setPerformerCount(parseInt(e.target.value, 10))
                }
                className="w-full accent-sky-500"
              />

              <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                {performers.map((p, idx) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-950/80 border border-slate-800/80"
                  >
                    <span className="w-6 text-xs font-bold text-slate-400 text-right">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      data-name-input={idx}
                      value={p.name}
                      onChange={(e) =>
                        updatePerformer(p.id, { name: e.target.value })
                      }
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                        e.preventDefault();
                        const next = document.querySelector<HTMLInputElement>(
                          `input[data-name-input="${idx + 1}"]`
                        );
                        if (next) {
                          next.focus();
                          next.select();
                        } else {
                          e.currentTarget.blur();
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-sky-500 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none"
                    />
                    {performers.length > 1 && (
                      <button
                        onClick={() => removePerformer(p.id)}
                        className="text-slate-500 hover:text-rose-400 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => addPerformer()}
              disabled={performers.length >= 80}
              className="w-full py-2 rounded-xl border border-dashed border-slate-700 hover:border-sky-500 disabled:opacity-40 text-xs font-bold text-sky-400 hover:bg-slate-950 flex items-center justify-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              ダンサーを追加
            </button>
          </div>

          {/* COLUMN 3: EXPORT & FILE SAVE HUB */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
              <Sparkles className="w-4 h-4" />
              3. 保存・出力
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileDown className="w-4 h-4 text-emerald-400" />
                フォーメーション一覧 PDF ({formations.length}パターン)
              </div>
              <button
                onClick={() => setShowPdfModal(true)}
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow transition"
              >
                <FileDown className="w-4 h-4" />
                PDFを作成・印刷
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                ダンサー出演表 Excel出力
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed space-y-1">
                <p>
                  どのダンサーがどのフォーメーションに出ているかをチェックボックス付きで集計したExcel（.xlsx）を出力します。
                </p>
                <p className="text-amber-300/90 font-semibold">
                  ※ フォーメーション画面でグレー以外の色にすると出演（TRUE）、グレーにすると不参加（FALSE）とみなされます。
                </p>
              </div>
              <button
                onClick={() =>
                  downloadAttendanceXlsx(projectName, performers, formations)
                }
                className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                出演表をExcel出力 (.xlsx)
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Video className="w-4 h-4 text-purple-400" />
                  動画出力 ({formatTimestamp(duration)})
                </div>
                {/* 2D / 3D Mode Selector */}
                <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setVideoRenderMode('3d')}
                    disabled={isRecordingVideo}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                      videoRenderMode === '3d'
                        ? 'bg-purple-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    3Dプレビュー
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoRenderMode('2d')}
                    disabled={isRecordingVideo}
                    className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                      videoRenderMode === '2d'
                        ? 'bg-sky-600 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    2D構成図
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {videoRenderMode === '3d'
                  ? '3Dステージ表示で再生しながら録画します。客席目線・俯瞰などのカメラアングルと照明効果を含めて保存できます。'
                  : '2Dフォーメーション構成図として再生しながら録画します。上空からのダンサー移動・番号・バミリが鮮明に記録されます。'}
                途中でも画面左上の「ここで録画完了して保存」または一時停止で即座に動画ファイルとして保存されます。
              </p>

              <button
                onClick={handleCompileMp4Video}
                disabled={isRecordingVideo}
                className={`w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow transition ${
                  isRecordingVideo
                    ? 'bg-rose-600 text-white animate-pulse'
                    : videoRenderMode === '3d'
                    ? 'bg-purple-600 hover:bg-purple-500 text-white'
                    : 'bg-sky-600 hover:bg-sky-500 text-white'
                }`}
              >
                <Video className="w-4 h-4" />
                {isRecordingVideo
                  ? '録画中...'
                  : videoRenderMode === '3d'
                  ? '3Dプレビュー動画を保存'
                  : '2D構成図動画を保存'}
              </button>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-sky-400" />
                  プロジェクトファイル (.json) の保存
                </div>
                {associatedFilePath && (
                  <span
                    className="text-[10px] text-slate-400 font-mono truncate max-w-[180px] bg-slate-900 px-2 py-0.5 rounded border border-slate-800"
                    title={associatedFilePath}
                  >
                    {associatedFilePath.split(/[/\\]/).pop()}
                  </span>
                )}
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                現在のフォーメーション・舞台照明・タイムラインの全設定を保存します。
                作業中はショートカットキー <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-sky-300">Ctrl + S</kbd>（Mac: <kbd className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-sky-300">Cmd + S</kbd>）でも瞬時に上書き保存できます。
              </p>

              {associatedFilePath && (
                <div className="text-[11px] text-slate-400 bg-slate-900/80 rounded-lg p-2.5 border border-slate-800 flex items-start gap-2">
                  <FolderOpen className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <span className="text-slate-300 font-semibold">現在の保存先ファイル:</span>
                    <div className="text-[10px] text-slate-400 font-mono break-all mt-0.5">
                      {associatedFilePath}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleSaveOverwrite}
                  disabled={isSaving}
                  className="py-2.5 px-3 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-2 shadow transition"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? '保存中...' : '上書き保存 (Ctrl+S)'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAs}
                  disabled={isSaving}
                  className="py-2.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <FilePlus2 className="w-4 h-4 text-emerald-400" />
                  <span>名前を付けて保存...</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Collapsible Keyboard Shortcuts Reference at the bottom of Settings */}
        <details className="bg-slate-900/50 border border-slate-800/70 rounded-xl px-4 py-2.5 text-xs text-slate-400">
          <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-200 flex items-center gap-1.5 select-none">
            <Keyboard className="w-3.5 h-3.5 text-slate-500" />
            <span>キーボード操作コマンド案内（クリックで表示）</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2 text-[11px]">
            <div className="flex justify-between items-center text-sky-300 font-semibold">
              <span>上書き保存</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-sky-600/60 rounded font-mono text-sky-200">
                Ctrl + S
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>元に戻す (Undo)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                Ctrl + Z
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>やり直す (Redo)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                Ctrl + Y
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>再生 / 一時停止</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                Space
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>先頭(00:00.0)へ戻す</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                0 / Home
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>画面タブ切替</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                1 / 2 / 3 / 4
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>2D/3D表示切替</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                V
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>ダンサー移動(45cm)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                ↑ ↓ ← →
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>ダンサー移動(90cm)</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                Shift + 矢印
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>前後の構成/照明切替</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                [ / ]
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>新規構成/照明追加</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                N
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>現在の構成/照明複製</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                Ctrl + D
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>スナップ ON/OFF</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                G
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>タイムライン拡縮</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-slate-300">
                + / -
              </kbd>
            </div>
            <div className="flex justify-between items-center">
              <span>選択中のキュー削除</span>
              <kbd className="px-1.5 py-0.5 bg-slate-950 border border-slate-700 rounded font-mono text-rose-300">
                Delete / Backspace
              </kbd>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
