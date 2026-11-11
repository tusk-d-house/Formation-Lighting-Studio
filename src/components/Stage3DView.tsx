import React, { useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Line } from '@react-three/drei';
import * as THREE from 'three';
import { useFormationStore, GRID_UNIT_M } from '../store/useFormationStore';
import { InterpolatedStageState } from '../utils/interpolation';
import { LightFixture, LightConfig, GoboPattern } from '../types';
import { getGoboBeamTexture, getGoboFloorTexture } from '../utils/lightTextures';

interface SpotlightRigProps {
  fixture: LightFixture;
  state: LightConfig;
  showBeam: boolean;
  isSelected: boolean;
  onSelect: () => void;
}

const SpotlightRig: React.FC<SpotlightRigProps> = ({
  fixture,
  state,
  showBeam,
  isSelected,
  onSelect,
}) => {
  const isFoot =
    fixture.groupId === 'front_foot' ||
    fixture.groupId === 'back_foot' ||
    fixture.groupId === 'side_foot';
  const isSide =
    fixture.groupId === 'side_spot' || fixture.groupId === 'back_upper';
  const isPin = fixture.groupId === 'pinspot';

  const targetY = state.aimY ?? (isFoot ? 1.1 : isSide ? 0.6 : 0);

  const targetObject = useMemo(() => new THREE.Object3D(), []);
  targetObject.position.set(state.targetX, targetY, state.targetZ);
  targetObject.updateMatrixWorld();

  const mountVec = new THREE.Vector3(...fixture.mountPosition);
  const targetVec = new THREE.Vector3(state.targetX, targetY, state.targetZ);
  const dir = new THREE.Vector3().subVectors(targetVec, mountVec);
  const distance = Math.max(0.5, dir.length());
  const midPoint = new THREE.Vector3().addVectors(mountVec, targetVec).multiplyScalar(0.5);

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, -1, 0);
    q.setFromUnitVectors(up, dir.clone().normalize());
    return q;
  }, [dir.x, dir.y, dir.z]);

  const activeGobo: GoboPattern = state.gobo ?? 'none';
  const hasGobo = activeGobo !== 'none';
  const goboBeamScale = activeGobo === 's_gobo_12' ? 0.52 : activeGobo === 's_gobo_14' ? 0.88 : 1.0;

  const coneRadius = Math.max(0.24, Math.tan(state.angle) * distance * 0.55 * goboBeamScale);
  const effectiveIntensity = state.enabled ? state.intensity : 0;

  // Cached procedural gobo/soft textures (created once per gobo type, 0 dynamic GC overhead)
  const beamTexture = useMemo(() => getGoboBeamTexture(activeGobo), [activeGobo]);
  const floorTexture = useMemo(() => getGoboFloorTexture(activeGobo), [activeGobo]);

  // Compute exact floor intersection for any downward-aiming fixture
  const canProjectToFloor = !isFoot && mountVec.y > 0.25 && dir.y < -0.08;
  const floorScale = canProjectToFloor ? Math.min(2.8, Math.max(0.2, -mountVec.y / dir.y)) : 1.0;
  const floorX = canProjectToFloor ? mountVec.x + dir.x * floorScale : state.targetX;
  const floorZ = canProjectToFloor ? mountVec.z + dir.z * floorScale : state.targetZ;
  const floorRadius = Math.max(
    0.32,
    Math.tan(state.angle) * (distance * floorScale) * 0.55
  );
  const floorRotY = Math.atan2(dir.x, dir.z);

  return (
    <group>
      <primitive object={targetObject} />

      <mesh
        position={fixture.mountPosition}
        quaternion={quaternion}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
      >
        {isFoot ? (
          <boxGeometry args={[0.3, 0.14, 0.2]} />
        ) : (
          <cylinderGeometry args={[0.11, 0.18, 0.36, 14]} />
        )}
        <meshStandardMaterial
          color={isSelected ? '#ffffff' : '#334155'}
          emissive={state.enabled ? state.color : '#000000'}
          emissiveIntensity={state.enabled ? 1.1 : 0}
        />
      </mesh>

      {state.enabled && (
        <spotLight
          position={fixture.mountPosition}
          target={targetObject}
          color={state.color}
          intensity={effectiveIntensity * (isPin ? 55 : isFoot ? 24 : 32)}
          angle={state.angle * goboBeamScale}
          penumbra={hasGobo ? 0.25 : isPin ? 0.35 : 0.85}
          distance={22}
          decay={1.5}
          castShadow={isPin}
        />
      )}

      {/* Realistic Volumetric Beam: fades out completely toward floor end with no harsh cutoff edges */}
      {showBeam && effectiveIntensity > 0.04 && (
        <group position={midPoint} quaternion={quaternion}>
          {/* Main volumetric cone (with Gobo ray streaks when Gobo is active) */}
          <mesh renderOrder={2}>
            <cylinderGeometry args={[0.08 * goboBeamScale, coneRadius, distance, hasGobo ? 28 : 16, 1, true]} />
            <meshBasicMaterial
              color={state.color}
              map={beamTexture}
              transparent
              opacity={Math.min(
                hasGobo ? 0.44 : 0.32,
                effectiveIntensity * (isPin ? 0.13 : isFoot ? 0.065 : hasGobo ? 0.115 : 0.085)
              )}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
            />
          </mesh>
          {/* Subtle luminous core streak */}
          <mesh renderOrder={3}>
            <cylinderGeometry args={[0.04 * goboBeamScale, coneRadius * 0.42, distance, 14, 1, true]} />
            <meshBasicMaterial
              color="#ffffff"
              map={beamTexture}
              transparent
              opacity={Math.min(
                0.24,
                effectiveIntensity * (isPin ? 0.085 : isFoot ? 0.035 : 0.048)
              )}
              side={THREE.DoubleSide}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
            />
          </mesh>
        </group>
      )}

      {/* Floor Spotlight / Gobo Projection Pool */}
      {canProjectToFloor && effectiveIntensity > 0.04 && (
        <group
          position={[floorX, 0.016, floorZ]}
          rotation={[-Math.PI / 2, 0, floorRotY]}
        >
          <mesh renderOrder={4}>
            <planeGeometry args={[floorRadius * 2.35, floorRadius * 2.35]} />
            <meshBasicMaterial
              color={state.color}
              map={floorTexture}
              transparent
              opacity={Math.min(
                hasGobo ? 0.96 : 0.88,
                effectiveIntensity * (hasGobo ? 0.45 : isPin ? 0.36 : 0.24)
              )}
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              fog={false}
            />
          </mesh>
          {hasGobo && (
            <mesh renderOrder={5}>
              <planeGeometry args={[floorRadius * 2.3, floorRadius * 2.3]} />
              <meshBasicMaterial
                color="#ffffff"
                map={floorTexture}
                transparent
                opacity={Math.min(0.45, effectiveIntensity * 0.16)}
                depthWrite={false}
                blending={THREE.AdditiveBlending}
                fog={false}
              />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
};

interface Stage3DViewProps {
  stageState: InterpolatedStageState;
}

export const Stage3DView: React.FC<Stage3DViewProps> = ({ stageState }) => {
  const {
    stageWidth,
    stageDepth,
    wingWidth,
    stageTheme,
    stageInverted,
    groupLayouts,
    performers,
    lightFixtures,
    selectedPerformerIds,
    selectedLightId,
    showLightBeams,
    showPaths,
    showDancerNames,
    dancerScale,
    isRecordingVideo,
    selectPerformer,
    selectLight,
  } = useFormationStore();

  const controlsRef = useRef<any>(null);
  const [camPreset, setCamPreset] = useState<'front' | 'angle' | 'top'>('angle');

  const applyCameraView = (preset: 'front' | 'angle' | 'top') => {
    setCamPreset(preset);
    if (!controlsRef.current) return;
    const controls = controlsRef.current;
    if (preset === 'front') {
      controls.object.position.set(0, 2.5, 10.6);
      controls.target.set(0, 1.1, 0);
    } else if (preset === 'angle') {
      controls.object.position.set(0, 7.2, 11.2);
      controls.target.set(0, 0.5, 0);
    } else if (preset === 'top') {
      controls.object.position.set(0, 13.5, 0.01);
      controls.target.set(0, 0, 0);
    }
    controls.update();
  };

  const isHall = stageTheme === 'hall';
  const curtainColor = isHall ? '#5c3e26' : '#0b0f19';
  const curtainZPositions = [-stageDepth * 0.3, 0, stageDepth * 0.3];

  // Generate warm wood plank texture for Hall floor
  const woodFloorTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(0, 0, 512, 512);
      const plankCount = 16;
      const plankH = 512 / plankCount;
      const tones = ['#855429', '#8f5d30', '#7c4d24', '#946234'];
      for (let i = 0; i < plankCount; i++) {
        ctx.fillStyle = tones[i % tones.length];
        ctx.fillRect(0, i * plankH, 512, plankH - 1.5);
        ctx.fillStyle = '#4a2c12';
        ctx.fillRect(0, (i + 1) * plankH - 1.5, 512, 1.5);
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden">
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center justify-between pointer-events-none">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[11px] font-bold text-amber-400 flex items-center gap-1">
            <span>3D ({isHall ? 'ホール' : 'クラブハウス'})</span>
            {stageInverted && (
              <span className="text-[10px] px-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                反転中
              </span>
            )}
          </span>
          {isRecordingVideo && (
            <div className="flex items-center gap-2 pointer-events-auto">
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

        <div className="flex items-center gap-1.5 pointer-events-auto bg-slate-900/90 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => applyCameraView('angle')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              camPreset === 'angle'
                ? 'bg-sky-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            斜め俯瞰
          </button>
          <button
            onClick={() => applyCameraView('front')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              camPreset === 'front'
                ? 'bg-sky-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            客席正面
          </button>
          <button
            onClick={() => applyCameraView('top')}
            className={`px-2.5 py-1 rounded text-xs font-medium transition ${
              camPreset === 'top'
                ? 'bg-sky-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            真上
          </button>
        </div>
      </div>

      <Canvas
        dpr={[1, 1.5]}
        gl={{ preserveDrawingBuffer: true, powerPreference: 'high-performance' }}
        camera={{ position: [0, 7.2, 11.2], fov: 45 }}
        onCreated={({ gl }) => {
          gl.domElement.id = 'stage-3d-webgl-canvas';
        }}
      >
        <color attach="background" args={[isHall ? '#090706' : '#02040a']} />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.03}
          minDistance={4}
          maxDistance={32}
        />

        <ambientLight
          color={stageState.ambientColor}
          intensity={Math.max(0.08, stageState.ambientIntensity * 1.4)}
        />
        <hemisphereLight
          args={[
            isHall ? '#fffbeb' : stageState.ambientColor,
            isHall ? '#452712' : '#090d16',
            Math.max(0.18, stageState.ambientIntensity * 0.9),
          ]}
        />

        {/* 地明かり: 客席上方（手前上側）からステージ全体を照らす */}
        <directionalLight
          position={[0, 10, stageDepth / 2 + 8]}
          target-position={[0, 0, 0]}
          color={stageState.ambientColor}
          intensity={Math.max(0.1, stageState.ambientIntensity * 2.6)}
        />

        {/* Overhead Truss & Stage Architecture */}
        <group>
          {/* Back Wall / Cyclorama (ホール仕様は白壁ホリゾント、クラブ仕様はダークフレーム) */}
          <mesh
            position={[0, 3.3, stageInverted ? stageDepth / 2 + 0.15 : -stageDepth / 2 - 0.15]}
            receiveShadow
          >
            <boxGeometry args={[stageWidth + wingWidth * 2, 6.8, 0.12]} />
            <meshStandardMaterial
              color={isHall ? '#f8fafc' : '#06080f'}
              roughness={isHall ? 0.65 : 0.85}
            />
          </mesh>

          {/* Clubhouse Neon Frame Bars */}
          {!isHall && (
            <group>
              <mesh
                position={[
                  0,
                  5.8,
                  stageInverted ? stageDepth / 2 + 0.06 : -stageDepth / 2 - 0.06,
                ]}
              >
                <boxGeometry args={[stageWidth - 0.6, 0.08, 0.08]} />
                <meshBasicMaterial color="#06b6d4" />
              </mesh>
              <mesh
                position={[
                  0,
                  0.02,
                  stageInverted ? -stageDepth / 2 + 0.04 : stageDepth / 2 - 0.04,
                ]}
              >
                <boxGeometry args={[stageWidth, 0.04, 0.08]} />
                <meshBasicMaterial color="#ec4899" />
              </mesh>
            </group>
          )}

          {/* Hall Proscenium Top Wooden Header (木目プロセニアム上部) */}
          {isHall && (
            <mesh
              position={[
                0,
                6.3,
                stageInverted ? -stageDepth / 2 + 0.2 : stageDepth / 2 - 0.2,
              ]}
            >
              <boxGeometry args={[stageWidth + wingWidth * 2, 0.9, 0.18]} />
              <meshStandardMaterial color="#6b4423" roughness={0.75} />
            </mesh>
          )}

          {/* Side Curtains (袖幕 / 大黒幕) hiding the Left & Right Wings! */}
          {/* Front Wing Masking Curtains (プロセニアム袖幕) */}
          <mesh
            position={[
              -stageWidth / 2 - wingWidth / 2,
              3.2,
              stageInverted ? -stageDepth / 2 + 0.1 : stageDepth / 2 - 0.1,
            ]}
            castShadow
          >
            <boxGeometry args={[wingWidth, 6.5, 0.16]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>
          <mesh
            position={[
              stageWidth / 2 + wingWidth / 2,
              3.2,
              stageInverted ? -stageDepth / 2 + 0.1 : stageDepth / 2 - 0.1,
            ]}
            castShadow
          >
            <boxGeometry args={[wingWidth, 6.5, 0.16]} />
            <meshStandardMaterial color={curtainColor} roughness={0.92} />
          </mesh>

          {/* 3 Pairs of Stage Leg Curtains (袖幕 1〜3) along stage sides */}
          {curtainZPositions.map((cz, idx) => (
            <group key={`leg3d-${idx}`}>
              <mesh position={[-stageWidth / 2 - 0.25, 3.2, cz]} castShadow>
                <boxGeometry args={[0.65, 6.4, 0.14]} />
                <meshStandardMaterial color={curtainColor} roughness={0.9} />
              </mesh>
              <mesh position={[stageWidth / 2 + 0.25, 3.2, cz]} castShadow>
                <boxGeometry args={[0.65, 6.4, 0.14]} />
                <meshStandardMaterial color={curtainColor} roughness={0.9} />
              </mesh>
            </group>
          ))}

          {/* Overhead Lighting Trusses (automatically follow Front/Back Sus layout height & Z) */}
          <mesh
            position={[
              0,
              groupLayouts?.front_sus?.height ?? 6.5,
              groupLayouts?.front_sus?.offsetZ ?? 1.8,
            ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.05, 0.05, stageWidth, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh
            position={[
              0,
              groupLayouts?.back_sus?.height ?? 6.5,
              groupLayouts?.back_sus?.offsetZ ?? -2.5,
            ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.05, 0.05, stageWidth, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh
            position={[
              0,
              groupLayouts?.back_upper?.height ?? 2.2,
              groupLayouts?.back_upper?.offsetZ ?? -stageDepth / 2 + 0.2,
            ]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.04, 0.04, stageWidth - 1.2, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>

        {/* Main Stage Deck Platform (Hall = Wood Floor, Clubhouse = Dark Floor) */}
        <mesh position={[0, -0.2, 0]} receiveShadow>
          <boxGeometry args={[stageWidth, 0.4, stageDepth]} />
          <meshStandardMaterial
            key={isHall ? 'hall-wood' : 'club-dark'}
            map={isHall ? woodFloorTexture : null}
            color={isHall ? '#b57c4a' : '#090d16'}
            roughness={isHall ? 0.55 : 0.28}
            metalness={isHall ? 0.05 : 0.35}
          />
        </mesh>

        {/* Left & Right Wing Floors (ステージ袖の床) */}
        <mesh position={[-stageWidth / 2 - wingWidth / 2, -0.21, 0]}>
          <boxGeometry args={[wingWidth, 0.38, stageDepth]} />
          <meshStandardMaterial
            color={isHall ? '#3d2614' : '#05070c'}
            roughness={0.85}
          />
        </mesh>
        <mesh position={[stageWidth / 2 + wingWidth / 2, -0.21, 0]}>
          <boxGeometry args={[wingWidth, 0.38, stageDepth]} />
          <meshStandardMaterial
            color={isHall ? '#3d2614' : '#05070c'}
            roughness={0.85}
          />
        </mesh>

        {/* 90cm (0.9m) Stage Grid */}
        <Grid
          position={[0, 0.01, 0]}
          args={[stageWidth, stageDepth]}
          cellSize={GRID_UNIT_M}
          cellThickness={0.6}
          cellColor={isHall ? '#5c3a1e' : '#1e293b'}
          sectionSize={GRID_UNIT_M * 2}
          sectionThickness={1}
          sectionColor={isHall ? '#3d2410' : '#334155'}
          fadeDistance={65}
        />

        {/* All Stage Light Fixtures */}
        {lightFixtures.map((fixture) => {
          const lState = stageState.lights[fixture.id];
          if (!lState) return null;
          return (
            <SpotlightRig
              key={fixture.id}
              fixture={fixture}
              state={lState}
              showBeam={showLightBeams}
              isSelected={selectedLightId === fixture.id}
              onSelect={() => selectLight(fixture.id)}
            />
          );
        })}

        {/* 3D Movement Path Lines */}
        {showPaths &&
          stageState.previousPositions &&
          performers.map((p) => {
            const prev = stageState.previousPositions?.[p.id];
            const curr = stageState.positions[p.id];
            if (!prev || !curr) return null;
            if (Math.hypot(curr.x - prev.x, curr.z - prev.z) < 0.15) return null;
            const dColor = stageState.dancerColors?.[p.id] || p.color;
            return (
              <Line
                key={`line3d-${p.id}`}
                points={[
                  [prev.x, 0.05, prev.z],
                  [curr.x, 0.05, curr.z],
                ]}
                color={dColor}
                lineWidth={2}
                dashed
                dashSize={0.25}
                gapSize={0.15}
              />
            );
          })}

        {/* Performers (Dimmed & masked when waiting in Stage Wings!) */}
        {performers.map((p, index) => {
          const pos = stageState.positions[p.id] || { x: 0, z: 0 };
          const dColor = stageState.dancerColors?.[p.id] || p.color;
          const isSelected = selectedPerformerIds.includes(p.id);
          const isInWing = Math.abs(pos.x) > stageWidth / 2;
          const scale3D = dancerScale || 0.72;

          return (
            <group
              key={p.id}
              position={[pos.x, 0, pos.z]}
              scale={[scale3D, scale3D, scale3D]}
              onClick={(e) => {
                e.stopPropagation();
                selectPerformer(p.id, e.shiftKey || e.ctrlKey || e.metaKey);
              }}
            >
              {isSelected && (
                <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <ringGeometry args={[0.45, 0.55, 32]} />
                  <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
                </mesh>
              )}

              <mesh position={[0, 0.65, 0]} castShadow={!isInWing} receiveShadow>
                <cylinderGeometry args={[0.23, 0.28, 1.25, 24]} />
                <meshStandardMaterial
                  color={isInWing ? '#1e293b' : dColor}
                  roughness={0.35}
                  metalness={0.1}
                  transparent={isInWing}
                  opacity={isInWing ? 0.35 : 1}
                />
              </mesh>

              <mesh position={[0, 1.52, 0]} castShadow={!isInWing} receiveShadow>
                <sphereGeometry args={[0.23, 24, 24]} />
                <meshStandardMaterial
                  color={isInWing ? '#1e293b' : dColor}
                  roughness={0.3}
                  metalness={0.1}
                  transparent={isInWing}
                  opacity={isInWing ? 0.35 : 1}
                />
              </mesh>

              {!isInWing && showDancerNames && (
                <>
                  {showDancerNames && (
                    <Html position={[0, 2.05, 0]} center distanceFactor={12}>
                      <div
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap shadow border ${
                          isSelected
                            ? 'bg-sky-400 text-slate-950 border-white'
                            : 'bg-slate-900/90 text-white border-slate-700'
                        }`}
                      >
                        {index + 1}. {p.name}
                      </div>
                    </Html>
                  )}
                </>
              )}
            </group>
          );
        })}
      </Canvas>
    </div>
  );
};
