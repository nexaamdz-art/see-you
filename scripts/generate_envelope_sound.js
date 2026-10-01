import fs from "fs";
import { execSync } from "child_process";

// Audio configuration
const sampleRate = 44100;
const durationSeconds = 1.35;
const totalSamples = Math.floor(sampleRate * durationSeconds);
const buffer = new Float32Array(totalSamples);

// Pseudo-random generator with seed for reproducibility
let seed = 42;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function gaussianRandom() {
  let u = 0, v = 0;
  while (u === 0) u = random();
  while (v === 0) v = random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Biquad Filter implementation
class BiquadFilter {
  constructor(type, freq, q = 1, gain = 0) {
    this.type = type;
    this.freq = freq;
    this.q = q;
    this.gain = gain;
    this.x1 = 0; this.x2 = 0;
    this.y1 = 0; this.y2 = 0;
    this.updateCoefficients();
  }

  setFreq(freq) {
    this.freq = freq;
    this.updateCoefficients();
  }

  updateCoefficients() {
    const w0 = 2 * Math.PI * (this.freq / sampleRate);
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * this.q);

    if (this.type === "bandpass") {
      this.b0 = alpha;
      this.b1 = 0;
      this.b2 = -alpha;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosw0;
      this.a2 = 1 - alpha;
    } else if (this.type === "lowpass") {
      this.b0 = (1 - cosw0) / 2;
      this.b1 = 1 - cosw0;
      this.b2 = (1 - cosw0) / 2;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosw0;
      this.a2 = 1 - alpha;
    } else if (this.type === "highpass") {
      this.b0 = (1 + cosw0) / 2;
      this.b1 = -(1 + cosw0);
      this.b2 = (1 + cosw0) / 2;
      this.a0 = 1 + alpha;
      this.a1 = -2 * cosw0;
      this.a2 = 1 - alpha;
    }
  }

  process(sample) {
    const out = (this.b0 / this.a0) * sample +
                (this.b1 / this.a0) * this.x1 +
                (this.b2 / this.a0) * this.x2 -
                (this.a1 / this.a0) * this.y1 -
                (this.a2 / this.a0) * this.y2;
    this.x2 = this.x1;
    this.x1 = sample;
    this.y2 = this.y1;
    this.y1 = out;
    return out;
  }
}

// Generate paper friction & flap sound
// 1. Initial flap peel / crackle (0.00s - 0.22s)
// 2. Paper swoosh & friction glide (0.10s - 0.95s)
// 3. Gentle settling paper rustle (0.80s - 1.30s)

const bpFlap = new BiquadFilter("bandpass", 1600, 1.8);
const lpPaper = new BiquadFilter("lowpass", 3800, 0.8);
const bpAir = new BiquadFilter("bandpass", 950, 2.2);
const bpBody = new BiquadFilter("bandpass", 240, 2.0);

// Generate micro-crackle impulse train for crisp paper peeling
const crackleEvents = [];
for (let i = 0; i < 45; i++) {
  // dense cluster around 0.04s - 0.28s
  const time = 0.03 + Math.pow(random(), 1.7) * 0.35;
  const intensity = (0.2 + random() * 0.8) * (1 - (time - 0.03) / 0.35);
  crackleEvents.push({ time, intensity, width: 0.001 + random() * 0.003 });
}

for (let i = 0; i < totalSamples; i++) {
  const t = i / sampleRate;
  let sample = 0;

  // Layer 1: Peeling crackle impulses (paper fibers pulling apart)
  for (const c of crackleEvents) {
    const dt = t - c.time;
    if (dt >= 0 && dt < c.width) {
      const p = dt / c.width;
      const env = Math.sin(p * Math.PI) * (1 - p);
      const freq = 1800 + random() * 2200;
      sample += Math.sin(2 * Math.PI * freq * dt) * env * c.intensity * 0.45;
    }
  }

  // Layer 2: Flap friction and swoosh (air + paper rubbing)
  // Dynamic filter sweep: 800Hz -> 2400Hz -> 1100Hz
  let sweepFreq = 800;
  if (t < 0.45) {
    sweepFreq = 800 + (t / 0.45) * 1600;
  } else if (t < 1.1) {
    sweepFreq = 2400 - ((t - 0.45) / 0.65) * 1300;
  } else {
    sweepFreq = 1100;
  }
  bpFlap.setFreq(sweepFreq);

  // Envelope for the flap swoosh & sliding friction
  let frictionEnv = 0;
  if (t < 0.12) {
    frictionEnv = (t / 0.12) * 0.7;
  } else if (t < 0.55) {
    frictionEnv = 0.7 + (1 - (t - 0.12) / 0.43) * 0.3;
  } else if (t < 1.15) {
    const decayT = (t - 0.55) / 0.6;
    frictionEnv = 0.7 * Math.pow(1 - decayT, 1.8);
  } else {
    frictionEnv = 0;
  }

  // Textured noise (brownish/pinkish noise for velvety paper surface)
  const white = gaussianRandom();
  const flapNoise = bpFlap.process(white);
  const airNoise = bpAir.process(white);
  const bodyThump = bpBody.process(white);

  // Micro-granularity: rapid small amplitude variations representing paper surface texture
  const grain = 1.0 + 0.35 * Math.sin(2 * Math.PI * 45 * t + Math.sin(2 * Math.PI * 18 * t));

  sample += flapNoise * frictionEnv * 1.6 * grain;
  sample += airNoise * frictionEnv * 0.65;
  sample += bodyThump * frictionEnv * 0.45;

  // Gentle low-pass to smooth high harshness
  sample = lpPaper.process(sample);

  // Master fade in / fade out
  let masterEnv = 1;
  if (t < 0.015) {
    masterEnv = t / 0.015;
  } else if (t > durationSeconds - 0.06) {
    masterEnv = Math.max(0, (durationSeconds - t) / 0.06);
  }

  buffer[i] = sample * masterEnv;
}

// Normalize to peak around -1dB (0.89)
let maxAmp = 0;
for (let i = 0; i < totalSamples; i++) {
  const abs = Math.abs(buffer[i]);
  if (abs > maxAmp) maxAmp = abs;
}
if (maxAmp > 0) {
  const norm = 0.88 / maxAmp;
  for (let i = 0; i < totalSamples; i++) {
    buffer[i] *= norm;
  }
}

// Convert to 16-bit PCM WAV
const numChannels = 1;
const bitsPerSample = 16;
const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
const blockAlign = numChannels * (bitsPerSample / 8);
const dataSize = totalSamples * blockAlign;
const wavBuffer = Buffer.alloc(44 + dataSize);

// RIFF header
wavBuffer.write("RIFF", 0);
wavBuffer.writeUInt32LE(36 + dataSize, 4);
wavBuffer.write("WAVE", 8);

// fmt subchunk
wavBuffer.write("fmt ", 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20); // PCM
wavBuffer.writeUInt16LE(numChannels, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(byteRate, 28);
wavBuffer.writeUInt16LE(blockAlign, 32);
wavBuffer.writeUInt16LE(bitsPerSample, 34);

// data subchunk
wavBuffer.write("data", 36);
wavBuffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < totalSamples; i++) {
  const s = Math.max(-1, Math.min(1, buffer[i]));
  const int16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
  wavBuffer.writeInt16LE(Math.floor(int16), 44 + i * 2);
}

fs.mkdirSync("/app/applet/public/assets", { recursive: true });
const wavPath = "/app/applet/public/assets/envelope-open.wav";
const mp3Path = "/app/applet/public/assets/envelope-open.mp3";

fs.writeFileSync(wavPath, wavBuffer);
console.log(`Generated WAV: ${wavPath} (${wavBuffer.length} bytes)`);

// Convert to high quality MP3 with ffmpeg
try {
  execSync(`ffmpeg -y -i "${wavPath}" -codec:a libmp3lame -qscale:a 2 "${mp3Path}"`);
  console.log(`Converted to MP3: ${mp3Path}`);
} catch (err) {
  console.error("FFmpeg conversion error:", err.message);
}
