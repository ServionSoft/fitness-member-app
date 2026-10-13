/**
 * Helpers so member app uses coach/CRM saved prescription
 * (sets, reps, rest, weight / sets_configuration) instead of catalog defaults.
 */

function toNumberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  // Accept "20 kg", "30s", "15x", etc.
  const cleaned = String(value).replace(/[^\d.-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeSetEntry(set) {
  if (!set || typeof set !== 'object') return null;

  const reps = toNumberOrNull(set.reps ?? set.rep ?? set.Reps);
  const weight = toNumberOrNull(
    set.weight ?? set.kg ?? set.Weight ?? set.load ?? set.lbs
  );
  const rest = toNumberOrNull(
    set.rest ?? set.rest_seconds ?? set.rest_period ?? set.Rest
  );
  const time = toNumberOrNull(set.time ?? set.duration ?? set.seconds);

  // Skip empty junk objects
  if (reps == null && weight == null && rest == null && time == null) {
    return null;
  }

  return {
    reps: reps ?? null,
    weight: weight ?? 0,
    rest: rest ?? 30,
    time: time ?? null,
  };
}

function decodeSetsConfiguration(raw, depth = 0) {
  if (raw == null || depth > 3) return [];

  if (Array.isArray(raw)) {
    return raw.map(normalizeSetEntry).filter(Boolean);
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === '[]' || trimmed === 'null') return [];
    try {
      return decodeSetsConfiguration(JSON.parse(trimmed), depth + 1);
    } catch {
      return [];
    }
  }

  // Legacy object shape: { sets: 3, reps: 10 }
  if (typeof raw === 'object') {
    if (Array.isArray(raw.sets)) {
      return decodeSetsConfiguration(raw.sets, depth + 1);
    }
    const reps = toNumberOrNull(raw.reps);
    const rest = toNumberOrNull(raw.rest ?? raw.rest_seconds);
    const weight = toNumberOrNull(raw.weight);
    const setCount = toNumberOrNull(raw.sets);
    if (setCount != null && setCount > 0 && (reps != null || weight != null || rest != null)) {
      return Array.from({ length: setCount }, () => ({
        reps: reps ?? 10,
        rest: rest ?? 30,
        weight: weight ?? 0,
        time: null,
      }));
    }
  }

  return [];
}

/** Build per-set rows from top-level sets / reps / rest / weight. */
function synthesizeSetsFromTopLevel(activity) {
  const setCount = toNumberOrNull(activity?.sets);
  const reps = toNumberOrNull(activity?.reps);
  const rest =
    toNumberOrNull(activity?.rest_seconds) ??
    toNumberOrNull(activity?.rest) ??
    toNumberOrNull(activity?.rest_period);
  const weight = toNumberOrNull(activity?.weight);

  if (setCount != null && setCount > 0) {
    return Array.from({ length: setCount }, () => ({
      reps: reps ?? 10,
      rest: rest ?? 30,
      weight: weight ?? 0,
      time: null,
    }));
  }

  // Single implied set when only reps/weight/rest exist
  if (reps != null || (weight != null && weight > 0) || rest != null) {
    return [
      {
        reps: reps ?? 10,
        rest: rest ?? 30,
        weight: weight ?? 0,
        time: null,
      },
    ];
  }

  return [];
}

/**
 * Plan-level config only (never catalog exercise defaults).
 * Falls back to synthesizing from top-level sets/reps/rest/weight.
 * If top-level `sets` is higher than config length, pad using last set values.
 */
export function parseSetsConfiguration(activity) {
  if (!activity || typeof activity !== 'object') return [];

  const planCandidates = [
    activity.sets_configuration,
    activity.plan_sets_configuration,
  ];

  let fromConfig = [];
  for (const candidate of planCandidates) {
    const parsed = decodeSetsConfiguration(candidate);
    if (parsed.length > 0) {
      fromConfig = parsed;
      break;
    }
  }

  const topCount = toNumberOrNull(activity?.sets);
  if (fromConfig.length > 0) {
    if (topCount != null && topCount > fromConfig.length) {
      const last = fromConfig[fromConfig.length - 1];
      const padded = [...fromConfig];
      while (padded.length < topCount) {
        padded.push({ ...last });
      }
      return padded;
    }
    return fromConfig;
  }

  const fromTopLevel = synthesizeSetsFromTopLevel(activity);
  if (fromTopLevel.length > 0) return fromTopLevel;

  return [];
}

/** Plain JSON-safe set rows to pass across navigation (exact list ↔ details sync). */
export function serializeSetRowsForNavigation(activity) {
  const rows = getDisplaySetRows(activity);
  return rows.map((row, index) => ({
    key: row.key || `set-${index + 1}`,
    reps: row.reps,
    weight: row.weight ?? 0,
    rest: row.rest ?? 30,
    ...(row.time != null ? { time: row.time } : {}),
  }));
}

/**
 * Normalize plan fields from API activity.
 * When sets_configuration exists, it wins over top-level sets/reps/rest/weight.
 */
export function getActivityPrescription(activity) {
  if (!activity || typeof activity !== 'object') {
    return {
      sets: null,
      reps: null,
      rest_seconds: null,
      weight: null,
      sets_configuration: [],
    };
  }

  const config = parseSetsConfiguration(activity);

  if (config.length > 0) {
    const repsFromConfig = config
      .map((s) => toNumberOrNull(s?.reps))
      .find((n) => n !== null);
    const restFromConfig = config
      .map((s) => toNumberOrNull(s?.rest ?? s?.rest_seconds))
      .find((n) => n !== null);
    const weightFromConfig = config
      .map((s) => toNumberOrNull(s?.weight))
      .find((n) => n !== null && n > 0);

    return {
      sets: config.length,
      reps: repsFromConfig ?? toNumberOrNull(activity.reps),
      rest_seconds:
        restFromConfig ??
        toNumberOrNull(activity.rest_seconds) ??
        toNumberOrNull(activity.rest) ??
        toNumberOrNull(activity.rest_period),
      weight: weightFromConfig ?? toNumberOrNull(activity.weight) ?? 0,
      sets_configuration: config,
    };
  }

  return {
    sets: toNumberOrNull(activity.sets),
    reps: toNumberOrNull(activity.reps),
    rest_seconds:
      toNumberOrNull(activity.rest_seconds) ??
      toNumberOrNull(activity.rest) ??
      toNumberOrNull(activity.rest_period),
    weight: toNumberOrNull(activity.weight),
    sets_configuration: [],
  };
}

/** Rows for Activity Details / Editor UI. */
export function getDisplaySetRows(activity) {
  const prescription = getActivityPrescription(activity);
  const config = prescription.sets_configuration || [];

  if (config.length > 0) {
    return config.map((set, index) => {
      const time = toNumberOrNull(set?.time);
      const reps = toNumberOrNull(set?.reps);
      return {
        key: `set-${index + 1}`,
        reps: reps ?? (time != null ? null : prescription.reps ?? 10),
        weight: toNumberOrNull(set?.weight) ?? prescription.weight ?? 0,
        rest:
          toNumberOrNull(set?.rest ?? set?.rest_seconds) ??
          prescription.rest_seconds ??
          30,
        time,
      };
    });
  }

  return [];
}

/** Per-set config for session (1-based set index). */
export function getSetPrescription(activity, setNumber = 1) {
  const prescription = getActivityPrescription(activity);
  const config = prescription.sets_configuration;
  const idx = Math.max(0, (setNumber || 1) - 1);
  const setConfig = config[idx] || config[0] || null;

  return {
    sets: prescription.sets ?? 1,
    reps:
      toNumberOrNull(setConfig?.reps) ??
      prescription.reps ??
      10,
    rest_seconds:
      toNumberOrNull(setConfig?.rest ?? setConfig?.rest_seconds) ??
      prescription.rest_seconds ??
      60,
    weight:
      toNumberOrNull(setConfig?.weight) ??
      prescription.weight,
    time: toNumberOrNull(setConfig?.time),
  };
}

/**
 * Snapshot coach/plan prescription so catalog merges cannot overwrite it.
 */
export function extractPlanPrescription(activity) {
  const rows = getDisplaySetRows(activity);
  const prescription = getActivityPrescription(activity);
  const config =
    rows.length > 0
      ? rows.map((row) => ({
          reps: row.reps,
          weight: row.weight ?? 0,
          rest: row.rest,
          ...(row.time != null ? { time: row.time } : {}),
        }))
      : parseSetsConfiguration(activity);

  return {
    sets: config.length || prescription.sets || activity?.sets || null,
    reps: prescription.reps ?? activity?.reps ?? null,
    rest_seconds:
      prescription.rest_seconds ??
      activity?.rest_seconds ??
      activity?.rest ??
      null,
    rest:
      prescription.rest_seconds ??
      activity?.rest ??
      activity?.rest_seconds ??
      null,
    weight: prescription.weight ?? activity?.weight ?? 0,
    sets_configuration: config,
    plan_sets_configuration: config,
    personal_note:
      activity?.personal_note || activity?.notes || activity?.note || null,
  };
}

/**
 * Merge video-catalog details onto a plan activity without wiping coach values.
 * Only copies media / descriptive fields — never spreads catalog prescription.
 */
export function mergeActivityWithCatalogDetails(activity, fullDetails) {
  if (!fullDetails) return activity;
  if (!activity) return fullDetails;

  const planRx = extractPlanPrescription(activity);

  const catalogExercise = fullDetails.exercise || fullDetails.exercise_details || null;
  const safeExercise = catalogExercise
    ? {
        ...catalogExercise,
        sets_configuration: undefined,
        sets: undefined,
        reps: undefined,
        rest_period: undefined,
        rest_period_seconds: undefined,
        weight: undefined,
      }
    : activity.exercise;

  // Preserve plan row id — never let catalog exercise id replace it
  const planRowId =
    activity.workout_activity_plan_id ||
    activity.activity_plan_id ||
    activity.id;

  return {
    ...activity,
    id: planRowId,
    workout_activity_plan_id: planRowId,
    workout_id: activity.workout_id || fullDetails.workout_id || null,
    // Media / info only from catalog
    level: activity.level || fullDetails.level || fullDetails.difficulty,
    difficulty: activity.difficulty || fullDetails.difficulty || fullDetails.level,
    description: activity.description || fullDetails.description,
    equipment: activity.equipment || fullDetails.equipment,
    muscles_targeted: activity.muscles_targeted || fullDetails.muscles_targeted,
    primary_muscle_groups:
      activity.primary_muscle_groups || fullDetails.primary_muscle_groups,
    secondary_muscle_groups:
      activity.secondary_muscle_groups || fullDetails.secondary_muscle_groups,
    instructions: activity.instructions || fullDetails.instructions,
    thumbnail_url:
      activity.thumbnail_url ||
      activity.thumbnail ||
      fullDetails.thumbnail_url ||
      fullDetails.thumbnail,
    thumbnail:
      activity.thumbnail ||
      activity.thumbnail_url ||
      fullDetails.thumbnail ||
      fullDetails.thumbnail_url,
    video_link:
      activity.video_link ||
      activity.video_url ||
      fullDetails.video_link ||
      fullDetails.video_url,
    video_url:
      activity.video_url ||
      activity.video_link ||
      fullDetails.video_url ||
      fullDetails.video_link,
    video_relative_path:
      activity.video_relative_path || fullDetails.video_relative_path,
    exercise_id: activity.exercise_id ?? fullDetails.exercise_id ?? fullDetails.id,
    exercise_name:
      activity.exercise_name ||
      fullDetails.exercise_name ||
      fullDetails.name,
    exercise: safeExercise || activity.exercise,
    exercise_details: safeExercise || activity.exercise_details,
    // Frozen plan prescription (never from catalog)
    sets: planRx.sets,
    reps: planRx.reps,
    rest_seconds: planRx.rest_seconds,
    rest: planRx.rest,
    weight: planRx.weight,
    sets_configuration: planRx.sets_configuration,
    plan_sets_configuration: planRx.sets_configuration,
    personal_note: planRx.personal_note ?? activity.personal_note,
  };
}

export function formatPrescriptionLabel(activity) {
  const { sets, reps, rest_seconds, weight } = getActivityPrescription(activity);
  const parts = [];
  if (sets != null) parts.push(`${sets} sets`);
  if (reps != null) parts.push(`${reps} reps`);
  if (rest_seconds != null) parts.push(`${rest_seconds}s rest`);
  if (weight != null && weight > 0) parts.push(`${weight} lbs`);
  return parts.join(' · ');
}
