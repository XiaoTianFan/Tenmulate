import { SHOT_BY_ID } from './bundled';
import type { DrillDefinitionV1, DrillEventV1, SessionCategory } from './types';

export type ValidationResult = Readonly<{
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
}>;

const categories: readonly SessionCategory[] = [
  'Quick Rally',
  'Return Practice',
  'Tactical Pattern',
  'Serve & Volley',
  'Net & Overhead',
  'Custom',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validateEvent = (value: unknown, index: number, errors: string[]): value is DrillEventV1 => {
  if (!isRecord(value)) {
    errors.push(`Event ${index + 1} must be an object.`);
    return false;
  }
  if (typeof value.id !== 'string' || !value.id.trim()) errors.push(`Event ${index + 1} needs an id.`);
  if (typeof value.shotId !== 'string' || !SHOT_BY_ID.has(value.shotId)) errors.push(`Event ${index + 1} references an unknown shot.`);
  if (value.paceKmh !== undefined && (typeof value.paceKmh !== 'number' || value.paceKmh < 20 || value.paceKmh > 260)) errors.push(`Event ${index + 1} pace is outside 20–260 km/h.`);
  if (value.target !== undefined) {
    if (!isRecord(value.target) || typeof value.target.x !== 'number' || typeof value.target.z !== 'number') errors.push(`Event ${index + 1} target is invalid.`);
    else if (Math.abs(value.target.x) > 4.115 || value.target.z >= 0 || value.target.z < -11.885) errors.push(`Event ${index + 1} target is outside the near singles court.`);
  }
  return true;
};

export const validateDrill = (value: unknown): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ['Drill must be a JSON object.'], warnings };
  if (value.schemaVersion !== 1) errors.push('Only schemaVersion 1 is supported.');
  if (typeof value.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(value.id)) errors.push('Drill id must be 2–64 lowercase letters, numbers, or hyphens.');
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 100) errors.push('Title must contain 1–100 characters.');
  if (typeof value.description !== 'string' || value.description.length > 400) errors.push('Description must be 400 characters or fewer.');
  if (typeof value.category !== 'string' || !categories.includes(value.category as SessionCategory)) errors.push('Category is not supported.');
  if (!Array.isArray(value.shotIds) || value.shotIds.length === 0 || value.shotIds.some((id) => typeof id !== 'string' || !SHOT_BY_ID.has(id))) errors.push('shotIds must contain known bundled shot ids.');
  if (value.events !== undefined) {
    if (!Array.isArray(value.events) || value.events.length === 0 || value.events.length > 200) errors.push('events must contain 1–200 items.');
    else value.events.forEach((event, index) => validateEvent(event, index, errors));
  }
  if (typeof value.defaultInterval !== 'number' || value.defaultInterval < 1 || value.defaultInterval > 30) errors.push('defaultInterval must be between 1 and 30 seconds.');
  if (typeof value.defaultRepetitions !== 'number' || !Number.isInteger(value.defaultRepetitions) || value.defaultRepetitions < 1 || value.defaultRepetitions > 200) errors.push('defaultRepetitions must be an integer from 1 to 200.');
  const serialized = JSON.stringify(value);
  if (/https?:\/\//i.test(serialized)) errors.push('Remote URLs are not allowed in drill JSON.');
  if (Array.isArray(value.events) && value.events.length > 80) warnings.push('Large drills may be difficult to edit on smaller screens.');
  return { valid: errors.length === 0, errors, warnings };
};

export const parseDrillJson = (source: string): DrillDefinitionV1 => {
  if (source.length > 250_000) throw new Error('Drill JSON exceeds the 250 KB import limit.');
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  const result = validateDrill(parsed);
  if (!result.valid) throw new Error(result.errors.join(' '));
  return parsed as DrillDefinitionV1;
};

export const downloadDrill = (drill: DrillDefinitionV1): void => {
  const blob = new Blob([JSON.stringify(drill, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${drill.id}.tenmulate.json`;
  anchor.click();
  URL.revokeObjectURL(url);
};
