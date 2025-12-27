// Moon phase calculation
// Based on simplified lunar algorithm
// Alternative to USNO API (fishing_bot4.py:595-618)

const LUNAR_MONTH = 29.530588853; // Average lunar month in days
const KNOWN_NEW_MOON = new Date(2000, 0, 6, 18, 14); // January 6, 2000, 18:14 UTC

/**
 * Calculate moon phase for a given date
 * Returns phase fraction (0-1) and phase name
 */
export function getMoonPhase(date = new Date()) {
  // Calculate days since known new moon
  const elapsed = (date - KNOWN_NEW_MOON) / (1000 * 60 * 60 * 24); // milliseconds to days

  // Calculate phase (0-1, where 0 and 1 are new moon)
  const phase = (elapsed % LUNAR_MONTH) / LUNAR_MONTH;

  // Determine phase name
  const phaseName = getPhaseName(phase);

  return {
    phase,
    phaseName,
    illumination: getIllumination(phase)
  };
}

/**
 * Get phase name from phase fraction
 */
function getPhaseName(phase) {
  // Normalize phase to 0-1
  const normalizedPhase = phase % 1;

  if (normalizedPhase < 0.0625 || normalizedPhase >= 0.9375) {
    return 'New Moon';
  } else if (normalizedPhase < 0.1875) {
    return 'Waxing Crescent';
  } else if (normalizedPhase < 0.3125) {
    return 'First Quarter';
  } else if (normalizedPhase < 0.4375) {
    return 'Waxing Gibbous';
  } else if (normalizedPhase < 0.5625) {
    return 'Full Moon';
  } else if (normalizedPhase < 0.6875) {
    return 'Waning Gibbous';
  } else if (normalizedPhase < 0.8125) {
    return 'Last Quarter';
  } else {
    return 'Waning Crescent';
  }
}

/**
 * Calculate moon illumination percentage
 */
function getIllumination(phase) {
  // Normalize phase to 0-1
  const normalizedPhase = phase % 1;

  // Calculate illumination (0-100%)
  // Peaks at 100% at full moon (0.5), drops to 0% at new moon (0 or 1)
  const illumination = (1 - Math.cos(normalizedPhase * 2 * Math.PI)) / 2;

  return Math.round(illumination * 100);
}

/**
 * Get next moon phase event
 */
export function getNextPhaseEvent(date = new Date()) {
  const currentPhase = getMoonPhase(date);
  const currentPhaseValue = currentPhase.phase;

  // Define phase milestones (0 = new, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter)
  const milestones = [
    { value: 0, name: 'New Moon' },
    { value: 0.25, name: 'First Quarter' },
    { value: 0.5, name: 'Full Moon' },
    { value: 0.75, name: 'Last Quarter' },
    { value: 1, name: 'New Moon' }
  ];

  // Find next milestone
  let nextMilestone = milestones.find(m => m.value > currentPhaseValue);

  if (!nextMilestone) {
    nextMilestone = milestones[0];
  }

  // Calculate days until next milestone
  let daysUntil;
  if (nextMilestone.value > currentPhaseValue) {
    daysUntil = (nextMilestone.value - currentPhaseValue) * LUNAR_MONTH;
  } else {
    daysUntil = (1 - currentPhaseValue + nextMilestone.value) * LUNAR_MONTH;
  }

  const nextDate = new Date(date.getTime() + daysUntil * 24 * 60 * 60 * 1000);

  return {
    phaseName: nextMilestone.name,
    date: nextDate,
    daysUntil: Math.round(daysUntil)
  };
}
