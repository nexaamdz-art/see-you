import fs from "fs";
import { execSync } from "child_process";

const sampleRate = 44100;
const durationSeconds = 5.2;
const totalSamples = Math.floor(sampleRate * durationSeconds);

// Stereo channels
const left = new Float32Array(totalSamples);
const right = new Float32Array(totalSamples);

// Bell / Chime frequencies - lush warm celestial ascending arpeggio & shimmer
// Pentatonic / Lydian magical progression (F5, A5, C6, E6, G6, A6, C7, E7, G7)
const notes = [
  { time: 0.00, freq: 523.25, pan: -0.3, amp: 0.65 }, // C5
  { time: 0.08, freq: 659.25, pan: 0.3, amp: 0.70 },  // E5
  { time: 0.16, freq: 783.99, pan: -0.4, amp: 0.75 }, // G5
  { time: 0.25, freq: 987.77, pan: 0.2, amp: 0.80 },  // B5
  { time: 0.35, freq: 1046.50, pan: -0.2, amp: 0.85 },// C6
  { time: 0.44, freq: 1318.51, pan: 0.4, amp: 0.90 }, // E6
  { time: 0.54, freq: 1567.98, pan: -0.3, amp: 0.95 },// G6
  { time: 0.65, freq: 1975.53, pan: 0.3, amp: 0.90 }, // B6
  { time: 0.76, freq: 2093.00, pan: -0.1, amp: 0.85 },// C7
  { time: 0.88, freq: 2637.02, pan: 0.2, amp: 0.80 }, // E7
  { time: 1.02, freq: 3135.96, pan: -0.2, amp: 0.75 },// G7
  { time: 1.18, freq: 2093.00, pan: 0.0, amp: 0.70 }, // C7 sustaining chord
];

// Sparkle micro-twinkles scattered across 0.2s - 2.5s
const sparkles = [];
let seed = 12345;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

for (let i = 0; i < 28; i++) {
  sparkles.push({
    time: 0.15 + rand() * 1.8,
    freq: 1800 + rand() * 3200,
    pan: (rand() * 2 - 1) * 0.8,
    amp: 0.15 + rand() * 0.25,
    decay: 0.3 + rand() * 0.6
  });
}

// Synthesize each bell note
for (const note of notes) {
  const startSample = Math.floor(note.time * sampleRate);
  const noteDuration = durationSeconds - note.time;
  const noteSamples = Math.floor(noteDuration * sampleRate);

  const leftGain = Math.cos((note.pan + 1) * Math.PI / 4) * note.amp;
  const rightGain = Math.sin((note.pan + 1) * Math.PI / 4) * note.amp;

  for (let s = 0; s < noteSamples; s++) {
    const idx = startSample + s;
    if (idx >= totalSamples) break;

    const t = s / sampleRate;

    // Bell envelope: instant soft attack, gentle exponential decay
    const attack = Math.min(1.0, t / 0.008);
    const decay = Math.exp(-t * 1.15); // rich long sustain ~3.5s
    const env = attack * decay;

    // Harmonic bell partials (fundamental + overtone 2.76 + shimmer overtone 4.07 + octave)
    const fundamental = Math.sin(2 * Math.PI * note.freq * t);
    const overtone1 = 0.35 * Math.sin(2 * Math.PI * note.freq * 2.756 * t) * Math.exp(-t * 2.5);
    const overtone2 = 0.20 * Math.sin(2 * Math.PI * note.freq * 4.07 * t) * Math.exp(-t * 4.0);
    const subOctave = 0.25 * Math.sin(2 * Math.PI * (note.freq * 0.5) * t) * Math.exp(-t * 1.0);
    const shimmer = 0.15 * Math.sin(2 * Math.PI * (note.freq * 2.0) * t) * (1 + 0.3 * Math.sin(2 * Math.PI * 6.5 * t));

    const sampleVal = (fundamental + overtone1 + overtone2 + subOctave + shimmer) * env * 0.22;

    left[idx] += sampleVal * leftGain;
    right[idx] += sampleVal * rightGain;
  }
}

// Synthesize sparkles
for (const sp of sparkles) {
  const startSample = Math.floor(sp.time * sampleRate);
  const spSamples = Math.floor(sp.decay * sampleRate);

  const leftGain = Math.cos((sp.pan + 1) * Math.PI / 4) * sp.amp;
  const rightGain = Math.sin((sp.pan + 1) * Math.PI / 4) * sp.amp;

  for (let s = 0; s < spSamples; s++) {
    const idx = startSample + s;
    if (idx >= totalSamples) break;

    const t = s / sampleRate;
    const env = Math.sin(Math.min(Math.PI, (t / sp.decay) * Math.PI)) * Math.exp(-t * 3.5);
    const val = Math.sin(2 * Math.PI * sp.freq * t) * env * 0.12;

    left[idx] += val * leftGain;
    right[idx] += val * rightGain;
  }
}

// Add warm stereo delay / reverb tail
const delayMs = 180;
const delaySamples = Math.floor((delayMs / 1000) * sampleRate);
const feedback = 0.38;
for (let i = delaySamples; i < totalSamples; i++) {
  left[i] += right[i - delaySamples] * feedback;
  right[i] += left[i - delaySamples] * feedback * 0.85;
}

// Normalize
let maxAmp = 0;
for (let i = 0; i < totalSamples; i++) {
  if (Math.abs(left[i]) > maxAmp) maxAmp = Math.abs(left[i]);
  if (Math.abs(right[i]) > maxAmp) maxAmp = Math.abs(right[i]);
}

if (maxAmp > 0) {
  const norm = 0.88 / maxAmp;
  for (let i = 0; i < totalSamples; i++) {
    left[i] *= norm;
    right[i] *= norm;
  }
}

// Generate stereo 16-bit WAV
const numChannels = 2;
const bitsPerSample = 16;
const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
const blockAlign = numChannels * (bitsPerSample / 8);
const dataSize = totalSamples * blockAlign;
const wavBuffer = Buffer.alloc(44 + dataSize);

wavBuffer.write("RIFF", 0);
wavBuffer.writeUInt32LE(36 + dataSize, 4);
wavBuffer.write("WAVE", 8);

wavBuffer.write("fmt ", 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20); // PCM
wavBuffer.writeUInt16LE(numChannels, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(byteRate, 28);
wavBuffer.writeUInt16LE(blockAlign, 32);
wavBuffer.writeUInt16LE(bitsPerSample, 34);

wavBuffer.write("data", 36);
wavBuffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < totalSamples; i++) {
  const sL = Math.max(-1, Math.min(1, left[i]));
  const int16L = sL < 0 ? sL * 0x8000 : sL * 0x7FFF;
  wavBuffer.writeInt16LE(Math.floor(int16L), 44 + i * 4);

  const sR = Math.max(-1, Math.min(1, right[i]));
  const int16R = sR < 0 ? sR * 0x8000 : sR * 0x7FFF;
  wavBuffer.writeInt16LE(Math.floor(int16R), 44 + i * 4 + 2);
}

const outWav = "/app/applet/public/assets/invitation-reveal.wav";
const outMp3 = "/app/applet/public/assets/invitation-reveal.mp3";

fs.writeFileSync(outWav, wavBuffer);
console.log(`Generated reveal WAV: ${outWav}`);

try {
  execSync(`ffmpeg -y -i "${outWav}" -codec:a libmp3lame -qscale:a 2 "${outMp3}"`);
  console.log(`Converted to reveal MP3: ${outMp3}`);
} catch (err) {
  console.error("FFmpeg error:", err.message);
}
