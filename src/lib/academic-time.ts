export function brazilDateTime(value: string) {
  const parsed = new Date(value + "-03:00");
  if (
    isNaN(parsed.valueOf()) ||
    new Date(parsed.valueOf() - 3 * 3600000).toISOString().slice(0, 16) !==
      value
  )
    throw new Error("Data e hora inválidas.");
  return parsed;
}
export function localLessonTime(value: Date) {
  return new Date(value.valueOf() - 3 * 3600000).toISOString().slice(0, 16);
}
