import React, { useState, useEffect } from 'react';
import {
  LayoutGrid,
  Lightbulb,
  Music,
  Settings,
  Columns,
  Grid as GridIcon,
  Box,
  ArrowLeft,
  Undo2,
  Redo2,
  AlertTriangle,
  Save,
  Route,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useFormationStore, isProjectDirty } from '../store/useFormationStore';
import { WorkflowStep } from '../types';

export const HeaderBar: React.FC = () => {
  const {
    projectName,
    currentStep,
    viewportMode,
    stageGridCols,
    stageGridRows,
    stageWidth,
    stageDepth,
    showPaths,
    showDancerNames,
    pastHistory,
    futureHistory,
    undo,
    redo,
    saveProjectFile,
    closeProjectToHome,
    setCurrentStep,
    setViewportMode,
    setShowPaths,
    setShowDancerNames,
  } = useFormationStore();

  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const dirty = isProjectDirty(useFormationStore.getState());

  // Warn on browser/window close if dirty (only in web browser environment; Electron uses native window.on('close'))
  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      return;
    }
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isProjectDirty(useFormationStore.getState())) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleBackToHomeClick = () => {
    if (isProjectDirty(useFormationStore.getState())) {
      setShowUnsavedDialog(true);
    } else {
      closeProjectToHome();
    }
  };

  const canUndo = pastHistory.length > 0;
  const canRedo = futureHistory.length > 0;

  const tabs: { id: WorkflowStep; label: string; keyHint: string; icon: React.ReactNode }[] = [
    {
      id: 'formations',
      label: 'フォーメーション',
      keyHint: '1',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
    },
    {
      id: 'lighting',
      label: '照明',
      keyHint: '2',
      icon: <Lightbulb className="w-3.5 h-3.5" />,
    },
    {
      id: 'timeline',
      label: 'タイムライン',
      keyHint: '3',
      icon: <Music className="w-3.5 h-3.5" />,
    },
    {
      id: 'settings',
      label: '設定・保存',
      keyHint: '4',
      icon: <Settings className="w-3.5 h-3.5" />,
    },
  ];

  return (
    <header className="min-h-10 px-2 py-1 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 select-none shrink-0 print:hidden relative z-40">
      {/* Left: Back to Project List & Project Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleBackToHomeClick}
          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden md:inline">プロジェクト一覧</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-white truncate max-w-[180px]">
            {projectName}
          </span>
          <span className="hidden xl:inline text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">
            {stageGridCols}×{stageGridRows}グリッド ({stageWidth}m×{stageDepth}m)
          </span>

          <button
            onClick={() => saveProjectFile(false)}
            className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 border transition shadow-sm ${
              dirty
                ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
            }`}
            title="プロジェクトを上書き保存 (Ctrl+S)"
          >
            <Save className={`w-4 h-4 ${dirty ? 'text-amber-400' : 'text-sky-400'}`} />
            {dirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
          </button>
        </div>
      </div>

      {/* Center: Simplified Main Navigation Tabs */}
      <nav className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
        {tabs.map((tab) => {
          const isActive = currentStep === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setCurrentStep(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                isActive
                  ? tab.id === 'settings'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
              title={`ショートカット: 数字キー [${tab.keyHint}]`}
            >
              {tab.icon}
              <span className="hidden lg:inline">{tab.label}</span>
              <span className="hidden xl:inline text-[10px] opacity-60 font-mono">
                [{tab.keyHint}]
              </span>
            </button>
          );
        })}
      </nav>

      {/* Right: Undo / Redo, Path & Name Toggles, Viewport Mode Switcher */}
      <div className="flex items-center gap-2">
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-0.5">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-1.5 rounded text-xs font-semibold flex items-center justify-center transition ${
              canUndo
                ? 'text-slate-200 hover:bg-slate-800 hover:text-sky-400'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="元に戻す (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-1.5 rounded text-xs font-semibold flex items-center justify-center transition ${
              canRedo
                ? 'text-slate-200 hover:bg-slate-800 hover:text-sky-400'
                : 'text-slate-600 cursor-not-allowed'
            }`}
            title="やり直す (Ctrl+Y / Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>
        </div>

        {/* Display Toggles (経路・名前) */}
        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-0.5">
          <button
            onClick={() => setShowPaths(!showPaths)}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
              showPaths
                ? 'bg-emerald-500/20 text-emerald-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="移動経路の矢印を表示 / 非表示"
          >
            <Route className="w-3.5 h-3.5" />
            <span>経路</span>
          </button>
          <button
            onClick={() => setShowDancerNames(!showDancerNames)}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
              showDancerNames
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="ダンサー名を表示 / 非表示"
          >
            {showDancerNames ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>名前</span>
          </button>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 gap-0.5">
          <button
            onClick={() => setViewportMode('split')}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
              viewportMode === 'split'
                ? 'bg-slate-800 text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
            title="ショートカット: Vキー"
          >
            <Columns className="w-3.5 h-3.5" />
            <span>2D+3D</span>
          </button>
          <button
            onClick={() => setViewportMode('2d')}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
              viewportMode === '2d'
                ? 'bg-slate-800 text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GridIcon className="w-3.5 h-3.5" />
            <span>2D</span>
          </button>
          <button
            onClick={() => setViewportMode('3d')}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
              viewportMode === '3d'
                ? 'bg-slate-800 text-sky-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            <span>3D</span>
          </button>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-700 p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-2.5 text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-white">
                保存されていない変更があります
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              プロジェクトに変更が加えられています。保存せずにプロジェクト一覧に戻りますか？
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowUnsavedDialog(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnsavedDialog(false);
                  closeProjectToHome();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-xs text-rose-300 font-semibold transition"
              >
                保存せずに閉じる
              </button>
              <button
                type="button"
                onClick={async () => {
                  await saveProjectFile(false);
                  setShowUnsavedDialog(false);
                  closeProjectToHome();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs text-white font-bold shadow transition"
              >
                保存して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
