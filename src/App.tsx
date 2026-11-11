import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { HeaderBar } from './components/HeaderBar';
import { Stage2DCanvas } from './components/Stage2DCanvas';
import { Stage3DView } from './components/Stage3DView';
import { StepSidebar } from './components/StepSidebar';
import { BottomDeck } from './components/BottomDeck';
import { CueSheetView } from './components/CueSheetView';
import { ProjectListHome } from './components/ProjectListHome';
import { ProjectSettingsPage } from './components/ProjectSettingsPage';
import {
  GRID_UNIT_M,
  useFormationStore,
  syncProjectsFromPersistentStorage,
} from './store/useFormationStore';
import { computeStageState } from './utils/interpolation';

export const App: React.FC = () => {
  const {
    activeProjectId,
    currentStep,
    viewportMode,
    showPdfModal,
    ambientIntensity,
    ambientColor,
    performers,
    formations,
    activeFormationId,
    lightFixtures,
    lightingPresets,
    activePresetId,
    formationCues,
    lightingCues,
    currentTime,
    isPlaying,
    saveToast,
    setSaveToast,
  } = useFormationStore();

  // Initial sync with Electron persistent disk storage
  useEffect(() => {
    syncProjectsFromPersistentStorage();
  }, []);

  // Auto clear save toast
  useEffect(() => {
    if (!saveToast) return;
    const timer = setTimeout(() => {
      setSaveToast(null);
    }, 3200);
    return () => clearTimeout(timer);
  }, [saveToast, setSaveToast]);

  // Continuous clock for rainbow color cycling even when timeline is paused
  const [rainbowClock, setRainbowClock] = useState(0);

  // Resizable side / bottom panels (persisted)
  const [sidebarW, setSidebarW] = useState<number>(() => {
    const v = Number(localStorage.getItem('fls_sidebarW'));
    return v >= 160 ? v : 336;
  });
  const [deckH, setDeckH] = useState<number | null>(() => {
    const v = Number(localStorage.getItem('fls_deckH'));
    return v >= 90 ? v : null;
  });

  const startSidebarResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = sidebarW;
    const onMove = (ev: PointerEvent) => {
      const w = Math.max(
        160,
        Math.min(window.innerWidth * 0.7, startW + (startX - ev.clientX))
      );
      setSidebarW(w);
      localStorage.setItem('fls_sidebarW', String(Math.round(w)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startDeckResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH =
      deckH ??
      (e.currentTarget.nextElementSibling as HTMLElement | null)?.offsetHeight ??
      200;
    const onMove = (ev: PointerEvent) => {
      const h = Math.max(
        90,
        Math.min(window.innerHeight * 0.75, startH + (startY - ev.clientY))
      );
      setDeckH(h);
      localStorage.setItem('fls_deckH', String(Math.round(h)));
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  useEffect(() => {
    if (!activeProjectId) return;
    let frameId: number;
    const start = performance.now();
    const updateClock = (now: number) => {
      setRainbowClock((now - start) / 1000);
      frameId = requestAnimationFrame(updateClock);
    };
    frameId = requestAnimationFrame(updateClock);
    return () => cancelAnimationFrame(frameId);
  }, [activeProjectId]);

  // Global Keyboard Shortcuts Handler
  useEffect(() => {
    if (!activeProjectId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S: Save Project Overwrite (intercept even when typing in input)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        const st = useFormationStore.getState();
        st.saveProjectFile(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const inputType =
        tagName === 'input'
          ? ((target as HTMLInputElement).type || '').toLowerCase()
          : '';
      const isEditingText =
        tagName === 'textarea' ||
        tagName === 'select' ||
        Boolean(target?.isContentEditable) ||
        (tagName === 'input' &&
          !['range', 'color', 'checkbox', 'radio', 'button'].includes(inputType));

      if (isEditingText) return;

      const st = useFormationStore.getState();

      // Ctrl+C / Cmd+C: Copy selected performers (Formations) or selected lighting (Lighting)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (st.currentStep === 'formations') {
          e.preventDefault();
          st.copySelectedPerformers();
          return;
        } else if (st.currentStep === 'lighting') {
          e.preventDefault();
          st.copySelectedLighting();
          return;
        }
      }

      // Ctrl+V / Cmd+V: Paste copied performers (Formations) or copied lighting (Lighting)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (st.currentStep === 'formations') {
          e.preventDefault();
          st.pasteCopiedPerformers();
          return;
        } else if (st.currentStep === 'lighting') {
          e.preventDefault();
          st.pasteCopiedLighting();
          return;
        }
      }

      // Ctrl+Z / Cmd+Z: Undo, Ctrl+Shift+Z / Ctrl+Y: Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          st.redo();
        } else {
          st.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }

      // Ctrl+D / Cmd+D: Duplicate current formation or preset
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (st.currentStep === 'formations') {
          st.duplicateFormation(st.activeFormationId);
        } else if (st.currentStep === 'lighting') {
          st.duplicateLightingPreset(st.activePresetId);
        }
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      switch (e.key) {
        case ' ': {
          e.preventDefault();
          if (st.currentStep !== 'timeline') {
            st.setCurrentStep('timeline');
          }
          st.setIsPlaying(!st.isPlaying);
          break;
        }
        case '0':
        case 'Home': {
          e.preventDefault();
          st.setIsPlaying(false);
          st.setCurrentTime(0);
          break;
        }
        case '1': {
          e.preventDefault();
          st.setCurrentStep('formations');
          break;
        }
        case '2': {
          e.preventDefault();
          st.setCurrentStep('lighting');
          break;
        }
        case '3': {
          e.preventDefault();
          st.setCurrentStep('timeline');
          break;
        }
        case '4': {
          e.preventDefault();
          st.setCurrentStep('settings');
          break;
        }
        case 'v':
        case 'V': {
          e.preventDefault();
          const modes: ('split' | '2d' | '3d')[] = ['split', '2d', '3d'];
          const nextIdx = (modes.indexOf(st.viewportMode) + 1) % modes.length;
          st.setViewportMode(modes[nextIdx]);
          break;
        }
        case 'g':
        case 'G': {
          e.preventDefault();
          st.setSnapToGrid(!st.snapToGrid);
          break;
        }
        case 'p':
        case 'P': {
          e.preventDefault();
          st.addTimelinePin(st.currentTime);
          break;
        }
        case 'n':
        case 'N': {
          e.preventDefault();
          if (st.currentStep === 'formations') {
            st.addFormation();
          } else if (st.currentStep === 'lighting') {
            st.addLightingPreset();
          } else if (st.currentStep === 'timeline') {
            st.addFormationCue(st.currentTime, st.activeFormationId, 3.0);
          }
          break;
        }
        case '[': {
          e.preventDefault();
          if (st.currentStep === 'lighting') {
            const idx = st.lightingPresets.findIndex((p) => p.id === st.activePresetId);
            if (idx > 0) st.selectPreset(st.lightingPresets[idx - 1].id);
          } else {
            const idx = st.formations.findIndex((f) => f.id === st.activeFormationId);
            if (idx > 0) st.selectFormation(st.formations[idx - 1].id);
          }
          break;
        }
        case ']': {
          e.preventDefault();
          if (st.currentStep === 'lighting') {
            const idx = st.lightingPresets.findIndex((p) => p.id === st.activePresetId);
            if (idx !== -1 && idx < st.lightingPresets.length - 1) {
              st.selectPreset(st.lightingPresets[idx + 1].id);
            }
          } else {
            const idx = st.formations.findIndex((f) => f.id === st.activeFormationId);
            if (idx !== -1 && idx < st.formations.length - 1) {
              st.selectFormation(st.formations[idx + 1].id);
            }
          }
          break;
        }
        case 'Tab': {
          if (st.currentStep === 'formations' && st.performers.length > 0) {
            e.preventDefault();
            const curIdx = st.performers.findIndex(
              (p) => p.id === st.selectedPerformerId
            );
            const nextIdx = e.shiftKey
              ? (curIdx - 1 + st.performers.length) % st.performers.length
              : (curIdx + 1) % st.performers.length;
            st.selectPerformer(st.performers[nextIdx].id);
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          if (st.currentStep === 'formations') {
            const step = e.shiftKey ? GRID_UNIT_M : GRID_UNIT_M / 2;
            st.nudgeSelectedPerformer(-step, 0);
          } else if (st.currentStep === 'timeline') {
            const step = e.shiftKey ? 5 : 1;
            st.setCurrentTime(Math.max(0, st.currentTime - step));
          }
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          if (st.currentStep === 'formations') {
            const step = e.shiftKey ? GRID_UNIT_M : GRID_UNIT_M / 2;
            st.nudgeSelectedPerformer(step, 0);
          } else if (st.currentStep === 'timeline') {
            const step = e.shiftKey ? 5 : 1;
            st.setCurrentTime(Math.min(st.duration, st.currentTime + step));
          }
          break;
        }
        case 'ArrowUp': {
          if (st.currentStep === 'formations') {
            e.preventDefault();
            const step = e.shiftKey ? GRID_UNIT_M : GRID_UNIT_M / 2;
            st.nudgeSelectedPerformer(0, -step);
          }
          break;
        }
        case 'ArrowDown': {
          if (st.currentStep === 'formations') {
            e.preventDefault();
            const step = e.shiftKey ? GRID_UNIT_M : GRID_UNIT_M / 2;
            st.nudgeSelectedPerformer(0, step);
          }
          break;
        }
        case '+':
        case '=': {
          if (st.currentStep === 'timeline') {
            e.preventDefault();
            st.setTimelineZoom(st.timelineZoom + 0.5);
          }
          break;
        }
        case '-': {
          if (st.currentStep === 'timeline') {
            e.preventDefault();
            st.setTimelineZoom(st.timelineZoom - 0.5);
          }
          break;
        }
        case 'Delete':
        case 'Backspace': {
          if (st.currentStep === 'timeline') {
            e.preventDefault();
            if (st.selectedFormationCueId) {
              st.deleteFormationCue(st.selectedFormationCueId);
            } else if (st.selectedLightingCueId) {
              st.deleteLightingCue(st.selectedLightingCueId);
            }
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeProjectId]);

  const stageState = useMemo(
    () =>
      computeStageState({
        step: currentStep,
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
        isPlaying,
      }),
    [
      currentStep,
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
      isPlaying,
    ]
  );

  // Show Project List Home Screen when no project is currently open
  if (!activeProjectId) {
    return <ProjectListHome />;
  }

  return (
    <div className="w-screen h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden app-root-container print:w-auto print:h-auto print:overflow-visible print:bg-white print:text-slate-900">
      <HeaderBar />

      {showPdfModal && <CueSheetView />}

      {currentStep === 'settings' ? (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden print:hidden">
          <ProjectSettingsPage />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 flex overflow-hidden print:hidden">
            {/* Main Stage Viewport Area */}
            <main className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
              {viewportMode === 'split' && (
                <div className="w-full h-full min-h-0 grid grid-rows-2 divide-y divide-slate-800">
                  <div className="min-h-0 overflow-hidden">
                    <Stage2DCanvas stageState={stageState} />
                  </div>
                  <div className="min-h-0 overflow-hidden">
                    <Stage3DView stageState={stageState} />
                  </div>
                </div>
              )}
              {viewportMode === '2d' && <Stage2DCanvas stageState={stageState} />}
              {viewportMode === '3d' && <Stage3DView stageState={stageState} />}
            </main>

            {/* Sidebar resize handle */}
            <div
              onPointerDown={startSidebarResize}
              className="w-1.5 shrink-0 cursor-col-resize bg-slate-800 hover:bg-sky-500 active:bg-sky-500 transition-colors"
              title="ドラッグで幅を調整"
            />
            {/* Right Contextual Sidebar */}
            <div
              style={{ width: sidebarW }}
              className="shrink-0 h-full min-h-0 overflow-hidden"
            >
              <StepSidebar />
            </div>
          </div>

          {/* Bottom deck resize handle */}
          <div
            onPointerDown={startDeckResize}
            className="h-1.5 shrink-0 cursor-row-resize bg-slate-800 hover:bg-sky-500 active:bg-sky-500 transition-colors print:hidden"
            title="ドラッグで高さを調整"
          />
          {/* Bottom Contextual Deck */}
          <div
            style={{
              height:
                deckH ??
                (currentStep === 'timeline'
                  ? 224
                  : currentStep === 'formations'
                  ? 160
                  : 144),
            }}
            className="shrink-0 min-h-0 overflow-hidden print:hidden"
          >
            <BottomDeck />
          </div>
        </>
      )}

      {/* Global Save Toast Notification */}
      {saveToast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top duration-200 pointer-events-none">
          <div
            className={`px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2.5 text-xs font-bold backdrop-blur-md ${
              saveToast.type === 'error'
                ? 'bg-rose-950/90 text-rose-200 border-rose-600/60 shadow-rose-950/50'
                : 'bg-emerald-950/90 text-emerald-100 border-emerald-500/60 shadow-emerald-950/50'
            }`}
          >
            {saveToast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{saveToast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
