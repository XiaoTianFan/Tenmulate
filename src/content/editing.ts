import type { DrillDefinitionV1, DrillEventV1 } from './types';

export const materializeEvents = (drill: DrillDefinitionV1): readonly DrillEventV1[] =>
  drill.events?.length
    ? drill.events
    : drill.shotIds.map((shotId, index) => ({ id: `${drill.id}-event-${index + 1}`, shotId }));

export const createEditableCopy = (drill: DrillDefinitionV1): DrillDefinitionV1 => {
  const suffix = Math.random().toString(36).slice(2, 7);
  const id = `${drill.id.replace(/-(copy|starter)(-[a-z0-9]+)?$/, '')}-copy-${suffix}`.slice(0, 64);
  const events = materializeEvents(drill).map((event, index) => ({ ...event, id: `${id}-event-${index + 1}` }));
  return {
    ...drill,
    id,
    title: `${drill.title} copy`,
    category: 'Custom',
    events,
    shotIds: events.map((event) => event.shotId),
    defaultRepetitions: events.length,
  };
};
