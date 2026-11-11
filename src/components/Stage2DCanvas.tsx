import React, { useRef, useState, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useFormationStore, GRID_UNIT_M } from '../store/useFormationStore';
import { InterpolatedStageState } from '../utils/interpolation';
import { Position2D } from '../types';

interface Stage2DCanvasProps {
  stageState: InterpolatedStageState;
}

export const Stage2DCanvas: React.FC<Stage2DCanvasProps> = ({ stageState }) => {
  const {
    currentStep,
    stageGridCols,
    stageGridRows,
    stageWidth,
    stageDepth,
    wingWidth,
    stageTheme,
    stageInverted,
    performers,
    lightFixtures,
    activeFormationId,
    activePresetId,
    selectedPerformerIds,
    selectedGroupId,
    selectedLightId,
    showPaths,
    showLightBeams,
    showDancerNames,
    dancerScale,
    isPlaying,
    isRecordingVideo,
    selectPerformer,
    selectPerformersByIds,
    selectLight,
    moveSelectedPerformersByDelta,
    updateLightConfig,
    pushHistorySnapshot,
  } = useFormationStore();

  const svgRef = useRef<SVGSVGElement | null>(null);
  const hasRecordedHistoryRef = useRef<boolean>(false);
  const [draggingType, setDraggingType] = useState<
    'performer' | 'light' | 'marquee' | null
  >(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragStartStage, setDragStartStage] = useState<Position2D>({ x: 0, z: 0 });
  const [dragBasePositions, setDragBasePositions] = useState<
    Record<string, Position2D>
  >({});
  const [marqueeEnd, setMarqueeEnd] = useState<Position2D>({ x: 0, z: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [pan, setPan] = useState<Position2D>({ x: 0, z: 0 });
  const [panStart, setPanStart] = useState<{
    clientX: number;
    clientY: number;
    initialPan: Position2D;
  } | null>(null);

  const totalWidthWithWings = stageWidth + wingWidth * 2;
  const padding = 1.2;
  const baseViewW = totalWidthWithWings + padding * 2;
  const baseViewH = stageDepth + padding * 2;

  const viewW = baseViewW / zoom;
  const viewH = baseViewH / zoom;
  const viewMinX = pan.x - viewW / 2;
  const viewMinZ = pan.z - viewH / 2;

  const clientToStageCoords = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, z: 0 };
    const rect = svg.getBoundingClientRect();
    const scaleX = viewW / rect.width;
    const scaleY = viewH / rect.height;
    const scale = Math.max(scaleX, scaleY);

    const renderedW = viewW / scale;
    const renderedH = viewH / scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;

    const x = viewMinX + (clientX - rect.left - offsetX) * scale;
    const z = viewMinZ + (clientY - rect.top - offsetY) * scale;
    return { x, z };
  };

  // Wheel zoom / Touchpad pinch-to-zoom
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.ctrlKey
        ? e.deltaY < 0
          ? 1.08
          : 0.92
        : e.deltaY < 0
        ? 1.12
        : 0.88;

      setZoom((curZoom) => {
        const nextZoom = Math.max(
          0.4,
          Math.min(6.0, Math.round(curZoom * zoomFactor * 100) / 100)
        );
        if (Math.abs(nextZoom - curZoom) < 0.001) return curZoom;

        // Zoom toward pointer
        const coords = clientToStageCoords(e.clientX, e.clientY);
        setPan((curPan) => ({
          x: Number(
            (coords.x - (coords.x - curPan.x) * (curZoom / nextZoom)).toFixed(2)
          ),
          z: Number(
            (coords.z - (coords.z - curPan.z) * (curZoom / nextZoom)).toFixed(2)
          ),
        }));
        return nextZoom;
      });
    };

    svg.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      svg.removeEventListener('wheel', handleWheel);
    };
  }, [viewMinX, viewMinZ, viewW, viewH, zoom, pan]);

  // Start marquee range selection or pan
  const handleCanvasPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isPlaying || currentStep === 'timeline') return;

    // Right-click, middle-click, or Alt+click pans the 2D stage
    if (e.button === 1 || e.button === 2 || e.altKey) {
      e.preventDefault();
      setPanStart({
        clientX: e.clientX,
        clientY: e.clientY,
        initialPan: { ...pan },
      });
      return;
    }

    const coords = clientToStageCoords(e.clientX, e.clientY);
    setDraggingType('marquee');
    setDragStartStage(coords);
    setMarqueeEnd(coords);
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      selectPerformersByIds([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (panStart) {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const scale = Math.max(viewW / rect.width, viewH / rect.height);
      const dx = (e.clientX - panStart.clientX) * scale;
      const dz = (e.clientY - panStart.clientY) * scale;
      setPan({
        x: Number((panStart.initialPan.x - dx).toFixed(2)),
        z: Number((panStart.initialPan.z - dz).toFixed(2)),
      });
      return;
    }

    if (!draggingType || isPlaying) return;
    const coords = clientToStageCoords(e.clientX, e.clientY);

    if (draggingType === 'marquee') {
      setMarqueeEnd(coords);
      const minX = Math.min(dragStartStage.x, coords.x);
      const maxX = Math.max(dragStartStage.x, coords.x);
      const minZ = Math.min(dragStartStage.z, coords.z);
      const maxZ = Math.max(dragStartStage.z, coords.z);

      const insideIds = performers
        .filter((p) => {
          const pos = stageState.positions[p.id] || { x: 0, z: 0 };
          return pos.x >= minX && pos.x <= maxX && pos.z >= minZ && pos.z <= maxZ;
        })
        .map((p) => p.id);

      selectPerformersByIds(insideIds);
    } else if (draggingType === 'performer') {
      const dx = coords.x - dragStartStage.x;
      const dz = coords.z - dragStartStage.z;
      if (!hasRecordedHistoryRef.current && Math.hypot(dx, dz) > 0.05) {
        pushHistorySnapshot();
        hasRecordedHistoryRef.current = true;
      }
      moveSelectedPerformersByDelta(
        activeFormationId,
        dx,
        dz,
        dragBasePositions
      );
    } else if (draggingType === 'light' && draggingId) {
      if (!hasRecordedHistoryRef.current) {
        pushHistorySnapshot();
        hasRecordedHistoryRef.current = true;
      }
      const halfW = stageWidth / 2;
      const halfD = stageDepth / 2;
      const tx = Math.max(
        -halfW,
        Math.min(halfW, Number((Math.round(coords.x / 0.45) * 0.45).toFixed(2)))
      );
      const tz = Math.max(
        -halfD,
        Math.min(halfD, Number((Math.round(coords.z / 0.45) * 0.45).toFixed(2)))
      );
      updateLightConfig(activePresetId, draggingId, {
        targetX: tx,
        targetZ: tz,
        followPerformerId: null,
      });
    }
  };

  const handlePointerUp = () => {
    setPanStart(null);
    setDraggingType(null);
    setDraggingId(null);
    hasRecordedHistoryRef.current = false;
  };

  // Generate 90cm (GRID_UNIT_M = 0.9m) grid lines across main stage
  const halfCols = stageGridCols / 2;
  const verticalGridIndices: number[] = [];
  for (let i = -Math.floor(halfCols); i <= Math.floor(halfCols); i++) {
    verticalGridIndices.push(i);
  }

  const halfRows = stageGridRows / 2;
  const horizontalGridIndices: number[] = [];
  for (let j = -Math.floor(halfRows); j <= Math.floor(halfRows); j++) {
    horizontalGridIndices.push(j);
  }

  const curtainZPositions = [-stageDepth * 0.3, 0, stageDepth * 0.3];
  const isHall = stageTheme === 'hall';

  // User-adjustable dancer scale
  const avatarScale = dancerScale || 0.72;

  return (
    <div className="relative w-full h-full flex flex-col bg-slate-950 overflow-hidden select-none">
      {/* Minimal Top Badge */}
      <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1.5 pointer-events-none">
        <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[11px] font-bold text-sky-400 flex items-center gap-1">
          <span>2D</span>
          {stageInverted && (
            <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
              反転中
            </span>
          )}
          <span>({stageGridCols}×{stageGridRows}グリッド / {stageWidth}m×{stageDepth}m)</span>
        </span>
        {selectedPerformerIds.length > 1 && (
          <span className="px-2 py-0.5 rounded bg-sky-600 text-white text-[11px] font-bold shadow">
            {selectedPerformerIds.length}人選択中
          </span>
        )}
        {isRecordingVideo && (
          <div className="flex items-center gap-2 pointer-events-auto ml-1">
            <span className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold animate-pulse shadow">
              ● 録画中...
            </span>
            <button
              onClick={() => useFormationStore.getState().setIsPlaying(false)}
              className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-rose-400 text-rose-200 hover:text-white text-xs font-bold shadow transition"
            >
              ここで録画完了して保存
            </button>
          </div>
        )}
      </div>

      {/* 2D Zoom & Pan Controls */}
      <div className="absolute top-2.5 right-2.5 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 rounded-lg p-1 shadow">
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.max(0.4, Math.round((z - 0.2) * 10) / 10))
          }
          className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="2D表示を縮小 (ホイールまたはピンチでも可)"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setZoom(1.0);
            setPan({ x: 0, z: 0 });
          }}
          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-sky-400 hover:bg-slate-800 transition"
          title="ズームと位置を100%にリセット"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          onClick={() =>
            setZoom((z) => Math.min(6.0, Math.round((z + 0.2) * 10) / 10))
          }
          className="p-1 rounded hover:bg-slate-800 text-slate-300 hover:text-white transition"
          title="2D表示を拡大 (ホイールまたはピンチでも可)"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        {(zoom !== 1.0 || pan.x !== 0 || pan.z !== 0) && (
          <button
            type="button"
            onClick={() => {
              setZoom(1.0);
              setPan({ x: 0, z: 0 });
            }}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-300 transition"
            title="中央位置・ズームをリセット"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        )}
      </div>

      <svg
        ref={svgRef}
        viewBox={`${viewMinX} ${viewMinZ} ${viewW} ${viewH}`}
        className="w-full h-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <marker
            id="move-arrow"
            viewBox="0 0 10 10"
            refX="6"
            refY="5"
            markerWidth="4.5"
            markerHeight="4.5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#94a3b8" />
          </marker>
          {lightFixtures.map((fixture) => {
            const lState = stageState.lights[fixture.id];
            if (!lState) return null;
            const isPin = fixture.groupId === 'pinspot';
            return (
              <radialGradient
                key={`grad-${fixture.id}`}
                id={`spot-grad-${fixture.id}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop
                  offset="0%"
                  stopColor={lState.color}
                  stopOpacity={Math.min(
                    0.65,
                    lState.intensity * (isPin ? 0.28 : 0.14)
                  )}
                />
                <stop
                  offset={isPin ? '75%' : '55%'}
                  stopColor={lState.color}
                  stopOpacity={Math.min(0.28, lState.intensity * 0.07)}
                />
                <stop offset="100%" stopColor={lState.color} stopOpacity={0} />
              </radialGradient>
            );
          })}
        </defs>

        <text
          x={0}
          y={-stageDepth / 2 - 0.4}
          textAnchor="middle"
          fill={stageInverted ? '#38bdf8' : '#64748b'}
          fontSize="0.3"
          fontWeight={stageInverted ? '700' : '600'}
        >
          {stageInverted ? '▼ FRONT (客席) ▼' : '▲ BACK ▲'}
        </text>

        {/* Left Wing (下手袖) */}
        <rect
          x={-stageWidth / 2 - wingWidth}
          y={-stageDepth / 2}
          width={wingWidth}
          height={stageDepth}
          fill="#060911"
          stroke="#334155"
          strokeWidth={0.04}
          strokeDasharray="0.15 0.1"
        />
        <text
          x={-stageWidth / 2 - wingWidth / 2}
          y={-stageDepth / 2 + 0.55}
          textAnchor="middle"
          fill="#64748b"
          fontSize="0.26"
          fontWeight="700"
        >
          下手袖
        </text>

        {/* Right Wing (上手袖) */}
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
        <text
          x={stageWidth / 2 + wingWidth / 2}
          y={-stageDepth / 2 + 0.55}
          textAnchor="middle"
          fill="#64748b"
          fontSize="0.26"
          fontWeight="700"
        >
          上手袖
        </text>

        {/* Back Wall Indicator (Hall = White Cyclorama) */}
        <rect
          x={-stageWidth / 2}
          y={stageInverted ? stageDepth / 2 : -stageDepth / 2 - 0.14}
          width={stageWidth}
          height={0.14}
          fill={isHall ? '#f8fafc' : '#06b6d4'}
          opacity={isHall ? 0.92 : 0.75}
          pointerEvents="none"
        />

        {/* Main Stage Floor Base */}
        <rect
          x={-stageWidth / 2}
          y={-stageDepth / 2}
          width={stageWidth}
          height={stageDepth}
          fill={isHall ? '#5c3e26' : '#090d16'}
          stroke={isHall ? '#b4845c' : '#38bdf8'}
          strokeWidth={0.06}
        />

        {/* Ambient Tint Overlay */}
        <rect
          x={-stageWidth / 2}
          y={-stageDepth / 2}
          width={stageWidth}
          height={stageDepth}
          fill={stageState.ambientColor}
          opacity={Math.min(0.28, stageState.ambientIntensity * 0.28)}
          pointerEvents="none"
        />

        {/* 90cm Grid Lines & Bamiri Numbers */}
        {verticalGridIndices.map((gridIdx) => {
          const x = Number((gridIdx * GRID_UNIT_M).toFixed(2));
          return (
            <g key={`vx-${gridIdx}`} pointerEvents="none">
              <line
                x1={x}
                y1={-stageDepth / 2}
                x2={x}
                y2={stageDepth / 2}
                stroke={gridIdx === 0 ? '#cbd5e1' : isHall ? '#422c1b' : '#292524'}
                strokeWidth={gridIdx === 0 ? 0.045 : 0.025}
                strokeDasharray={gridIdx === 0 ? '0.15 0.1' : undefined}
              />
              <text
                x={x}
                y={stageInverted ? -stageDepth / 2 - 0.18 : stageDepth / 2 + 0.42}
                textAnchor="middle"
                fill={gridIdx === 0 ? '#f8fafc' : '#94a3b8'}
                fontSize={gridIdx === 0 ? '0.32' : '0.25'}
                fontWeight={gridIdx === 0 ? '800' : '600'}
              >
                {gridIdx === 0 ? '0' : Math.abs(gridIdx)}
              </text>
            </g>
          );
        })}

        {horizontalGridIndices.map((gridIdx) => {
          const z = Number((gridIdx * GRID_UNIT_M).toFixed(2));
          return (
            <line
              key={`hz-${gridIdx}`}
              x1={-stageWidth / 2}
              y1={z}
              x2={stageWidth / 2}
              y2={z}
              stroke={gridIdx === 0 ? '#cbd5e1' : isHall ? '#422c1b' : '#292524'}
              strokeWidth={gridIdx === 0 ? 0.045 : 0.025}
              strokeDasharray={gridIdx === 0 ? '0.15 0.1' : undefined}
              pointerEvents="none"
            />
          );
        })}

        {/* Side Curtains (袖幕) */}
        {curtainZPositions.map((cz, idx) => (
          <g key={`curtain-${idx}`} pointerEvents="none">
            <rect
              x={-stageWidth / 2 - 0.35}
              y={cz - 0.08}
              width={0.55}
              height={0.16}
              rx={0.04}
              fill={isHall ? '#7f1d1d' : '#1e293b'}
              stroke="#ffffff"
              strokeWidth={0.02}
            />
            <rect
              x={stageWidth / 2 - 0.2}
              y={cz - 0.08}
              width={0.55}
              height={0.16}
              rx={0.04}
              fill={isHall ? '#7f1d1d' : '#1e293b'}
              stroke="#ffffff"
              strokeWidth={0.02}
            />
          </g>
        ))}

        <text
          x={0}
          y={stageDepth / 2 + 0.9}
          textAnchor="middle"
          fill={stageInverted ? '#64748b' : '#38bdf8'}
          fontSize="0.3"
          fontWeight={stageInverted ? '600' : '700'}
          pointerEvents="none"
        >
          {stageInverted ? '▲ BACK ▲' : '▼ FRONT ▼'}
        </text>

        {/* Lighting Pools & Fixture Indicators */}
        {showLightBeams &&
          lightFixtures.map((fixture) => {
            const lState = stageState.lights[fixture.id];
            if (!lState || !lState.enabled || lState.intensity <= 0.04) return null;
            const isPin = fixture.groupId === 'pinspot';
            const isSelected = selectedLightId === fixture.id;
            const isInSelectedGroup = selectedGroupId === fixture.groupId;
            const radius = Math.max(0.55, Math.tan(lState.angle) * (isPin ? 5.0 : 3.6));

            const showHandle =
              isPin ||
              isSelected ||
              (currentStep === 'lighting' && isInSelectedGroup);

            return (
              <g key={`light-pool-${fixture.id}`}>
                <circle
                  cx={fixture.mountPosition[0]}
                  cy={Math.max(
                    -stageDepth / 2 - 0.25,
                    Math.min(stageDepth / 2 + 0.25, fixture.mountPosition[2])
                  )}
                  r={0.13}
                  fill={lState.color}
                  stroke="#ffffff"
                  strokeWidth={0.02}
                  opacity={0.85}
                  pointerEvents="none"
                />

                <circle
                  cx={lState.targetX}
                  cy={lState.targetZ}
                  r={radius}
                  fill={`url(#spot-grad-${fixture.id})`}
                  stroke={lState.color}
                  strokeWidth={isSelected ? 0.05 : isPin ? 0.035 : 0.015}
                  strokeDasharray={isPin ? undefined : '0.16 0.12'}
                  opacity={0.9}
                  pointerEvents="none"
                />

                {showHandle && (
                  <g
                    transform={`translate(${lState.targetX}, ${lState.targetZ})`}
                    className="cursor-move"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      selectLight(fixture.id);
                      if (!isPlaying && currentStep !== 'timeline') {
                        setDraggingType('light');
                        setDraggingId(fixture.id);
                      }
                    }}
                  >
                    <circle
                      r={isPin ? 0.28 : 0.22}
                      fill="#0f172a"
                      fillOpacity={0.82}
                      stroke={lState.color}
                      strokeWidth={isSelected ? 0.06 : 0.03}
                    />
                    <line
                      x1={-0.15}
                      y1={0}
                      x2={0.15}
                      y2={0}
                      stroke={lState.color}
                      strokeWidth={0.03}
                    />
                    <line
                      x1={0}
                      y1={-0.15}
                      x2={0}
                      y2={0.15}
                      stroke={lState.color}
                      strokeWidth={0.03}
                    />
                  </g>
                )}
              </g>
            );
          })}

        {/* Movement Paths */}
        {showPaths &&
          stageState.previousPositions &&
          performers.map((p) => {
            const prev = stageState.previousPositions?.[p.id];
            const curr = stageState.positions[p.id];
            if (!prev || !curr) return null;
            const dx = curr.x - prev.x;
            const dz = curr.z - prev.z;
            const dist = Math.hypot(dx, dz);
            if (dist < 0.15) return null;

            const ratio = Math.max(0, (dist - 0.5) / dist);
            const targetX = prev.x + dx * ratio;
            const targetZ = prev.z + dz * ratio;
            const dColor = stageState.dancerColors?.[p.id] || p.color;

            return (
              <g key={`path-${p.id}`} opacity={0.78} pointerEvents="none">
                <circle
                  cx={prev.x}
                  cy={prev.z}
                  r={0.14}
                  fill="none"
                  stroke={dColor}
                  strokeWidth={0.03}
                  strokeDasharray="0.08 0.06"
                />
                <line
                  x1={prev.x}
                  y1={prev.z}
                  x2={targetX}
                  y2={targetZ}
                  stroke={dColor}
                  strokeWidth={0.04}
                  strokeDasharray="0.16 0.1"
                  markerEnd="url(#move-arrow)"
                />
              </g>
            );
          })}

        {/* Performers */}
        {performers.map((p, index) => {
          const pos = stageState.positions[p.id] || { x: 0, z: 0 };
          const dColor = stageState.dancerColors?.[p.id] || p.color;
          const isSelected = selectedPerformerIds.includes(p.id);
          const isInWing = Math.abs(pos.x) > stageWidth / 2;

          return (
            <g
              key={p.id}
              transform={`translate(${pos.x}, ${pos.z}) scale(${avatarScale})`}
              className="cursor-grab active:cursor-grabbing"
              opacity={isInWing ? 0.65 : 1}
              onPointerDown={(e) => {
                e.stopPropagation();
                const isMultiKey = e.shiftKey || e.ctrlKey || e.metaKey;
                let activeIds = selectedPerformerIds;

                if (isMultiKey) {
                  selectPerformer(p.id, true);
                  return;
                } else if (!selectedPerformerIds.includes(p.id)) {
                  selectPerformer(p.id, false);
                  activeIds = [p.id];
                }

                if (!isPlaying && currentStep !== 'timeline') {
                  const startCoords = clientToStageCoords(e.clientX, e.clientY);
                  setDragStartStage(startCoords);
                  const snapshot: Record<string, Position2D> = {};
                  activeIds.forEach((id) => {
                    snapshot[id] = { ...(stageState.positions[id] || { x: 0, z: 0 }) };
                  });
                  setDragBasePositions(snapshot);
                  setDraggingType('performer');
                  setDraggingId(p.id);
                }
              }}
            >
              {isSelected && (
                <circle
                  r={0.54}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth={0.065}
                  strokeDasharray="0.14 0.08"
                />
              )}

              <polygon
                points={
                  stageInverted
                    ? '0,-0.52 -0.17,-0.3 0.17,-0.3'
                    : '0,0.52 -0.17,0.3 0.17,0.3'
                }
                fill={dColor}
              />

              <circle
                r={0.38}
                fill={dColor}
                stroke={isSelected ? '#ffffff' : '#0f172a'}
                strokeWidth={0.06}
              />

              <text
                x={0}
                y={0.11}
                textAnchor="middle"
                fill="#ffffff"
                fontSize="0.3"
                fontWeight="800"
              >
                {index + 1}
              </text>

              {showDancerNames && (
                <>
                  <rect
                    x={-0.7}
                    y={0.54}
                    width={1.4}
                    height={0.34}
                    rx={0.08}
                    fill="#020617"
                    fillOpacity={0.85}
                  />
                  <text
                    x={0}
                    y={0.77}
                    textAnchor="middle"
                    fill={isInWing ? '#94a3b8' : '#f8fafc'}
                    fontSize="0.22"
                    fontWeight="600"
                  >
                    {p.name}
                  </text>
                </>
              )}
            </g>
          );
        })}

        {/* Marquee Selection Box */}
        {draggingType === 'marquee' && (
          <rect
            x={Math.min(dragStartStage.x, marqueeEnd.x)}
            y={Math.min(dragStartStage.z, marqueeEnd.z)}
            width={Math.abs(marqueeEnd.x - dragStartStage.x)}
            height={Math.abs(marqueeEnd.z - dragStartStage.z)}
            fill="#38bdf8"
            fillOpacity={0.15}
            stroke="#38bdf8"
            strokeWidth={0.04}
            strokeDasharray="0.12 0.08"
            pointerEvents="none"
          />
        )}
      </svg>
    </div>
  );
};
