import { z } from "zod";
import type { ArimrPayload } from "./db";

/** PL + dokładnie 12 cyfr (np. PL123456789012), bez spacji. */
export const EAR_TAG_RE = /^PL\d{12}$/;

export const earTag = z
  .string()
  .trim()
  .transform((s) => s.replace(/\s+/g, "").toUpperCase())
  .refine((s) => EAR_TAG_RE.test(s), {
    message: "Numer kolczyka: PL + 12 cyfr (np. PL123456789012)",
  });

export const eventDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data w formacie YYYY-MM-DD")
  .refine((d) => {
    const then = new Date(d + "T00:00:00");
    if (Number.isNaN(then.getTime())) return false;
    const diffDays = Math.floor((Date.now() - then.getTime()) / 86_400_000);
    return diffDays >= 0 && diffDays <= 7; // max 7 dni wstecz, bez przyszłych
  }, "Zdarzenie można zgłosić max 7 dni wstecz (bez dat przyszłych)");

export const WycielenieForm = z
  .object({
    dataZdarzenia: eventDate,
    nrMatki: earTag,
    nrZwierzecia: earTag,
    płeć: z.enum(["XX", "XY"]),
  })
  .refine((v) => v.nrZwierzecia !== v.nrMatki, {
    message: "Numer cielęcia nie może być taki sam jak matki",
    path: ["nrZwierzecia"],
  });

export type WycielienieForm = z.infer<typeof WycielenieForm>;

/** Zamienia dane z formularza na oficjalny JSON urzędowy ARiMR/IRZplus. */
export function mapToArimrPayload(
  formData: WycielienieForm,
): ArimrPayload {
  return {
    kodZdarzenia: "WYC",
    nrZwierzecia: formData.nrZwierzecia,
    nrMatki: formData.nrMatki,
    dataZdarzenia: formData.dataZdarzenia,
    płeć: formData.płeć,
  };
}

/** Wyciąga 14-znakowy kod PL… z dowolnego tekstu ze skanera. */
export function extractEarTag(raw: string): string | null {
  const m = raw.toUpperCase().replace(/\s+/g, "").match(/PL\d{12}/);
  return m ? m[0] : null;
}
