import React, { useState } from 'react';
import {
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  Upload,
  Sparkles,
  Users,
  LayoutGrid,
  Lightbulb,
  Clock,
} from 'lucide-react';
import { useFormationStore, GRID_UNIT_M } from '../store/useFormationStore';
import { StageTheme } from '../types';
import { ThemeSwitcher } from './ThemeSwitcher';

export const ProjectListHome: React.FC = () => {
  const {
    projects,
    openProject,
    createNewProject,
    duplicateProject,
    deleteProject,
    importProjectJson,
  } = useFormationStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCols, setNewCols] = useState(12); // 12 grids = 10.8m
  const [newRows, setNewRows] = useState(8);  // 8 grids = 7.2m
  const [newDancerCount, setNewDancerCount] = useState(5);
  const [newTheme, setNewTheme] = useState<StageTheme>('hall');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createNewProject(
      newTitle.trim() || `新規プロジェクト ${projects.length + 1}`,
      newCols,
      newRows,
      newDancerCount,
      newTheme
    );
    setShowCreateModal(false);
    setNewTitle('');
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        importProjectJson(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleOpenNativeDialog = async () => {
    if (window.electronAPI?.showOpenDialog) {
      try {
        const res = await window.electronAPI.showOpenDialog();
        if (res && 'content' in res && res.content) {
          importProjectJson(res.content, res.filePath);
        }
      } catch (err) {
        console.error('Failed to open file via electron dialog:', err);
      }
    }
  };

  return (
    <div className="w-screen h-screen bg-slate-950 text-slate-100 flex flex-col overflow-y-auto select-none">
      {/* Top Hero Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/70 px-8 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-base tracking-tighter shadow-lg">
              F&amp;L
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Formation & Lighting Studio
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Desktop Edition
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                ダンス・パフォーマンスのフォーメーション作成・舞台照明シミュレーション・音楽タイムライン管理
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {window.electronAPI?.isElectron ? (
              <button
                type="button"
                onClick={handleOpenNativeDialog}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition shadow-sm"
              >
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>JSONファイルから読込</span>
              </button>
            ) : (
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-2 transition">
                <Upload className="w-4 h-4 text-emerald-400" />
                <span>JSONファイルから読込</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportFile}
                  className="hidden"
                />
              </label>
            )}

            <button
              onClick={() => setShowCreateModal(true)}
              className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg transition"
            >
              <Plus className="w-4 h-4" />
              <span>新規プロジェクトを作成</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Project List Section */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-300 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-sky-400" />
            プロジェクト一覧 ({projects.length}件)
          </h2>
          <span className="text-xs text-slate-500">
            カードをクリックすると編集画面が開きます
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* New Project Quick Card */}
          <button
            onClick={() => setShowCreateModal(true)}
            className="min-h-[240px] rounded-2xl border-2 border-dashed border-slate-800 hover:border-sky-500/70 bg-slate-900/30 hover:bg-slate-900/70 p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-sky-300 transition group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-800 group-hover:bg-sky-500/20 flex items-center justify-center transition">
              <Plus className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="text-sm font-bold">＋ 新しいプロジェクトを作成</div>
              <div className="text-[11px] text-slate-500 mt-1">
                ステージサイズ（90cmグリッド）とダンサー人数を指定して開始
              </div>
            </div>
          </button>

          {/* Existing Project Cards */}
          {projects.map((proj) => {
            const firstForm = proj.formations[0];
            const cols = proj.stageGridCols || 12;
            const rows = proj.stageGridRows || 8;
            const wM = (cols * GRID_UNIT_M).toFixed(1);
            const dM = (rows * GRID_UNIT_M).toFixed(1);

            return (
              <div
                key={proj.id}
                onClick={() => openProject(proj.id)}
                className="min-h-[240px] rounded-2xl border border-slate-800 hover:border-sky-500 bg-slate-900/80 hover:bg-slate-900 p-4 flex flex-col justify-between cursor-pointer shadow-lg transition group"
              >
                {/* Mini Stage Thumbnail */}
                <div className="h-32 w-full bg-slate-950 rounded-xl border border-slate-800/90 overflow-hidden relative flex items-center justify-center p-2">
                  <svg
                    viewBox={`${-(cols * GRID_UNIT_M) / 2 - 2} ${-(rows * GRID_UNIT_M) / 2 - 1} ${
                      cols * GRID_UNIT_M + 4
                    } ${rows * GRID_UNIT_M + 2}`}
                    className="w-full h-full"
                  >
                    <rect
                      x={-(cols * GRID_UNIT_M) / 2}
                      y={-(rows * GRID_UNIT_M) / 2}
                      width={cols * GRID_UNIT_M}
                      height={rows * GRID_UNIT_M}
                      rx={0.2}
                      fill={proj.stageTheme === 'clubhouse' ? '#090d16' : '#5c3e26'}
                      stroke="#475569"
                      strokeWidth={0.1}
                    />
                    {proj.performers.map((p) => {
                      const pos = firstForm?.positions[p.id] || { x: 0, z: 0 };
                      const dCol = firstForm?.colors?.[p.id] || p.color;
                      return (
                        <circle
                          key={p.id}
                          cx={pos.x}
                          cy={pos.z}
                          r={0.38}
                          fill={dCol}
                        />
                      );
                    })}
                  </svg>
                  <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-[10px] text-slate-300 font-mono">
                    {cols}×{rows}グリッド ({wM}m×{dM}m)
                  </span>
                </div>

                {/* Project Info */}
                <div className="mt-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-sm text-white group-hover:text-sky-400 transition truncate">
                      {proj.projectName}
                    </h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          duplicateProject(proj.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-sky-300"
                        title="プロジェクトを複製"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      {projects.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteProject(proj.id);
                          }}
                          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                          title="プロジェクトを削除"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-sky-400" />
                      {proj.performers.length}人
                    </span>
                    <span className="flex items-center gap-1">
                      <LayoutGrid className="w-3.5 h-3.5 text-emerald-400" />
                      配置 {proj.formations.length}
                    </span>
                    <span className="flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                      {proj.stageTheme === 'clubhouse' ? 'クラブ' : 'ホール'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {proj.updatedAt}
                    </span>
                    <span className="text-sky-400 font-bold group-hover:translate-x-0.5 transition">
                      開く →
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Create New Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreate}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-base font-bold text-white border-b border-slate-800 pb-3">
              <Sparkles className="w-5 h-5 text-sky-400" />
              新規プロジェクトの作成
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  プロジェクト名（曲名・演目名など）
                </label>
                <input
                  type="text"
                  required
                  placeholder="例：夏公演オープニングナンバー"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 focus:border-sky-500 rounded-lg px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ステージの見た目
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTheme('hall')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                      newTheme === 'hall'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    ホール仕様
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTheme('clubhouse')}
                    className={`py-2 px-3 rounded-lg border text-xs font-bold transition ${
                      newTheme === 'clubhouse'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    クラブハウス仕様
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    横サイズ:{' '}
                    <strong className="text-sky-400">
                      {newCols}グリッド ({(newCols * GRID_UNIT_M).toFixed(1)}m)
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={6}
                    max={24}
                    step={2}
                    value={newCols}
                    onChange={(e) => setNewCols(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    縦(奥行):{' '}
                    <strong className="text-sky-400">
                      {newRows}グリッド ({(newRows * GRID_UNIT_M).toFixed(1)}m)
                    </strong>
                  </label>
                  <input
                    type="range"
                    min={4}
                    max={16}
                    step={2}
                    value={newRows}
                    onChange={(e) => setNewRows(parseInt(e.target.value, 10))}
                    className="w-full accent-sky-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  ダンサーの人数: <strong className="text-sky-400">{newDancerCount}人</strong>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={1}
                    max={80}
                    value={newDancerCount}
                    onChange={(e) => setNewDancerCount(parseInt(e.target.value, 10))}
                    className="flex-1 accent-sky-500"
                  />
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={newDancerCount}
                    onChange={(e) =>
                      setNewDancerCount(
                        Math.max(1, Math.min(80, parseInt(e.target.value, 10) || 1))
                      )
                    }
                    className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-xs font-bold text-sky-400"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                キャンセル
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-xs font-bold text-white shadow-lg"
              >
                作成して編集を始める
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
