import fs from 'node:fs';

const sampleRate = 44100;
const duration = 0.95; // seconds
const numSamples = Math.floor(sampleRate * duration);
const buffer = new Int16Array(numSamples);

// Simple pseudo-random generator with seed
let seed = 42;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

// Lowpass / bandpass filter implementation
function createBiquad(type, freq, q, sr) {
  const w0 = 2 * Math.PI * freq / sr;
  const alpha = Math.sin(w0) / (2 * q);
  const cosw0 = Math.cos(w0);

  let b0, b1, b2, a0, a1, a2;
  if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cosw0) / 2;
    b1 = -(1 + cosw0);
    b2 = (1 + cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  } else { // lowpass
    b0 = (1 - cosw0) / 2;
    b1 = 1 - cosw0;
    b2 = (1 - cosw0) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cosw0;
    a2 = 1 - alpha;
  }

  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return function process(x) {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
    return y;
  };
}

const rawSamples = new Float32Array(numSamples);

// Layer 1: Flap release pop & peel (0.0s to 0.25s)
const peelFilter = createBiquad('bandpass', 2400, 2.0, sampleRate);
const peelFilter2 = createBiquad('highpass', 1500, 1.0, sampleRate);

// Layer 2: Paper friction slide / swish (0.05s to 0.75s)
const frictionFilter1 = createBiquad('bandpass', 1800, 1.8, sampleRate);
const frictionFilter2 = createBiquad('bandpass', 3600, 2.5, sampleRate);
const bodyFilter = createBiquad('lowpass', 600, 1.2, sampleRate);

// Layer 3: Paper crinkle transients
const crinkleFilter = createBiquad('bandpass', 4800, 3.0, sampleRate);

for (let i = 0; i < numSamples; i++) {
  const t = i / sampleRate;
  const whiteNoise = (random() * 2 - 1);
  
  // Flap peel/creak transient at start (t = 0.02 to 0.22)
  let peel = 0;
  if (t >= 0.01 && t < 0.22) {
    const pt = (t - 0.01) / 0.21;
    const peelEnv = Math.pow(Math.sin(pt * Math.PI), 0.7);
    // Micro-pops of glue/paper fibers unsticking
    const pop = (random() > 0.94 ? (random() * 2 - 1) * 3 : 0);
    peel = peelFilter(whiteNoise + pop) * peelEnv * 0.9;
    // Add subtle low body 'pop'
    const lowThump = Math.sin(2 * Math.PI * 140 * (1 - pt * 0.5) * t) * Math.exp(-pt * 18);
    peel += lowThump * 0.45;
  }

  // Paper friction rubbing / sliding (t = 0.08 to 0.85)
  let friction = 0;
  if (t >= 0.05 && t < 0.85) {
    const ft = (t - 0.05) / 0.80;
    // Swell up then smooth decay
    const fEnv = Math.pow(Math.sin(ft * Math.PI), 0.85);
    // Flutter modulation (uneven paper grain friction)
    const grainMod = 1 + 0.35 * Math.sin(2 * Math.PI * 45 * t) + 0.25 * Math.cos(2 * Math.PI * 110 * t);
    
    const f1 = frictionFilter1(whiteNoise);
    const f2 = frictionFilter2(whiteNoise);
    const fb = bodyFilter(whiteNoise);

    friction = (f1 * 0.6 + f2 * 0.5 + fb * 0.25) * fEnv * grainMod * 0.85;
  }

  // Crinkle texture
  let crinkle = 0;
  if (t >= 0.1 && t < 0.6) {
    const ct = (t - 0.1) / 0.5;
    const cEnv = Math.sin(ct * Math.PI);
    if (random() > 0.96) {
      crinkle = crinkleFilter((random() * 2 - 1) * 2.5) * cEnv * 0.5;
    }
  }

  rawSamples[i] = peel * 0.75 + friction * 0.85 + crinkle * 0.4;
}

// Normalize samples
let maxAmp = 0;
for (let i = 0; i < numSamples; i++) {
  const abs = Math.abs(rawSamples[i]);
  if (abs > maxAmp) maxAmp = abs;
}

const targetPeak = 0.88;
const scale = maxAmp > 0 ? (targetPeak / maxAmp) : 1;

for (let i = 0; i < numSamples; i++) {
  const s = Math.max(-1, Math.min(1, rawSamples[i] * scale));
  buffer[i] = Math.floor(s < 0 ? s * 32768 : s * 32767);
}

// Construct WAV buffer
const byteLength = numSamples * 2;
const wavHeader = Buffer.alloc(44);

wavHeader.write('RIFF', 0);
wavHeader.writeUInt32LE(36 + byteLength, 4);
wavHeader.write('WAVE', 8);
wavHeader.write('fmt ', 12);
wavHeader.writeUInt32LE(16, 16); // SubChunk1Size (16 for PCM)
wavHeader.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
wavHeader.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
wavHeader.writeUInt32LE(sampleRate, 24); // SampleRate
wavHeader.writeUInt32LE(sampleRate * 2, 28); // ByteRate
wavHeader.writeUInt16LE(2, 32);  // BlockAlign
wavHeader.writeUInt16LE(16, 34); // BitsPerSample
wavHeader.write('data', 36);
wavHeader.writeUInt32LE(byteLength, 40);

const pcmBuffer = Buffer.from(buffer.buffer);
const finalWav = Buffer.concat([wavHeader, pcmBuffer]);

// Write to both .wav and .mp3 names in public/assets
fs.writeFileSync('public/assets/envelope-open.wav', finalWav);
// Modern browsers also play WAV data even if named .mp3 or we can point to .wav
fs.writeFileSync('public/assets/envelope-open.mp3', finalWav);

console.log('Successfully generated envelope-open.wav and envelope-open.mp3! Size:', finalWav.length);
