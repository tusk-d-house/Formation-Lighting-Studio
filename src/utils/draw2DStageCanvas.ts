import { InterpolatedStageState } from './interpolation';
import { FormationStore, GRID_UNIT_M } from '../store/useFormationStore';
import { LightFixture, Performer, FormationItem } from '../types';

export function draw2DStageCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  stageState: InterpolatedStageState,
  st: FormationStore
) {
  const {
    stageWidth,
    stageDepth,
    wingWidth,
    stageGridCols,
    stageGridRows,
    stageTheme,
    stageInverted,
    performers,
    lightFixtures,
    showLightBeams,
    showDancerNames,
    dancerScale,
    projectName,
    currentTime,
    duration,
    formations,
    activeFormationId,
  } = st;

  // Background clear
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, width, height);

  const totalWidthWithWings = stageWidth + wingWidth * 2;
  const padding = 1.3;
  const baseViewW = totalWidthWithWings + padding * 2;
  const baseViewH = stageDepth + padding * 2;

  // Fit stage within canvas with comfortable padding for watermarks and labels
  const availW = width - 80;
  const availH = height - 100;
  const scale = Math.min(availW / baseViewW, availH / baseViewH);

  const centerX = width / 2;
  const centerY = height / 2 + 18;

  const toX = (sx: number) => centerX + sx * scale;
  const toY = (sz: number) => centerY + sz * scale;
  const toLen = (l: number) => l * scale;

  const isHall = stageTheme === 'hall';

  // 1. Wings (下手袖・上手袖)
  ctx.save();
  ctx.fillStyle = '#060911';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = Math.max(1, toLen(0.04));
  ctx.setLineDash([toLen(0.15), toLen(0.1)]);

  // Left Wing (下手袖)
  const leftWingX = toX(-stageWidth / 2 - wingWidth);
  const wingY = toY(-stageDepth / 2);
  const wingW = toLen(wingWidth);
  const wingH = toLen(stageDepth);
  ctx.fillRect(leftWingX, wingY, wingW, wingH);
  ctx.strokeRect(leftWingX, wingY, wingW, wingH);

  // Right Wing (上手袖)
  const rightWingX = toX(stageWidth / 2);
  ctx.fillRect(rightWingX, wingY, wingW, wingH);
  ctx.strokeRect(rightWingX, wingY, wingW, wingH);
  ctx.restore();

  // Wing Labels
  ctx.save();
  ctx.fillStyle = '#64748b';
  ctx.font = `bold ${Math.max(12, toLen(0.28))}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('下手袖', toX(-stageWidth / 2 - wingWidth / 2), wingY + toLen(0.25));
  ctx.fillText('上手袖', toX(stageWidth / 2 + wingWidth / 2), wingY + toLen(0.25));
  ctx.restore();

  // 2. Back Wall (ホリゾント / 背面壁)
  ctx.save();
  ctx.fillStyle = isHall ? '#f8fafc' : '#06b6d4';
  ctx.globalAlpha = isHall ? 0.92 : 0.75;
  const backWallH = toLen(0.14);
  const wallY = stageInverted ? toY(stageDepth / 2) : toY(-stageDepth / 2) - backWallH;
  ctx.fillRect(toX(-stageWidth / 2), wallY, toLen(stageWidth), backWallH);
  ctx.restore();

  // 3. Main Stage Floor Base
  ctx.save();
  ctx.fillStyle = isHall ? '#5c3e26' : '#090d16';
  ctx.fillRect(toX(-stageWidth / 2), toY(-stageDepth / 2), toLen(stageWidth), toLen(stageDepth));
  ctx.strokeStyle = isHall ? '#b4845c' : '#38bdf8';
  ctx.lineWidth = Math.max(2, toLen(0.06));
  ctx.strokeRect(toX(-stageWidth / 2), toY(-stageDepth / 2), toLen(stageWidth), toLen(stageDepth));
  ctx.restore();

  // 4. Ambient Tint Overlay
  if (stageState.ambientIntensity > 0.05) {
    ctx.save();
    ctx.fillStyle = stageState.ambientColor || '#ffffff';
    ctx.globalAlpha = Math.min(0.28, stageState.ambientIntensity * 0.28);
    ctx.fillRect(toX(-stageWidth / 2), toY(-stageDepth / 2), toLen(stageWidth), toLen(stageDepth));
    ctx.restore();
  }

  // 5. 90cm Grid Lines & Bamiri Numbers
  const halfCols = stageGridCols / 2;
  const halfRows = stageGridRows / 2;

  // Horizontal Grid Lines
  ctx.save();
  for (let j = -Math.floor(halfRows); j <= Math.floor(halfRows); j++) {
    const sz = Number((j * GRID_UNIT_M).toFixed(2));
    const gy = toY(sz);
    ctx.beginPath();
    ctx.moveTo(toX(-stageWidth / 2), gy);
    ctx.lineTo(toX(stageWidth / 2), gy);
    if (j === 0) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.5, toLen(0.045));
      ctx.setLineDash([toLen(0.15), toLen(0.1)]);
    } else {
      ctx.strokeStyle = isHall ? '#422c1b' : '#1e293b';
      ctx.lineWidth = Math.max(1, toLen(0.025));
      ctx.setLineDash([]);
    }
    ctx.stroke();
  }
  ctx.restore();

  // Vertical Grid Lines & Numbers
  ctx.save();
  for (let i = -Math.floor(halfCols); i <= Math.floor(halfCols); i++) {
    const sx = Number((i * GRID_UNIT_M).toFixed(2));
    const gx = toX(sx);
    ctx.beginPath();
    ctx.moveTo(gx, toY(-stageDepth / 2));
    ctx.lineTo(gx, toY(stageDepth / 2));
    if (i === 0) {
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1.5, toLen(0.045));
      ctx.setLineDash([toLen(0.15), toLen(0.1)]);
    } else {
      ctx.strokeStyle = isHall ? '#422c1b' : '#1e293b';
      ctx.lineWidth = Math.max(1, toLen(0.025));
      ctx.setLineDash([]);
    }
    ctx.stroke();

    // Bamiri Number at stage front
    ctx.font = i === 0
      ? `bold ${Math.max(13, toLen(0.32))}px sans-serif`
      : `bold ${Math.max(11, toLen(0.24))}px sans-serif`;
    ctx.fillStyle = i === 0 ? '#f8fafc' : '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const bamiriY = stageInverted ? toY(-stageDepth / 2) - toLen(0.3) : toY(stageDepth / 2) + toLen(0.15);
    ctx.fillText(i === 0 ? '0' : String(Math.abs(i)), gx, bamiriY);
  }
  ctx.restore();

  // 6. Side Curtains (袖幕)
  const curtainZPositions = [-stageDepth * 0.3, 0, stageDepth * 0.3];
  ctx.save();
  curtainZPositions.forEach((cz) => {
    const cy = toY(cz - 0.08);
    const ch = toLen(0.16);
    const cw = toLen(0.55);

    ctx.fillStyle = isHall ? '#7f1d1d' : '#1e293b';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, toLen(0.02));

    // Left curtain
    const lx = toX(-stageWidth / 2 - 0.35);
    ctx.fillRect(lx, cy, cw, ch);
    ctx.strokeRect(lx, cy, cw, ch);

    // Right curtain
    const rx = toX(stageWidth / 2 - 0.2);
    ctx.fillRect(rx, cy, cw, ch);
    ctx.strokeRect(rx, cy, cw, ch);
  });
  ctx.restore();

  // 7. Labels: FRONT & BACK
  ctx.save();
  ctx.font = `bold ${Math.max(13, toLen(0.32))}px sans-serif`;
  ctx.textAlign = 'center';

  // Top Label
  ctx.fillStyle = stageInverted ? '#38bdf8' : '#64748b';
  ctx.fillText(stageInverted ? '▼ FRONT (客席) ▼' : '▲ BACK ▲', toX(0), toY(-stageDepth / 2) - toLen(0.28));

  // Bottom Label
  ctx.fillStyle = stageInverted ? '#64748b' : '#38bdf8';
  ctx.fillText(stageInverted ? '▲ BACK ▲' : '▼ FRONT (客席) ▼', toX(0), toY(stageDepth / 2) + toLen(0.65));
  ctx.restore();

  // 8. Lighting Pools
  if (showLightBeams && lightFixtures.length > 0) {
    ctx.save();
    lightFixtures.forEach((fixture: LightFixture) => {
      const lState = stageState.lights[fixture.id];
      if (!lState || !lState.enabled || lState.intensity <= 0.04) return;
      const isPin = fixture.groupId === 'pinspot';
      const radiusM = Math.max(0.55, Math.tan(lState.angle) * (isPin ? 5.0 : 3.6));
      const rPx = toLen(radiusM);

      const targetPxX = toX(lState.targetX);
      const targetPxY = toY(lState.targetZ);

      try {
        const grad = ctx.createRadialGradient(
          targetPxX,
          targetPxY,
          0,
          targetPxX,
          targetPxY,
          rPx
        );
        grad.addColorStop(0, lState.color);
        grad.addColorStop(isPin ? 0.75 : 0.55, lState.color);
        grad.addColorStop(1, 'transparent');

        ctx.globalAlpha = Math.min(0.65, lState.intensity * (isPin ? 0.32 : 0.18));
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(targetPxX, targetPxY, rPx, 0, Math.PI * 2);
        ctx.fill();

        // Outline
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = lState.color;
        ctx.lineWidth = isPin ? 1.5 : 1;
        ctx.setLineDash(isPin ? [] : [4, 4]);
        ctx.beginPath();
        ctx.arc(targetPxX, targetPxY, rPx, 0, Math.PI * 2);
        ctx.stroke();
      } catch {
        // ignore gradient parse errors
      }
    });
    ctx.restore();
  }

  // 9. Performers (ダンサー)
  const avatarScale = dancerScale || 0.72;
  const dancerRadius = toLen(0.38 * avatarScale);

  performers.forEach((p: Performer, index: number) => {
    const pos = stageState.positions[p.id] || { x: 0, z: 0 };
    const dColor = stageState.dancerColors?.[p.id] || p.color;
    const px = toX(pos.x);
    const py = toY(pos.z);
    const isInWing = Math.abs(pos.x) > stageWidth / 2;

    ctx.save();
    if (isInWing) {
      ctx.globalAlpha = 0.65;
    }

    // Direction Triangle (pointing towards FRONT /客席 side)
    const triDir = stageInverted ? -1 : 1;
    const triTipY = py + toLen(0.52 * avatarScale * triDir);
    const triBaseY = py + toLen(0.3 * avatarScale * triDir);
    const triHalfW = toLen(0.17 * avatarScale);

    ctx.fillStyle = dColor;
    ctx.beginPath();
    ctx.moveTo(px, triTipY);
    ctx.lineTo(px - triHalfW, triBaseY);
    ctx.lineTo(px + triHalfW, triBaseY);
    ctx.closePath();
    ctx.fill();

    // Dancer Circle
    ctx.beginPath();
    ctx.arc(px, py, dancerRadius, 0, Math.PI * 2);
    ctx.fillStyle = dColor;
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = Math.max(2, toLen(0.06 * avatarScale));
    ctx.stroke();

    // Dancer Number
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(11, toLen(0.3 * avatarScale))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), px, py + 1);

    // Dancer Name Tag
    if (showDancerNames && p.name) {
      const nameFontSize = Math.max(10, toLen(0.22 * avatarScale));
      ctx.font = `600 ${nameFontSize}px sans-serif`;
      const textW = ctx.measureText(p.name).width;
      const tagW = Math.max(textW + 10, toLen(1.4 * avatarScale));
      const tagH = Math.max(14, toLen(0.34 * avatarScale));
      const tagX = px - tagW / 2;
      const tagY = py + toLen(0.54 * avatarScale);

      ctx.fillStyle = 'rgba(2, 6, 23, 0.88)';
      ctx.beginPath();
      // Rounded rect pill
      const rPill = 4;
      ctx.moveTo(tagX + rPill, tagY);
      ctx.lineTo(tagX + tagW - rPill, tagY);
      ctx.quadraticCurveTo(tagX + tagW, tagY, tagX + tagW, tagY + rPill);
      ctx.lineTo(tagX + tagW, tagY + tagH - rPill);
      ctx.quadraticCurveTo(tagX + tagW, tagY + tagH, tagX + tagW - rPill, tagY + tagH);
      ctx.lineTo(tagX + rPill, tagY + tagH);
      ctx.quadraticCurveTo(tagX, tagY + tagH, tagX, tagY + tagH - rPill);
      ctx.lineTo(tagX, tagY + rPill);
      ctx.quadraticCurveTo(tagX, tagY, tagX + rPill, tagY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = isInWing ? '#94a3b8' : '#f8fafc';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.name, px, tagY + tagH / 2);
    }

    ctx.restore();
  });

  // 10. Watermark & Info Header
  const activeFormation = formations.find((f: FormationItem) => f.id === activeFormationId);
  const formationLabel = activeFormation ? ` [${activeFormation.name}]` : '';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${ms}`;
  };

  ctx.save();
  // Header bar
  ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
  ctx.fillRect(16, 16, 420, 38);
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, 420, 38);

  // Badge
  const badgeText = stageInverted ? '2D反転' : '2D';
  const badgeW = stageInverted ? 52 : 32;
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(22, 22, badgeW, 26);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 22 + badgeW / 2, 35);

  // Title and Time
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    `${projectName}${formationLabel}`,
    28 + badgeW + 8,
    29
  );

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px monospace';
  ctx.fillText(
    `${formatTime(currentTime)} / ${formatTime(duration)}`,
    28 + badgeW + 8,
    44
  );
  ctx.restore();
}
