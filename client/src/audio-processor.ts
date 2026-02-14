// @ts-nocheck



function asMs(samples) {
  return (samples * 1000 / sampleRate).toFixed(1);
}

function asSamples(ms) {
  return Math.round(ms * sampleRate / 1000);
}

class MoshiProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    console.log(`[WORKLET-DEBUG] ═══ MoshiProcessor initialized ═══`);
    console.log(`[WORKLET-DEBUG]   currentFrame: ${currentFrame}, sampleRate: ${sampleRate} Hz, currentTime: ${currentTime}`);
    console.log(`[WORKLET-DEBUG]   === MOSHI WORKLET CUSTOM BUILD v5 ===`);

    // ===== WAN-SAFE BUFFER DEFAULTS (smooth > latency) =====
    // These values target ~250–400ms RTT with jitter.
    this.initialBufferSamples = asSamples(450);  // wait 450ms before first playback
    this.partialBufferSamples = asSamples(120);  // wait 120ms before resume after start

    // maxBufferSamples is EXTRA headroom beyond (initial + partial) before dropping
    this.maxBufferSamples = asSamples(1500);     // 1.5s headroom (rarely drop)

    // Adaptive growth
    this.partialBufferIncrement = asSamples(40);    // +40ms on underrun
    this.maxPartialWithIncrements = asSamples(500); // cap partial at 500ms

    this.maxBufferSamplesIncrement = asSamples(150);  // +150ms on overflow/drop
    this.maxMaxBufferWithIncrements = asSamples(2500); // cap maxBuffer at 2.5s

    // State and metrics
    this.initState();

    this.port.onmessage = (event) => {
      if (event.data?.type === "reset") {
        const beforeReset = {
          frames: this.frames.length,
          samples: this.currentSamples(),
          actualPlayed: this.actualAudioPlayed,
          totalPlayed: this.totalAudioPlayed,
          started: this.started
        };
        console.log(`[WORKLET-DEBUG] ⚠️ RESET REQUESTED`);
        console.log(`[WORKLET-DEBUG]   Before reset: frames=${beforeReset.frames}, samples=${beforeReset.samples}, actualPlayed=${beforeReset.actualPlayed.toFixed(3)}s, totalPlayed=${beforeReset.totalPlayed.toFixed(3)}s, started=${beforeReset.started}`);
        this.initState();
        console.log(`[WORKLET-DEBUG]   After reset: frames=${this.frames.length}, samples=${this.currentSamples()}, actualPlayed=${this.actualAudioPlayed.toFixed(3)}s, totalPlayed=${this.totalAudioPlayed.toFixed(3)}s, started=${this.started}`);
        return;
      }

      const frame = event.data.frame;
      if (!frame || !frame.length) {
        console.log(`[WORKLET-DEBUG] Received empty or invalid frame, ignoring`);
        return;
      }

      const beforePush = {
        frames: this.frames.length,
        samples: this.currentSamples(),
        started: this.started
      };
      this.frames.push(frame);
      const afterPush = {
        frames: this.frames.length,
        samples: this.currentSamples()
      };

      if (this.currentSamples() >= this.initialBufferSamples && !this.started) {
        console.log(`[WORKLET-DEBUG] 🎵 Starting playback: buffer=${asMs(this.currentSamples())}ms (threshold: ${asMs(this.initialBufferSamples)}ms)`);
        this.start();
      }

      if (this.pidx < 30) {
        console.log(
          `[WORKLET-DEBUG] Frame received: idx=${this.pidx++}, frameLength=${frame.length}, bufferSamples=${asMs(this.currentSamples())}ms, frameDuration=${asMs(frame.length)}ms, totalFrames=${this.frames.length}, started=${this.started}`
        );
      }

      // Only drop when buffer is VERY large (avoid drop-induced artifacts)
      if (this.currentSamples() >= this.totalMaxBufferSamples()) {
        console.log(
          this.timestamp(),
          "Dropping packets",
          asMs(this.currentSamples()),
          asMs(this.totalMaxBufferSamples())
        );

        const target = this.initialBufferSamples + this.partialBufferSamples;

        while (this.currentSamples() > target && this.frames.length) {
          const first = this.frames[0];
          let to_remove = this.currentSamples() - target;
          to_remove = Math.min(first.length - this.offsetInFirstBuffer, to_remove);

          this.offsetInFirstBuffer += to_remove;
          this.timeInStream += to_remove / sampleRate;

          if (this.offsetInFirstBuffer === first.length) {
            this.frames.shift();
            this.offsetInFirstBuffer = 0;
          }
        }

        console.log(this.timestamp(), "After drop buffer=", asMs(this.currentSamples()));

        // Increase drop threshold slowly to adapt
        this.maxBufferSamples += this.maxBufferSamplesIncrement;
        this.maxBufferSamples = Math.min(this.maxMaxBufferWithIncrements, this.maxBufferSamples);
        console.log("Increased maxBuffer to", asMs(this.maxBufferSamples));
      }

      // stats
      this.port.postMessage({
        totalAudioPlayed: this.totalAudioPlayed,
        actualAudioPlayed: this.actualAudioPlayed,
        delay: (event.data.micDuration ?? 0) - this.timeInStream,
        minDelay: this.minDelay,
        maxDelay: this.maxDelay,
      });
    };
  }

  initState() {
    const prevState = {
      frames: this.frames?.length || 0,
      actualPlayed: this.actualAudioPlayed || 0,
      totalPlayed: this.totalAudioPlayed || 0
    };
    
    this.frames = [];
    this.offsetInFirstBuffer = 0;
    this.firstOut = false;
    this.remainingPartialBufferSamples = 0;
    this.timeInStream = 0.0;
    this.resetStart();

    // Metrics
    this.totalAudioPlayed = 0.0;
    this.actualAudioPlayed = 0.0;
    this.maxDelay = 0.0;
    this.minDelay = 2000.0;

    // Debug
    this.pidx = 0;
    
    // Track last sample for smooth frame transitions (prevents resampling discontinuities)
    this.lastSample = 0.0;

    // Never shrink these (prevents oscillation / gating)
    this.partialBufferSamples = Math.max(this.partialBufferSamples || asSamples(120), asSamples(120));
    this.maxBufferSamples = Math.max(this.maxBufferSamples || asSamples(1500), asSamples(1500));
    
    console.log(`[WORKLET-DEBUG] State initialized: prevFrames=${prevState.frames}, prevActualPlayed=${prevState.actualPlayed.toFixed(3)}s, prevTotalPlayed=${prevState.totalPlayed.toFixed(3)}s`);
    console.log(`[WORKLET-DEBUG]   Buffer config: initial=${asMs(this.initialBufferSamples)}ms, partial=${asMs(this.partialBufferSamples)}ms, max=${asMs(this.maxBufferSamples)}ms`);
  }

  totalMaxBufferSamples() {
    return this.maxBufferSamples + this.partialBufferSamples + this.initialBufferSamples;
  }

  timestamp() {
    return Date.now() % 1000;
  }

  currentSamples() {
    let samples = 0;
    for (let k = 0; k < this.frames.length; k++) {
      samples += this.frames[k].length;
    }
    samples -= this.offsetInFirstBuffer;
    return samples;
  }

  resetStart() {
    this.started = false;
  }

  start() {
    this.started = true;
    this.remainingPartialBufferSamples = this.partialBufferSamples;
    this.firstOut = true;
  }

  canPlay() {
    return this.started && this.frames.length > 0 && this.remainingPartialBufferSamples <= 0;
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0][0];

    const delay = this.currentSamples() / sampleRate;
    if (this.canPlay()) {
      this.maxDelay = Math.max(this.maxDelay, delay);
      this.minDelay = Math.min(this.minDelay, delay);
    }

    // If not ready, output silence but DO NOT hard-reset constantly
    if (!this.canPlay()) {
      output.fill(0);
      if (this.actualAudioPlayed > 0) {
        this.totalAudioPlayed += output.length / sampleRate;
      }
      this.remainingPartialBufferSamples -= output.length;
      return true;
    }

    if (this.firstOut) {
      console.log(`[WORKLET-DEBUG] 🔊 Audio output started: buffer=${asMs(this.currentSamples())}ms, remainingPartial=${this.remainingPartialBufferSamples}, frames=${this.frames.length}, actualPlayed=${this.actualAudioPlayed.toFixed(3)}s`);
    }

    let out_idx = 0;

    // BULLETPROOF: Fill output from queued frames with crossfade to prevent discontinuities
    while (out_idx < output.length && this.frames.length) {
      let first = this.frames[0];
      let to_copy = Math.min(first.length - this.offsetInFirstBuffer, output.length - out_idx);
      const sourceStart = this.offsetInFirstBuffer;
      
      // Use set() for efficient copying, then clamp and validate
      output.set(first.subarray(sourceStart, sourceStart + to_copy), out_idx);
      
      // BULLETPROOF: Validate and fix ALL samples to prevent any artifacts
      for (let i = 0; i < to_copy; i++) {
        const sample = output[out_idx + i];
        if (!isFinite(sample) || isNaN(sample)) {
          // Replace NaN/Infinity with last valid sample or 0
          output[out_idx + i] = this.lastSample;
        } else if (sample > 1.0) {
          output[out_idx + i] = 1.0;
        } else if (sample < -1.0) {
          output[out_idx + i] = -1.0;
        }
      }
      
      // BULLETPROOF: Crossfade at frame boundaries to prevent discontinuities during long playback
      // This prevents clicks/pops that can accumulate into clutter over time
      // Only crossfade if we're starting a new frame (offsetInFirstBuffer was reset to 0)
      if (sourceStart === 0 && out_idx > 0 && this.frames.length > 1) {
        // We're starting a new frame - crossfade from previous frame's last sample
        const crossfadeLength = Math.min(8, to_copy); // 8 samples (~0.3ms at 24kHz)
        if (crossfadeLength > 0 && this.lastSample !== 0.0) {
          const prevLastSample = this.lastSample;
          const newFirstSample = output[out_idx];
          // Only crossfade if there's a significant difference (prevents unnecessary processing)
          if (Math.abs(prevLastSample - newFirstSample) > 0.01) {
            for (let i = 0; i < crossfadeLength; i++) {
              const fade = i / crossfadeLength;
              output[out_idx + i] = prevLastSample * (1 - fade) + newFirstSample * fade;
            }
          }
        }
      }
      
      // Store last sample for crossfade and tracking
      if (to_copy > 0) {
        this.lastSample = output[out_idx + to_copy - 1];
      }
      
      this.offsetInFirstBuffer += to_copy;
      out_idx += to_copy;

      if (this.offsetInFirstBuffer === first.length) {
        this.offsetInFirstBuffer = 0;
        this.frames.shift();
      }
    }

    // Smooth fade-in on resume to avoid clicks - apply BEFORE any other processing
    if (this.firstOut) {
      this.firstOut = false;
      // Use a smoother fade curve (ease-in) for better sound quality
      const fadeLength = Math.min(out_idx, Math.round(sampleRate * 0.005)); // 5ms fade (shorter, smoother)
      if (fadeLength > 0) {
        for (let i = 0; i < fadeLength; i++) {
          // Smooth ease-in curve: x^2 for gentler fade
          const fade = (i / fadeLength) * (i / fadeLength);
          output[i] *= fade;
        }
      }
    }

    // ===== KEY CHANGE FOR SMOOTHNESS =====
    // If we underrun, DO NOT call resetStart() (that causes gated/stuttery audio).
    // Instead, pad the rest of the buffer with silence and keep streaming.
    if (out_idx < output.length) {
      const underrunSamples = output.length - out_idx;
      console.log(`[WORKLET-DEBUG] ⚠️ BUFFER UNDERRUN: outputLength=${output.length}, out_idx=${out_idx}, underrun=${underrunSamples} samples (${asMs(underrunSamples)}ms), buffer=${asMs(this.currentSamples())}ms, frames=${this.frames.length}, actualPlayed=${this.actualAudioPlayed.toFixed(3)}s`);

      // Grow partial buffer so future playback has more headroom
      const prevPartial = this.partialBufferSamples;
      this.partialBufferSamples += this.partialBufferIncrement;
      this.partialBufferSamples = Math.min(this.partialBufferSamples, this.maxPartialWithIncrements);
      console.log(`[WORKLET-DEBUG]   Increased partial buffer: ${asMs(prevPartial)}ms -> ${asMs(this.partialBufferSamples)}ms`);

      // Smooth fade-out on the last samples to avoid clicks - only if we have samples
      if (out_idx > 0) {
        const fadeLength = Math.min(out_idx, Math.round(sampleRate * 0.005)); // 5ms fade (shorter, smoother)
        if (fadeLength > 0) {
          for (let i = 0; i < fadeLength; i++) {
            const idx = out_idx - fadeLength + i;
            if (idx >= 0) {
              // Smooth ease-out curve: (1-x)^2 for gentler fade
              const fade = 1.0 - ((fadeLength - i) / fadeLength) * ((fadeLength - i) / fadeLength);
              output[idx] *= fade;
            }
          }
        }
      }

      // pad remainder with silence
      output.fill(0, out_idx);
    }

    const outputDuration = output.length / sampleRate;
    const actualDuration = out_idx / sampleRate;
    this.totalAudioPlayed += outputDuration;
    this.actualAudioPlayed += actualDuration;
    this.timeInStream += actualDuration;
    
    // BULLETPROOF: Prevent buffer from growing too large during long responses
    // If buffer exceeds 2 seconds, aggressively trim to prevent memory issues and state accumulation
    if (this.currentSamples() > asSamples(2000)) {
      const targetBuffer = asSamples(800); // Trim to 800ms
      while (this.currentSamples() > targetBuffer && this.frames.length > 1) {
        const first = this.frames[0];
        const toRemove = Math.min(first.length - this.offsetInFirstBuffer, this.currentSamples() - targetBuffer);
        this.offsetInFirstBuffer += toRemove;
        this.timeInStream += toRemove / sampleRate;
        if (this.offsetInFirstBuffer >= first.length) {
          this.frames.shift();
          this.offsetInFirstBuffer = 0;
        }
      }
      console.log(`[WORKLET-DEBUG] ⚠️ Buffer trimmed: ${asMs(this.currentSamples())}ms (prevented overflow)`);
    }
    
    // Log periodically to track playback health (reduced frequency)
    if (Math.floor(this.totalAudioPlayed * 2) % 10 === 0 && this.totalAudioPlayed > 0.1) {
      console.log(`[WORKLET-DEBUG] Playback stats: actualPlayed=${this.actualAudioPlayed.toFixed(3)}s, totalPlayed=${this.totalAudioPlayed.toFixed(3)}s, buffer=${asMs(this.currentSamples())}ms, frames=${this.frames.length}, underrun=${outputDuration - actualDuration > 0.001 ? 'YES' : 'NO'}`);
    }

    return true;
  }
}

registerProcessor("moshi-processor", MoshiProcessor);
