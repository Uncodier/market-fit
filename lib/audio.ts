"use client";

/**
 * Plays a proprietary alarm sound for new orders using the Web Audio API.
 * This creates a modern, recognizable arpeggio without needing external audio files.
 */
export const playNewOrderAlarm = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    
    // Resume context if it's suspended (browsers often suspend until user interaction)
    if (ctx.state === 'suspended') {
      ctx.resume().catch(err => console.warn("Could not resume AudioContext:", err));
    }
    
    const playNote = (frequency: number, startTime: number, duration: number, type: OscillatorType = 'triangle') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = type;
      osc.frequency.value = frequency;
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(startTime);
      // Nice attack and exponential fade out for a chime effect
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.5, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    
    // Proprietary alarm sound (happy, attention-grabbing chime sequence)
    // Plays C6 - E6 - G6 - C7
    playNote(1046.50, now, 0.3, 'triangle'); // C6
    playNote(1318.51, now + 0.15, 0.3, 'triangle'); // E6
    playNote(1567.98, now + 0.3, 0.3, 'triangle'); // G6
    playNote(2093.00, now + 0.45, 0.8, 'triangle'); // C7 (longer fade)
    
  } catch (err) {
    console.warn("Could not play alarm sound:", err);
  }
};
