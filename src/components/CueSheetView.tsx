import React from 'react';
import { Printer, X } from 'lucide-react';
import { GRID_UNIT_M, useFormationStore } from '../store/useFormationStore';

export const CueSheetView: React.FC = () => {
  const {
    projectName,
    stageGridCols,
    stageGridRows,
    stageWidth,
    stageDepth,
    wingWidth,
    stageInverted,
    showDancerNames,
    dancerScale,
    performers,
    formations,
    setShowPdfModal,
  } = useFormationStore();

  const halfCols = stageGridCols / 2;
  const halfRows = stageGridRows / 2;
  const totalWidth = stageWidth + wingWidth * 2;

  const verticalGridIndices: number[] = [];
  for (let g = -Math.floor(halfCols); g <= Math.floor(halfCols); g += 1) {
    verticalGridIndices.push(g);
  }
  const horizontalGridIndices: number[] = [];
  for (let r = -Math.floor(halfRows); r <= Math.floor(halfRows); r += 1) {
    horizontalGridIndices.push(r);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 overflow-y-auto p-6 text-slate-100 select-text print:static print:z-auto print:bg-white print:text-slate-900 print:p-0 print:overflow-visible print:h-auto print:w-full">
      <div className="max-w-5xl mx-auto space-y-6 print:max-w-none print:w-full print:space-y-5">
        {/* Top Action Bar (hidden when printing to PDF) */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-xl p-4 shadow-xl print:hidden">
          <div>
            <h2 className="text-lg font-bold text-white">
              {projectName} — フォーメーション一覧 PDFプレビュー
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              「PDFとして保存 / 印刷」を押し、プリンターで「PDFに保存 (Microsoft Print to PDF)」を選択するとPDFファイルとして保存できます。
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow"
            >
              <Printer className="w-4 h-4" />
              PDFとして保存 / 印刷
            </button>
            <button
              onClick={() => setShowPdfModal(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              編集画面に戻る
            </button>
          </div>
        </div>

        {/* Printable Document Header & Dancer Roster */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3 print:bg-white print:border-slate-300 print:p-2.5 print:space-y-1.5 print:mb-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 print:border-slate-300 print:pb-1">
            <div>
              <h1 className="text-xl font-bold text-white print:text-slate-900 flex items-center gap-2 print:text-sm">
                <span>{projectName} — フォーメーション一覧表</span>
                {stageInverted && (
                  <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 print:border-amber-600 print:text-amber-800 print:text-[10px] print:px-1.5 print:py-0">
                    ステージ反転中 (客席奥側)
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-400 print:text-slate-600 mt-0.5 print:text-[10px]">
                ステージサイズ: 横 {stageGridCols}グリッド ({stageWidth}m) × 奥行{' '}
                {stageGridRows}グリッド ({stageDepth}m) / ダンサー:{' '}
                {performers.length}名
              </p>
            </div>
          </div>

          {/* Dancer Number & Name Legend */}
          <div className="flex flex-wrap items-center gap-2 pt-1 print:gap-1 print:pt-0.5">
            <span className="text-xs font-bold text-slate-400 print:text-slate-700 mr-1 print:text-[10px]">
              ダンサー番号一覧:
            </span>
            {performers.map((p, idx) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 text-xs print:bg-slate-100 print:border-slate-300 print:text-slate-900 print:px-1.5 print:py-0.5 print:text-[10px] print:gap-1"
              >
                <span
                  className="w-4 h-4 rounded-full text-[10px] font-bold text-white flex items-center justify-center print:w-3.5 print:h-3.5 print:text-[9px]"
                  style={{ backgroundColor: p.color }}
                >
                  {idx + 1}
                </span>
                <span className="font-semibold">{p.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Formations 1-Column List: Left = Stage Image, Right = Comment */}
        <div className="grid grid-cols-1 gap-6 print:grid-cols-1 print:gap-0">
          {formations.map((f, fIdx) => {
            const prevF = fIdx > 0 ? formations[fIdx - 1] : null;
            const formattedNotes = (f.notes || '')
              .split('\n')
              .slice(0, 14)
              .join('\n')
              .slice(0, 500);
            return (
              <div
                key={f.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-3.5 pdf-formation-card break-inside-avoid print:bg-white print:border-slate-300 print:shadow-none print:break-inside-avoid print:page-break-inside-avoid print:p-2 print:gap-1.5"
                style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 print:border-slate-200 print:pb-0.5 print:mb-0.5">
                  <span className="font-bold text-base md:text-lg text-sky-400 print:text-slate-900 truncate print:text-[12px]">
                    #{fIdx + 1} {f.name}
                  </span>
                </div>

                {/* Horizontal Split: Stage Diagram on Left, Comment Box on Right */}
                <div className="flex flex-col md:flex-row print:flex-row gap-4 print:gap-2.5 items-stretch">
                  {/* Left: 2D Stage Diagram */}
                  <div className="w-full md:w-[58%] print:w-[56%] aspect-[16/10] print:aspect-auto print:h-[65mm] bg-slate-950 rounded-lg border border-slate-800 p-2.5 print:p-1 relative flex items-center justify-center shrink-0">
                    <svg
                      viewBox={`${-totalWidth / 2 - 0.9} ${-stageDepth / 2 - 0.9} ${
                        totalWidth + 1.8
                      } ${stageDepth + 2.0}`}
                      className="w-full h-full"
                    >
                      {/* Left & Right Stage Wings */}
                      <rect
                        x={-totalWidth / 2}
                        y={-stageDepth / 2}
                        width={wingWidth}
                        height={stageDepth}
                        fill="#060911"
                        stroke="#334155"
                        strokeWidth={0.04}
                        strokeDasharray="0.15 0.1"
                      />
                      <rect
                        x={stageWidth / 2}
                        y={-stageDepth / 2}
                        width={wingWidth}
                        height={stageDepth}
                        fill="#060911"
                        stroke="#334155"
                        strokeWidth={0.04}
                        strokeDasharray="0.15 0.1"
                      />

                      {/* Main Stage Base */}
                      <rect
                        x={-stageWidth / 2}
                        y={-stageDepth / 2}
                        width={stageWidth}
                        height={stageDepth}
                        fill="#0f172a"
                        stroke="#475569"
                        strokeWidth={0.06}
                      />

                      {/* Grid & Bamiri Numbers */}
                      {verticalGridIndices.map((g) => {
                        const x = g * GRID_UNIT_M;
                        return (
                          <g key={`pvx-${g}`}>
                            <line
                              x1={x}
                              y1={-stageDepth / 2}
                              x2={x}
                              y2={stageDepth / 2}
                              stroke={g === 0 ? '#475569' : '#1e293b'}
                              strokeWidth={g === 0 ? 0.04 : 0.02}
                              strokeDasharray={g === 0 ? '0.15 0.1' : undefined}
                            />
                            <text
                              x={x}
                              y={stageInverted ? -stageDepth / 2 - 0.2 : stageDepth / 2 + 0.42}
                              textAnchor="middle"
                              fill={g === 0 ? '#ffffff' : '#94a3b8'}
                              fontSize="0.28"
                              fontWeight="bold"
                            >
                              {g === 0 ? '0' : Math.abs(g)}
                            </text>
                          </g>
                        );
                      })}
                      {horizontalGridIndices.map((r) => {
                        const z = r * GRID_UNIT_M;
                        return (
                          <line
                            key={`phz-${r}`}
                            x1={-stageWidth / 2}
                            y1={z}
                            x2={stageWidth / 2}
                            y2={z}
                            stroke={r === 0 ? '#475569' : '#1e293b'}
                            strokeWidth={r === 0 ? 0.04 : 0.02}
                            strokeDasharray={r === 0 ? '0.15 0.1' : undefined}
                          />
                        );
                      })}

                      {/* Side Curtains (袖幕) */}
                      <line
                        x1={-stageWidth / 2}
                        y1={-stageDepth / 2}
                        x2={-stageWidth / 2}
                        y2={stageDepth / 2}
                        stroke="#e11d48"
                        strokeWidth={0.09}
                      />
                      <line
                        x1={stageWidth / 2}
                        y1={-stageDepth / 2}
                        x2={stageWidth / 2}
                        y2={stageDepth / 2}
                        stroke="#e11d48"
                        strokeWidth={0.09}
                      />

                      <text
                        x={-stageWidth / 2 - wingWidth / 2}
                        y={-stageDepth / 2 - 0.25}
                        textAnchor="middle"
                        fill="#f43f5e"
                        fontSize="0.24"
                        fontWeight="bold"
                      >
                        下手袖
                      </text>
                      <text
                        x={stageWidth / 2 + wingWidth / 2}
                        y={-stageDepth / 2 - 0.25}
                        textAnchor="middle"
                        fill="#f43f5e"
                        fontSize="0.24"
                        fontWeight="bold"
                      >
                        上手袖
                      </text>

                      {/* Top / Bottom Stage Labels */}
                      <text
                        x={0}
                        y={-stageDepth / 2 - 0.45}
                        textAnchor="middle"
                        fill={stageInverted ? '#38bdf8' : '#64748b'}
                        fontSize="0.28"
                        fontWeight="bold"
                      >
                        {stageInverted ? '▼ 客席正面 (FRONT) ▼' : '▲ ステージ奥 (BACK) ▲'}
                      </text>

                      <text
                        x={0}
                        y={stageDepth / 2 + 0.88}
                        textAnchor="middle"
                        fill={stageInverted ? '#64748b' : '#38bdf8'}
                        fontSize="0.32"
                        fontWeight="bold"
                      >
                        {stageInverted ? '▲ ステージ奥 (BACK) ▲' : '▼ 客席正面 (FRONT) ▼'}
                      </text>

                      {/* Movement dashed lines from previous formation */}
                      {prevF &&
                        performers.map((p) => {
                          const prev = prevF.positions[p.id];
                          const curr = f.positions[p.id];
                          if (!prev || !curr) return null;
                          if (Math.hypot(curr.x - prev.x, curr.z - prev.z) < 0.15)
                            return null;
                          const dCol = f.colors?.[p.id] || p.color;
                          return (
                            <line
                              key={`p-arrow-${p.id}`}
                              x1={prev.x}
                              y1={prev.z}
                              x2={curr.x}
                              y2={curr.z}
                              stroke={dCol}
                              strokeWidth={0.04}
                              strokeDasharray="0.15 0.1"
                              opacity={0.7}
                            />
                          );
                        })}

                      {/* Dancers */}
                      {performers.map((p, idx) => {
                        const pos = f.positions[p.id] || { x: 0, z: 0 };
                        const dCol = f.colors?.[p.id] || p.color;
                        const inWing = Math.abs(pos.x) > stageWidth / 2 + 0.05;
                        const sc = dancerScale || 0.72;
                        return (
                          <g
                            key={p.id}
                            transform={`translate(${pos.x}, ${pos.z}) scale(${sc})`}
                            opacity={inWing ? 0.55 : 1}
                          >
                            <polygon
                              points={
                                stageInverted
                                  ? '0,-0.52 -0.17,-0.3 0.17,-0.3'
                                  : '0,0.52 -0.17,0.3 0.17,0.3'
                              }
                              fill={dCol}
                            />
                            <circle
                              r={0.38}
                              fill={dCol}
                              stroke="#0f172a"
                              strokeWidth={0.05}
                            />
                            <text
                              x={0}
                              y={0.12}
                              textAnchor="middle"
                              fill="#ffffff"
                              fontSize="0.3"
                              fontWeight="bold"
                            >
                              {idx + 1}
                            </text>
                            {showDancerNames && (
                              <text
                                x={0}
                                y={0.68}
                                textAnchor="middle"
                                fill="#f8fafc"
                                fontSize="0.24"
                                fontWeight="600"
                              >
                                {inWing ? `[袖]${p.name}` : p.name}
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Right: Spacious Multi-Line Comment Box */}
                  <div className="w-full md:w-[42%] print:w-[44%] print:h-[65mm] bg-slate-950/75 p-4 rounded-lg border border-slate-800 print:bg-slate-50 print:text-slate-900 print:border-slate-300 print:p-2 flex flex-col">
                    <div className="text-xs font-bold text-sky-400 print:text-slate-700 border-b border-slate-800 print:border-slate-300 pb-1.5 mb-2 print:pb-0.5 print:mb-1 flex items-center gap-1.5 print:text-[10px]">
                      <span>コメント・構成指示</span>
                    </div>
                    <div className="flex-1 text-sm md:text-[15px] print:text-[11px] print:leading-snug font-medium text-slate-200 print:text-slate-900 overflow-hidden whitespace-pre-wrap break-words leading-relaxed">
                      {formattedNotes || 'メモなし'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
