import { describe, expect, test } from "bun:test";
import {
  WycielenieForm,
  extractEarTag,
  mapToArimrPayload,
} from "../src/arimr";

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

const ok = {
  dataZdarzenia: daysAgo(2),
  nrMatki: "PL123456789011",
  nrZwierzecia: "PL123456789012",
  płeć: "XY" as const,
};

describe("walidacja urzędowa", () => {
  test("poprawny formularz przechodzi", () => {
    expect(WycielenieForm.safeParse(ok).success).toBe(true);
  });

  test("kolczyk: PL + 12 cyfr, nie mniej nie więcej", () => {
    for (const bad of ["PL123", "123456789012", "PL1234567890123", "PLABC45678901"]) {
      expect(WycielenieForm.safeParse({ ...ok, nrZwierzecia: bad }).success).toBe(false);
    }
  });

  test("kolczyk normalizowany: spacje i małe litery", () => {
    const r = WycielenieForm.safeParse({ ...ok, nrZwierzecia: " pl 123456789012 " });
    expect(r.success && r.data.nrZwierzecia).toBe("PL123456789012");
  });

  test("max 7 dni wstecz", () => {
    expect(WycielenieForm.safeParse({ ...ok, dataZdarzenia: daysAgo(7) }).success).toBe(true);
    expect(WycielenieForm.safeParse({ ...ok, dataZdarzenia: daysAgo(8) }).success).toBe(false);
  });

  test("data przyszła odrzucona", () => {
    expect(WycielenieForm.safeParse({ ...ok, dataZdarzenia: daysAgo(-1) }).success).toBe(false);
  });

  test("ciecię ≠ matka", () => {
    expect(
      WycielenieForm.safeParse({ ...ok, nrZwierzecia: ok.nrMatki }).success,
    ).toBe(false);
  });
});

describe("mapToArimrPayload", () => {
  test("struktura JSON urzędowego dla WYC", () => {
    expect(mapToArimrPayload(ok)).toEqual({
      kodZdarzenia: "WYC",
      nrZwierzecia: "PL123456789012",
      nrMatki: "PL123456789011",
      dataZdarzenia: ok.dataZdarzenia,
      płeć: "XY",
    });
  });
});

describe("extractEarTag (skaner)", () => {
  test("wyciąga 14-znakowy kod z szumu", () => {
    expect(extractEarTag("EAN: pl 6411 2345 6789 END")).toBe("PL641123456789");
    expect(extractEarTag("brak kodu")).toBeNull();
  });
});
