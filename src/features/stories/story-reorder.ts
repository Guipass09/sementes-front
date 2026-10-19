export function reorderStorySteps<T extends { key: string }>(steps: T[], activeKey: string, targetKey: string): T[] {
  const from = steps.findIndex(step => step.key === activeKey);
  const to = steps.findIndex(step => step.key === targetKey);
  if (from < 0 || to < 0 || from === to) return steps;
  const next = [...steps];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
