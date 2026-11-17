import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const rootDir = process.cwd();
const iconsDir = path.join(rootDir, 'public', 'icons');
const soundsDir = path.join(rootDir, 'public', 'sounds');

// Les dossiers public/icons et public/sounds existent déjà

// ============================================================================
// 1. GÉNÉRATEUR D'ICÔNES PNG (Material Design 3 Flat - KronoTab)
// ============================================================================
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createIconPng(size) {
  const raw = Buffer.alloc(size * (size * 4 + 1));

  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const rMax = size * 0.46;
  const cornerRadius = size * 0.24;

  // SDF d'un squircle / rectangle arrondi Material 3
  function sdRoundedBox(px, py, bx, by, r) {
    const qx = Math.abs(px) - bx + r;
    const qy = Math.abs(py) - by + r;
    return (
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
      Math.min(Math.max(qx, qy), 0) -
      r
    );
  }

  // Distance d'un point à un segment
  function distToSegment(px, py, ax, ay, bx, by) {
    const pax = px - ax;
    const pay = py - ay;
    const bax = bx - ax;
    const bay = by - ay;
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
    return Math.hypot(pax - bax * h, pay - bay * h);
  }

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filtre PNG None

    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;

      const boxDist = sdRoundedBox(dx, dy, rMax, rMax, cornerRadius);
      // Anti-aliasing du bord extérieur
      const bgAlpha = Math.max(0, Math.min(1, 0.5 - boxDist));

      if (bgAlpha <= 0) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Fond Noir profond Material (#141413 -> #1C1917) avec fin liseré ambre
      const t = (x + y) / (2 * size);
      let r = Math.round(22 * (1 - t) + 15 * t);
      let g = Math.round(20 * (1 - t) + 14 * t);
      let b = Math.round(18 * (1 - t) + 13 * t);

      // Cercle extérieur Ambre (#F59E0B)
      const distCenter = Math.hypot(dx, dy);
      const ringRadius = size * 0.295;
      const ringThickness = Math.max(1.3, size * 0.068);
      const ringDist = Math.abs(distCenter - ringRadius) - ringThickness / 2;
      const ringAlpha = Math.max(0, Math.min(1, 0.65 - ringDist));

      // Coche (Checkmark) au centre du cercle en Ambre clair (#FBBF24)
      // Segment 1 : (-0.13, 0.01) -> (-0.03, 0.11)
      // Segment 2 : (-0.03, 0.11) -> (0.15, -0.09)
      const check1Dist = distToSegment(
        dx,
        dy,
        -size * 0.135,
        size * 0.01,
        -size * 0.03,
        size * 0.115
      );
      const check2Dist = distToSegment(
        dx,
        dy,
        -size * 0.03,
        size * 0.115,
        size * 0.15,
        -size * 0.095
      );
      const checkThickness = Math.max(1.35, size * 0.075);
      const checkDist = Math.min(check1Dist, check2Dist) - checkThickness / 2;
      const checkAlpha = Math.max(0, Math.min(1, 0.65 - checkDist));

      // Mélange de l'anneau en Ambre (#F59E0B : 245, 158, 11)
      if (ringAlpha > 0) {
        r = Math.round(r * (1 - ringAlpha) + 245 * ringAlpha);
        g = Math.round(g * (1 - ringAlpha) + 158 * ringAlpha);
        b = Math.round(b * (1 - ringAlpha) + 11 * ringAlpha);
      }

      // Mélange de la coche en Ambre lumineux (#FBBF24 : 251, 191, 36)
      if (checkAlpha > 0) {
        r = Math.round(r * (1 - checkAlpha) + 251 * checkAlpha);
        g = Math.round(g * (1 - checkAlpha) + 191 * checkAlpha);
        b = Math.round(b * (1 - checkAlpha) + 36 * checkAlpha);
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = Math.round(bgAlpha * 255);
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', idat),
    makeChunk('IEND', iend),
  ]);
}

for (const size of [16, 32, 48, 128]) {
  const pngBuffer = createIconPng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngBuffer);
}

// ============================================================================
// 2. GÉNÉRATEUR DE FICHIERS AUDIO (WAV PCM 16-bit 22050Hz) POUR LES TIMERS
// ============================================================================
function createWavFile(notes, sampleRate = 22050) {
  // notes: Array<{ freq: number, startSec: number, durationSec: number, type?: 'sine' | 'triangle' | 'bell', volume?: number }>
  const totalDuration =
    Math.max(...notes.map((n) => n.startSec + n.durationSec)) + 0.15;
  const numSamples = Math.floor(totalDuration * sampleRate);
  const samples = new Float32Array(numSamples);

  for (const note of notes) {
    const startIdx = Math.floor(note.startSec * sampleRate);
    const len = Math.floor(note.durationSec * sampleRate);
    const vol = note.volume ?? 0.35;

    for (let i = 0; i < len && startIdx + i < numSamples; i++) {
      const t = i / sampleRate;
      const attack = Math.min(1, t / 0.015);
      const decay = Math.exp((-3.5 * t) / note.durationSec);
      const env = attack * decay;

      let wave = 0;
      if (note.type === 'triangle') {
        wave =
          (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * note.freq * t));
      } else if (note.type === 'bell') {
        wave =
          0.65 * Math.sin(2 * Math.PI * note.freq * t) +
          0.25 * Math.sin(2 * Math.PI * note.freq * 2 * t) +
          0.1 * Math.sin(2 * Math.PI * note.freq * 3.01 * t);
      } else {
        wave = Math.sin(2 * Math.PI * note.freq * t);
      }

      samples[startIdx + i] += wave * env * vol;
    }
  }

  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(clamped * 32767), 44 + i * 2);
  }

  return buffer;
}

const soundDefinitions = {
  'chime.wav': [
    { freq: 523.25, startSec: 0.0, durationSec: 0.45, type: 'bell' },
    { freq: 659.25, startSec: 0.14, durationSec: 0.45, type: 'bell' },
    { freq: 783.99, startSec: 0.28, durationSec: 0.55, type: 'bell' },
    { freq: 1046.5, startSec: 0.42, durationSec: 0.85, type: 'bell' },
  ],
  'marimba.wav': [
    { freq: 440.0, startSec: 0.0, durationSec: 0.25, type: 'triangle' },
    { freq: 554.37, startSec: 0.12, durationSec: 0.25, type: 'triangle' },
    { freq: 659.25, startSec: 0.24, durationSec: 0.3, type: 'triangle' },
    { freq: 880.0, startSec: 0.38, durationSec: 0.6, type: 'triangle' },
  ],
  'zen.wav': [
    { freq: 432.0, startSec: 0.0, durationSec: 1.4, type: 'bell', volume: 0.4 },
    { freq: 648.0, startSec: 0.35, durationSec: 1.2, type: 'sine', volume: 0.25 },
  ],
  'digital.wav': [
    { freq: 880.0, startSec: 0.0, durationSec: 0.12, type: 'sine' },
    { freq: 880.0, startSec: 0.16, durationSec: 0.12, type: 'sine' },
    { freq: 1174.66, startSec: 0.34, durationSec: 0.35, type: 'sine' },
  ],
  'pulse.wav': [
    { freq: 587.33, startSec: 0.0, durationSec: 0.2, type: 'triangle' },
    { freq: 783.99, startSec: 0.15, durationSec: 0.2, type: 'triangle' },
    { freq: 987.77, startSec: 0.3, durationSec: 0.25, type: 'triangle' },
    { freq: 1174.66, startSec: 0.45, durationSec: 0.6, type: 'bell' },
  ],
};

for (const [filename, notes] of Object.entries(soundDefinitions)) {
  const wavBuf = createWavFile(notes);
  fs.writeFileSync(path.join(soundsDir, filename), wavBuf);
}

console.log('Generated icons and sounds successfully!');
