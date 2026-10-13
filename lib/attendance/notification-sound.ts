export type AttendanceSoundType = 'checkin' | 'pause' | 'checkout';

let attendanceAudioContext: AudioContext | null = null;

type Tone = {
  frequency: number;
  startsAt: number;
  duration: number;
  gain: number;
  wave: OscillatorType;
};

const SOUND_PATTERNS: Record<AttendanceSoundType, Tone[]> = {
  // Warm, rising major arpeggio: a friendly "welcome in" cue.
  checkin: [
    { frequency: 523.25, startsAt: 0, duration: 0.26, gain: 0.07, wave: 'sine' },
    { frequency: 659.25, startsAt: 0.11, duration: 0.3, gain: 0.065, wave: 'sine' },
    { frequency: 783.99, startsAt: 0.23, duration: 0.36, gain: 0.06, wave: 'triangle' },
  ],
  // Soft, descending tones: slower and calmer for break time.
  pause: [
    { frequency: 587.33, startsAt: 0, duration: 0.38, gain: 0.055, wave: 'sine' },
    { frequency: 493.88, startsAt: 0.18, duration: 0.46, gain: 0.05, wave: 'sine' },
    { frequency: 392, startsAt: 0.38, duration: 0.52, gain: 0.042, wave: 'sine' },
  ],
  // Bright, sparkling rise: an upbeat and fresh end-of-day cue.
  checkout: [
    { frequency: 659.25, startsAt: 0, duration: 0.16, gain: 0.06, wave: 'triangle' },
    { frequency: 783.99, startsAt: 0.08, duration: 0.18, gain: 0.065, wave: 'triangle' },
    { frequency: 1046.5, startsAt: 0.17, duration: 0.28, gain: 0.07, wave: 'sine' },
    { frequency: 1318.51, startsAt: 0.3, duration: 0.22, gain: 0.045, wave: 'sine' },
  ],
};

function getAttendanceAudioContext() {
  if (typeof window === 'undefined') return null;
  if (attendanceAudioContext?.state === 'closed') attendanceAudioContext = null;
  if (attendanceAudioContext) return attendanceAudioContext;

  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    attendanceAudioContext = new AudioContextConstructor();
    return attendanceAudioContext;
  } catch {
    return null;
  }
}

/** Call during a user gesture so later realtime events can produce audio. */
export function unlockAttendanceNotificationSound() {
  const context = getAttendanceAudioContext();
  if (context?.state === 'suspended') void context.resume().catch(() => undefined);
}

function playPattern(context: AudioContext, type: AttendanceSoundType) {
  const now = context.currentTime + 0.01;

  SOUND_PATTERNS[type].forEach((tone) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startsAt = now + tone.startsAt;
    const endsAt = startsAt + tone.duration;

    oscillator.type = tone.wave;
    oscillator.frequency.setValueAtTime(tone.frequency, startsAt);
    gain.gain.setValueAtTime(0.0001, startsAt);
    gain.gain.exponentialRampToValueAtTime(tone.gain, startsAt + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startsAt);
    oscillator.stop(endsAt + 0.02);
  });
}

export function playAttendanceNotificationSound(type: AttendanceSoundType) {
  const context = getAttendanceAudioContext();
  if (!context) return;

  if (context.state === 'suspended') {
    void context.resume()
      .then(() => {
        if (context.state === 'running') playPattern(context, type);
      })
      .catch(() => undefined);
    return;
  }

  try {
    playPattern(context, type);
  } catch {
    // Sound is an enhancement; unavailable audio must never interrupt attendance.
  }
}
