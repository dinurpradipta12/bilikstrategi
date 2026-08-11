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
  checkin: [
    { frequency: 740, startsAt: 0, duration: 0.13, gain: 0.1, wave: 'sine' },
    { frequency: 988, startsAt: 0.1, duration: 0.16, gain: 0.12, wave: 'sine' },
    { frequency: 1319, startsAt: 0.22, duration: 0.2, gain: 0.1, wave: 'sine' },
  ],
  pause: [
    { frequency: 659, startsAt: 0, duration: 0.18, gain: 0.09, wave: 'triangle' },
    { frequency: 523, startsAt: 0.18, duration: 0.24, gain: 0.08, wave: 'triangle' },
  ],
  checkout: [
    { frequency: 988, startsAt: 0, duration: 0.13, gain: 0.1, wave: 'sine' },
    { frequency: 659, startsAt: 0.11, duration: 0.15, gain: 0.1, wave: 'sine' },
    { frequency: 440, startsAt: 0.24, duration: 0.24, gain: 0.09, wave: 'sine' },
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
