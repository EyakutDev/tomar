import assert from "node:assert/strict";
import test from "node:test";
import { mixPassages, type OrderedPassage } from "./feed-order.js";

test("günlük on pasaj tüm turlarda ve tur sınırında birbirinden ayrı kalır", () => {
  const older = Array.from({ length: 200 }, (_, index) => ({ id: String(index + 1) }));
  const recent = Array.from({ length: 10 }, (_, index) => ({ id: String(index + 201), dailyBatch: "2026-11-22" }));
  const input: OrderedPassage[] = [...older, ...recent];
  let previous: OrderedPassage | undefined;
  for (let round = 0; round < 100; round++) {
    const mixed = mixPassages(input, previous);
    assert.equal(mixed.length, 210);
    assert.equal(new Set(mixed.map(item => item.id)).size, 210);
    assert.notEqual(mixed[0].id, previous?.id);
    for (const item of mixed) {
      assert.ok(!item.dailyBatch || previous?.dailyBatch !== item.dailyBatch);
      previous = item;
    }
  }
});

test("eski günlük seçki yeni günün aralarına girebilir ve giriş dizisi korunur", () => {
  const input = [
    { id: "1", dailyBatch: "2026-11-21" },
    { id: "2", dailyBatch: "2026-11-22" },
    { id: "3", dailyBatch: "2026-11-22" },
    { id: "4", dailyBatch: null },
  ];
  const before = structuredClone(input);
  for (let round = 0; round < 50; round++) {
    const result = mixPassages(input, { id: "2", dailyBatch: "2026-11-22" });
    assert.notEqual(result[0].dailyBatch, "2026-11-22");
    assert.notEqual(result[0].id, "2");
    assert.equal(result.length, input.length);
  }
  assert.deepEqual(input, before);
  assert.deepEqual(mixPassages([]), []);
  assert.deepEqual(mixPassages([{ id: "1" }]), [{ id: "1" }]);
});
