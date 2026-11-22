export interface OrderedPassage {
  id: string;
  dailyBatch?: string | null;
}

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

// Distinct gaps between older passages keep the newest daily selection apart.
export function mixPassages<T extends OrderedPassage>(items: T[], previous?: OrderedPassage): T[] {
  const latestBatch = items.reduce((latest, item) => item.dailyBatch && item.dailyBatch > latest ? item.dailyBatch : latest, "");
  const recent = shuffled(items.filter(item => latestBatch && item.dailyBatch === latestBatch));
  const older = shuffled(items.filter(item => !latestBatch || item.dailyBatch !== latestBatch));
  if (older.length > 1 && older[0].id === previous?.id) older.push(older.shift()!);
  const gaps = Array.from({ length: older.length + 1 }, (_, index) => index)
    .filter(index => index !== 0 || !latestBatch || previous?.dailyBatch !== latestBatch);
  if (recent.length > gaps.length) {
    const result = shuffled(items);
    if (result.length > 1 && result[0].id === previous?.id) result.push(result.shift()!);
    return result;
  }
  const selected = new Set(shuffled(gaps).slice(0, recent.length));
  const result: T[] = [];
  for (let index = 0; index <= older.length; index++) {
    if (selected.has(index)) result.push(recent.pop()!);
    if (index < older.length) result.push(older[index]);
  }
  return result;
}
