"use client";

/**
 * Shared Web Audio helpers for the new-order alarm.
 * Browsers block AudioContext until a user gesture; we unlock on interaction
 * and reuse one context so realtime callbacks can play sound afterwards.
 */

type WebAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

let sharedCtx: AudioContext | null = null;
let unlockListenersAttached = false;
let hasWarmedAudio = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  const AC =
    window.AudioContext ||
    (window as WebAudioWindow).webkitAudioContext;
  if (!AC) return null;

  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AC();
    hasWarmedAudio = false;
  }

  return sharedCtx;
}

/** Resume (and warm) the shared AudioContext after a user gesture. */
export async function unlockAudio(): Promise<boolean> {
  const ctx = getAudioContext();
  if (!ctx) return false;

  try {
    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Some browsers still need a silent buffer once during/after the gesture.
    if (ctx.state === "running" && !hasWarmedAudio) {
      const buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      hasWarmedAudio = true;
    }

    return ctx.state === "running";
  } catch (err) {
    console.warn("Could not unlock AudioContext:", err);
    return false;
  }
}

/**
 * Attach one-time-safe document listeners so the first click/key/touch
 * unlocks audio for later realtime alarms (e.g. while watching Orders).
 */
export function ensureAudioUnlockListeners(): () => void {
  if (typeof window === "undefined" || unlockListenersAttached) {
    return () => {};
  }

  unlockListenersAttached = true;

  const onInteract = () => {
    void unlockAudio();
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", onInteract, opts);
  window.addEventListener("keydown", onInteract, opts);
  window.addEventListener("touchstart", onInteract, opts);

  return () => {
    window.removeEventListener("pointerdown", onInteract, opts);
    window.removeEventListener("keydown", onInteract, opts);
    window.removeEventListener("touchstart", onInteract, opts);
    unlockListenersAttached = false;
  };
}

/**
 * Plays a proprietary alarm sound for new orders using the Web Audio API.
 * This creates a modern, recognizable arpeggio without needing external audio files.
 */
export const playNewOrderAlarm = () => {
  void playNewOrderAlarmAsync();
};

async function playNewOrderAlarmAsync() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      await ctx.resume();
    }

    // Still blocked until the user interacts with the page at least once.
    if (ctx.state !== "running") {
      console.warn(
        "Order alarm blocked: interact with the Orders page once to enable sound"
      );
      return;
    }

    const playNote = (
      frequency: number,
      startTime: number,
      duration: number,
      type: OscillatorType = "triangle"
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.value = frequency;

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      // Nice attack and exponential fade out for a chime effect
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;

    // Proprietary alarm sound (happy, attention-grabbing chime sequence)
    // Plays C6 - E6 - G6 - C7
    playNote(1046.5, now, 0.3, "triangle"); // C6
    playNote(1318.51, now + 0.15, 0.3, "triangle"); // E6
    playNote(1567.98, now + 0.3, 0.3, "triangle"); // G6
    playNote(2093.0, now + 0.45, 0.8, "triangle"); // C7 (longer fade)
  } catch (err) {
    console.warn("Could not play alarm sound:", err);
  }
}
