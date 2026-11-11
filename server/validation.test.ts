import assert from "node:assert/strict";
import test from "node:test";
import { validatePassage, validateReport } from "./validation.js";

const sample = {
  text: "Sabah vapur iskeleden ayrıldığında yolcuların çoğu karşı kıyıya bakıyordu. Yaşlı adam yerinden kalkmadı; biletini cebine koyup boşalan koltukları seyretti.",
  bookTitle: "Örnek kitap",
  author: "Örnek yazar",
  translator: "",
  sourceUrl: "",
  contributorName: "",
};

test("anlamlı uzunlukta pasajı ve kaynak bilgisini kabul eder", () => {
  const result = validatePassage(sample);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.contributorName, "Okur");
    assert.equal(result.value.bookTitle, "Örnek kitap");
  }
});

test("çok kısa pasajı reddeder", () => {
  const result = validatePassage({ ...sample, text: "Ayşe eve gitti." });
  assert.equal(result.ok, false);
});

test("kısa ama anlamlı pasaj uzunluğunu kabul eder", () => {
  const result = validatePassage({
    ...sample,
    text: "Talihin işlerimizin yarısına hükmettiğini, öteki yarısınıysa az çok bize bıraktığını düşünüyorum.",
  });
  assert.equal(result.ok, true);
});

test("kaynak bilgisi eksik pasajı reddeder", () => {
  const result = validatePassage({ ...sample, author: " " });
  assert.equal(result.ok, false);
});

test("okur bağlantısında yalnızca güvenli HTTPS adresini kabul eder", () => {
  const valid = validatePassage({ ...sample, sourceUrl: "https://tr.wikisource.org/wiki/Falaka" });
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.value.sourceUrl, "https://tr.wikisource.org/wiki/Falaka");
  assert.equal(validatePassage({ ...sample, sourceUrl: "javascript:alert(1)" }).ok, false);
  assert.equal(validatePassage({ ...sample, sourceUrl: "https://user:pass@example.com/text" }).ok, false);
});

test("bildirimde geçersiz pasaj kimliğini reddeder", () => {
  const result = validateReport({ passageId: "1; DROP TABLE passages", reason: "copyright" });
  assert.equal(result.ok, false);
});

test("yalnızca tanımlı bildirim nedenlerini kabul eder", () => {
  assert.equal(validateReport({ passageId: "1", reason: "copyright" }).ok, true);
  assert.equal(validateReport({ passageId: "1", reason: "secret" }).ok, false);
});
