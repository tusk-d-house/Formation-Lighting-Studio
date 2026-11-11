import * as THREE from 'three';
import { GoboPattern } from '../types';

const floorTextureCache = new Map<GoboPattern, THREE.CanvasTexture>();
const beamTextureCache = new Map<GoboPattern, THREE.CanvasTexture>();

/**
 * Draw the white gobo aperture pattern inside a circle of radius `R` centered at `(cx, cy)`.
 * Designed to match the Robe Pointe R-Gobo (2, 4, 6, 7) and S-Gobo (1, 3, 4, 7, 12, 14) chart.
 */
export function drawRobePointeGoboMask(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  R: number,
  gobo: GoboPattern
): void {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  switch (gobo) {
    case 'r_gobo_2': {
      // R-Gobo 2: Radial thin needles / starburst spokes (12 primary + 12 secondary fine lines)
      const count = 12;
      for (let i = 0; i < count; i++) {
        const ang = (i * 2 * Math.PI) / count;
        ctx.lineWidth = Math.max(1.2, R * 0.045);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * R * 0.24, cy + Math.sin(ang) * R * 0.24);
        ctx.lineTo(cx + Math.cos(ang) * R * 0.88, cy + Math.sin(ang) * R * 0.88);
        ctx.stroke();

        // Secondary shorter needle between main spokes
        const ang2 = ang + Math.PI / count;
        ctx.lineWidth = Math.max(1.0, R * 0.028);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang2) * R * 0.48, cy + Math.sin(ang2) * R * 0.48);
        ctx.lineTo(cx + Math.cos(ang2) * R * 0.82, cy + Math.sin(ang2) * R * 0.82);
        ctx.stroke();
      }
      break;
    }

    case 'r_gobo_4': {
      // R-Gobo 4: 12-pointed spiky star with inner geometric web
      const spikes = 12;
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        const rad = i % 2 === 0 ? R * 0.92 : R * 0.22;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Carve dark inner star web for the intricate Robe Pointe R-4 look
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      for (let i = 0; i < spikes * 2; i++) {
        const ang = (i * Math.PI) / spikes - Math.PI / 2;
        const rad = i % 2 === 0 ? R * 0.42 : R * 0.14;
        const x = cx + Math.cos(ang) * rad;
        const y = cy + Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();

      // Re-add fine bright inner star lines
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineWidth = Math.max(1, R * 0.028);
      for (let i = 0; i < spikes; i++) {
        const a1 = (i * 2 * Math.PI) / spikes;
        const a2 = (((i + 5) % spikes) * 2 * Math.PI) / spikes;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a1) * R * 0.36, cy + Math.sin(a1) * R * 0.36);
        ctx.lineTo(cx + Math.cos(a2) * R * 0.36, cy + Math.sin(a2) * R * 0.36);
        ctx.stroke();
      }
      // Dark tiny center dot
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'r_gobo_6': {
      // R-Gobo 6: Fine speckled stardust / sand breakup texture
      // Deterministic golden-angle spiral + hash jitter for even, natural distribution
      const numSpecks = 240;
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < numSpecks; i++) {
        const frac = (i + 0.5) / numSpecks;
        const rad = R * 0.88 * Math.sqrt(frac);
        const theta = i * goldenAngle + Math.sin(i * 12.9898) * 0.35;
        const x = cx + Math.cos(theta) * rad;
        const y = cy + Math.sin(theta) * rad;
        const dotR = R * (0.018 + (Math.abs(Math.cos(i * 78.233)) * 0.022));
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'r_gobo_7': {
      // R-Gobo 7: 12 thick rounded petals arranged in a ring around a dark center
      const petals = 12;
      ctx.lineWidth = Math.max(2, R * 0.125);
      for (let i = 0; i < petals; i++) {
        const ang = (i * 2 * Math.PI) / petals;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * R * 0.40, cy + Math.sin(ang) * R * 0.40);
        ctx.lineTo(cx + Math.cos(ang) * R * 0.80, cy + Math.sin(ang) * R * 0.80);
        ctx.stroke();
      }
      break;
    }

    case 's_gobo_1': {
      // S-Gobo 1: Cluster of 19 small round dots (1 center + 6 inner ring + 12 outer ring)
      const dotR = R * 0.092;
      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
      ctx.fill();

      // Inner ring (6 dots)
      for (let i = 0; i < 6; i++) {
        const ang = (i * 2 * Math.PI) / 6 + 0.15;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(ang) * R * 0.37,
          cy + Math.sin(ang) * R * 0.37,
          dotR,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }

      // Outer ring (12 dots)
      for (let i = 0; i < 12; i++) {
        const ang = (i * 2 * Math.PI) / 12;
        const rDist = i % 2 === 0 ? R * 0.72 : R * 0.67;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(ang) * rDist,
          cy + Math.sin(ang) * rDist,
          dotR * 0.92,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      break;
    }

    case 's_gobo_3': {
      // S-Gobo 3: Curved 3-pointed triskelion / concave triangle star
      const pts = 3;
      const baseRot = -Math.PI / 2 - 0.22;
      ctx.beginPath();
      for (let i = 0; i < pts; i++) {
        const a1 = baseRot + (i * 2 * Math.PI) / pts;
        const a2 = baseRot + ((i + 1) * 2 * Math.PI) / pts;
        const aMid = (a1 + a2) / 2 + 0.18;
        const x1 = cx + Math.cos(a1) * R * 0.82;
        const y1 = cy + Math.sin(a1) * R * 0.82;
        const x2 = cx + Math.cos(a2) * R * 0.82;
        const y2 = cy + Math.sin(a2) * R * 0.82;
        const cpx = cx + Math.cos(aMid) * R * 0.16;
        const cpy = cy + Math.sin(aMid) * R * 0.16;
        if (i === 0) ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo(cpx, cpy, x2, y2);
      }
      ctx.closePath();
      ctx.fill();
      break;
    }

    case 's_gobo_4': {
      // S-Gobo 4: 4 medium circles arranged in a 2x2 grid
      const holeR = R * 0.225;
      const dist = R * 0.47;
      const baseAng = Math.PI / 4 - 0.12;
      for (let i = 0; i < 4; i++) {
        const ang = baseAng + (i * Math.PI) / 2;
        ctx.beginPath();
        ctx.arc(
          cx + Math.cos(ang) * dist,
          cy + Math.sin(ang) * dist,
          holeR,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      break;
    }

    case 's_gobo_7': {
      // S-Gobo 7: Single vertical rectangular bar / slit (slightly tilted ~8° as in Robe Pointe)
      ctx.translate(cx, cy);
      ctx.rotate(0.14);
      const barW = R * 0.32;
      const barH = R * 1.48;
      ctx.fillRect(-barW / 2, -barH / 2, barW, barH);
      break;
    }

    case 's_gobo_12': {
      // S-Gobo 12: Medium-small circular beam reducer aperture
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.36, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 's_gobo_14': {
      // S-Gobo 14: Wide crisp circular aperture with distinct rim
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'none':
    default: {
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.9, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  ctx.restore();
}

/**
 * Helper to render a miniature preview of a Robe Pointe Gobo onto a UI <canvas> element.
 */
export function drawGoboPreviewToCanvas(
  canvas: HTMLCanvasElement,
  gobo: GoboPattern
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  const R = Math.min(w, h) * 0.45;

  ctx.clearRect(0, 0, w, h);

  // Dark circular wheel housing
  ctx.fillStyle = '#020617';
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();

  if (gobo === 'none') {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.75, '#e2e8f0');
    grad.addColorStop(1, '#334155');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.88, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Offscreen mask so destination-out inside drawRobePointeGoboMask doesn't erase the dark background
    const off = document.createElement('canvas');
    off.width = w;
    off.height = h;
    const offCtx = off.getContext('2d');
    if (offCtx) {
      drawRobePointeGoboMask(offCtx, cx, cy, R, gobo);
      ctx.drawImage(off, 0, 0);
    }
  }

  // Subtle rim border
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
}

/**
 * Get cached floor projection texture for the given GoboPattern.
 * Created once per pattern and reused across all lights (0 per-frame overhead).
 */
export function getGoboFloorTexture(gobo: GoboPattern = 'none'): THREE.CanvasTexture {
  const safeGobo: GoboPattern = gobo || 'none';
  const cached = floorTextureCache.get(safeGobo);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const radius = size / 2 - 6;

    if (safeGobo === 'none') {
      const baseGrad = ctx.createRadialGradient(center, center, 0, center, center, radius);
      baseGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      baseGrad.addColorStop(0.40, 'rgba(255, 255, 255, 0.88)');
      baseGrad.addColorStop(0.70, 'rgba(255, 255, 255, 0.40)');
      baseGrad.addColorStop(0.90, 'rgba(255, 255, 255, 0.12)');
      baseGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, size, size);
    } else {
      // Draw crisp gobo mask on offscreen canvas, then apply soft radial vignette at outer edge
      const maskCanvas = document.createElement('canvas');
      maskCanvas.width = size;
      maskCanvas.height = size;
      const mCtx = maskCanvas.getContext('2d');
      if (mCtx) {
        drawRobePointeGoboMask(mCtx, center, center, radius, safeGobo);
        // Subtle glow bloom around sharp edges so it looks like projected light
        ctx.save();
        ctx.filter = 'blur(3px)';
        ctx.globalAlpha = 0.55;
        ctx.drawImage(maskCanvas, 0, 0);
        ctx.restore();

        ctx.drawImage(maskCanvas, 0, 0);
      }

      // Soften only the outermost perimeter so the bounding square never shows
      ctx.globalCompositeOperation = 'destination-in';
      const edgeGrad = ctx.createRadialGradient(center, center, radius * 0.78, center, center, radius);
      edgeGrad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
      edgeGrad.addColorStop(0.92, 'rgba(255, 255, 255, 0.90)');
      edgeGrad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(0, 0, size, size);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  floorTextureCache.set(safeGobo, tex);
  return tex;
}

/**
 * Get cached volumetric 3D beam texture for the given GoboPattern.
 * When a gobo is active, longitudinal rays appear along the volumetric cone in haze.
 */
export function getGoboBeamTexture(gobo: GoboPattern = 'none'): THREE.CanvasTexture {
  const safeGobo: GoboPattern = gobo || 'none';
  const cached = beamTextureCache.get(safeGobo);
  if (cached) return cached;

  const width = 128;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // 1. Vertical falloff gradient from fixture lens (top) to floor (bottom)
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
    grad.addColorStop(0.12, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.35, 'rgba(255, 255, 255, 0.52)');
    grad.addColorStop(0.65, 'rgba(255, 255, 255, 0.24)');
    grad.addColorStop(0.85, 'rgba(255, 255, 255, 0.08)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. For patterned gobos, modulate horizontal U with longitudinal light rays
    if (safeGobo !== 'none' && safeGobo !== 's_gobo_12' && safeGobo !== 's_gobo_14') {
      ctx.globalCompositeOperation = 'destination-in';
      for (let x = 0; x < width; x++) {
        const u = x / width; // 0..1 around cone circumference
        let rayAlpha = 1.0;

        switch (safeGobo) {
          case 'r_gobo_2':
          case 'r_gobo_4':
          case 'r_gobo_7':
            // 12 radial rays around circumference
            rayAlpha = 0.22 + 0.78 * Math.pow(0.5 + 0.5 * Math.cos(u * 12 * 2 * Math.PI), 2.2);
            break;
          case 'r_gobo_6':
            // Fine shimmering stardust streaks
            rayAlpha =
              0.28 +
              0.72 *
                Math.pow(
                  0.5 + 0.5 * Math.sin(u * 28 * 2 * Math.PI + Math.cos(u * 19 * 2 * Math.PI)),
                  2.0
                );
            break;
          case 's_gobo_1':
            // Multi-dot shower rays
            rayAlpha = 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.cos(u * 10 * 2 * Math.PI), 2.0);
            break;
          case 's_gobo_3':
            // 3 wide triskelion blades
            rayAlpha = 0.20 + 0.80 * Math.pow(0.5 + 0.5 * Math.cos(u * 3 * 2 * Math.PI), 1.8);
            break;
          case 's_gobo_4':
            // 4 distinct beams
            rayAlpha = 0.18 + 0.82 * Math.pow(0.5 + 0.5 * Math.cos(u * 4 * 2 * Math.PI), 2.4);
            break;
          case 's_gobo_7':
            // 2 opposite sides of the flat slit blade
            rayAlpha = 0.18 + 0.82 * Math.pow(0.5 + 0.5 * Math.cos(u * 2 * 2 * Math.PI), 2.6);
            break;
        }

        ctx.fillStyle = `rgba(255, 255, 255, ${rayAlpha.toFixed(3)})`;
        ctx.fillRect(x, 0, 1, height);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  beamTextureCache.set(safeGobo, tex);
  return tex;
}

export function getSoftBeamTexture(): THREE.CanvasTexture {
  return getGoboBeamTexture('none');
}

export function getSoftFloorTexture(): THREE.CanvasTexture {
  return getGoboFloorTexture('none');
}
