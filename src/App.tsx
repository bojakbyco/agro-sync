import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { db, type ArimrPayload, type SyncDoc } from "./db";
import {
  WycielenieForm,
  extractEarTag,
  mapToArimrPayload,
  type WycielienieForm,
} from "./arimr";
import { Scanner } from "./Scanner";

/* ---------- Mock API IRZplus ---------- */

async function syncWithIRZPlus(payload: ArimrPayload): Promise<{ refNo: string }> {
  // TU: realne API ARiMR/IRZplus. Mock — opóźnienie + numer referencyjny.
  await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
  if (payload.nrZwierzecia === "PL000000000000") {
    throw new Error("IRZplus: odrzucono — nieznany numer kolczyka");
  }
  const refNo = `IRZ-${Date.now().toString(36).toUpperCase()}`;
  return { refNo };
}

/* ---------- Synchronizacja kolejki ---------- */

let syncing = false;

export async function flushQueue(onDone?: () => void): Promise<number> {
  if (syncing || !navigator.onLine) return 0;
  syncing = true;
  let sent = 0;
  try {
    const pending = await db.syncQueue.where("status").equals("pending").toArray();
    for (const doc of pending) {
      try {
        const { refNo } = await syncWithIRZPlus(doc.payload);
        await db.syncQueue.update(doc.id!, {
          status: "sent",
          sentAt: Date.now(),
          refNo,
          error: undefined,
        });
        sent++;
      } catch (err) {
        await db.syncQueue.update(doc.id!, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  } finally {
    syncing = false;
    onDone?.();
  }
  return sent;
}

/* ---------- Formularz WYC ---------- */

const todayISO = () => new Date().toISOString().slice(0, 10);

function WycielienieFormView({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [form, setForm] = useState<WycielienieForm>({
    dataZdarzenia: todayISO(),
    nrMatki: "",
    nrZwierzecia: "",
    płeć: "XX",
  });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [scanTarget, setScanTarget] = useState<"nrMatki" | "nrZwierzecia" | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parsed = WycielenieForm.safeParse(form);
  const fieldErr = (path: string): string | undefined => {
    if (!touched[path] && !saveError) return undefined;
    const issue = parsed.error?.issues.find((i) => i.path[0] === path);
    return issue?.message;
  };

  const set = (patch: Partial<WycielienieForm>) =>
    setForm((f) => ({ ...f, ...patch }));

  const handleScan = useCallback(
    (raw: string) => {
      const tag = extractEarTag(raw) ?? raw.trim();
      setForm((f) =>
        scanTarget
          ? { ...f, [scanTarget]: tag }
          : { ...f, nrZwierzecia: tag },
      );
      setScanTarget(null);
    },
    [scanTarget],
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ nrMatki: true, nrZwierzecia: true, dataZdarzenia: true, płeć: true });
    if (!parsed.success) {
      setSaveError("formularz zawiera błędy");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = mapToArimrPayload(parsed.data); // oficjalny JSON urzędowy
      await db.syncQueue.add({ payload, status: "pending", createdAt: Date.now() });
      if (navigator.onLine) await flushQueue();
      setForm({ dataZdarzenia: todayISO(), nrMatki: "", nrZwierzecia: "", płeć: "XX" });
      setTouched({});
      onSaved();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const inputCls = (err?: string) =>
    `w-full rounded-xl border px-3 py-3 font-mono tracking-wide outline-none transition ${
      err ? "border-red-400 bg-red-50" : "border-slate-300 bg-white focus:border-emerald-600"
    }`;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <h2 className="text-lg font-bold">Zgłoś wycielenie (WYC)</h2>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-600">
          Data zdarzenia (max 7 dni wstecz)
        </span>
        <input
          type="date"
          max={todayISO()}
          value={form.dataZdarzenia}
          onChange={(e) => set({ dataZdarzenia: e.target.value })}
          onBlur={() => setTouched((t) => ({ ...t, dataZdarzenia: true }))}
          className={inputCls(fieldErr("dataZdarzenia"))}
        />
        {fieldErr("dataZdarzenia") && (
          <p className="mt-1 text-xs text-red-600">{fieldErr("dataZdarzenia")}</p>
        )}
      </label>

      {(["nrMatki", "nrZwierzecia"] as const).map((key) => (
        <label key={key} className="block">
          <span className="mb-1 flex items-center justify-between text-sm font-medium text-slate-600">
            {key === "nrMatki" ? "Numer matki (PL…)" : "Numer cielęcia (PL…)"}
            <button
              type="button"
              onClick={() => setScanTarget(key)}
              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white active:scale-95"
            >
              📷 Skanuj
            </button>
          </span>
          <input
            inputMode="text"
            autoCapitalize="characters"
            placeholder="PL123456789012"
            value={form[key]}
            onChange={(e) => set({ [key]: e.target.value } as Partial<WycielienieForm>)}
            onBlur={() => setTouched((t) => ({ ...t, [key]: true }))}
            className={inputCls(fieldErr(key))}
          />
          {fieldErr(key) && <p className="mt-1 text-xs text-red-600">{fieldErr(key)}</p>}
        </label>
      ))}

      <div>
        <span className="mb-1 block text-sm font-medium text-slate-600">Płeć cielęcia</span>
        <div className="grid grid-cols-2 gap-2">
          {(["XX", "XY"] as const).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => set({ płeć: g })}
              className={`rounded-xl border px-3 py-3 font-semibold transition ${
                form.płeć === g
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {g === "XX" ? "XX — samica" : "XY — samiec"}
            </button>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{saveError}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-emerald-700 px-4 py-4 text-base font-bold text-white shadow active:scale-[0.99] disabled:opacity-50"
      >
        {saving ? "Zapisywanie…" : "Zapisz i zgłoś"}
      </button>

      {scanTarget && <Scanner onScan={handleScan} onClose={() => setScanTarget(null)} />}
    </form>
  );
}

/* ---------- Dashboard ---------- */

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [docs, setDocs] = useState<SyncDoc[]>([]);
  const [view, setView] = useState<"dash" | "form">("dash");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(() => {
    db.syncQueue.orderBy("createdAt").reverse().limit(50).toArray().then(setDocs);
  }, []);

  useEffect(() => {
    refresh();
    const goOnline = () => {
      setOnline(true);
      void flushQueue().then((n) => {
        if (n > 0) showToast(`Zsynchronizowano ${n} zaległych zgłoszeń`);
        refresh();
      });
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Uwaga: "changes" w Dexie wymaga addonu dexie-observable — dlatego lista
    // odświeża się jawnie po każdej mutacji (submit/retry) oraz przy powrocie
    // na wierzch (visibilitychange).
    const onVisible = (): void => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  function showToast(msg: string) {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }

  const pending = useMemo(() => docs.filter((d) => d.status === "pending").length, [docs]);
  const failed = useMemo(() => docs.filter((d) => d.status === "failed").length, [docs]);

  const statusMap = {
    pending: { label: "czeka", cls: "bg-amber-100 text-amber-800" },
    sent: { label: "wysłane", cls: "bg-emerald-100 text-emerald-800" },
    failed: { label: "błąd", cls: "bg-red-100 text-red-700" },
  } as const;

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <h1 className="text-lg font-extrabold tracking-tight text-emerald-800">AgroSync</h1>
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold ${
              online ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-500" : "bg-slate-500"}`} />
            {online ? "online" : "offline"}
          </span>
          {pending > 0 && (
            <span className="rounded-full bg-amber-400 px-2.5 py-1 font-bold text-amber-950">
              {pending} zaległe
            </span>
          )}
        </div>
      </header>

      <main className="flex-1 space-y-4 p-4 pb-24">
        {view === "dash" ? (
          <>
            <button
              onClick={() => setView("form")}
              className="w-full rounded-2xl bg-emerald-700 px-4 py-5 text-lg font-bold text-white shadow-lg shadow-emerald-900/20 active:scale-[0.99]"
            >
              🐄 Zgłoś wycielenie (WYC)
            </button>

            {failed > 0 && (
              <button
                onClick={() =>
                  void db.syncQueue
                    .where("status")
                    .equals("failed")
                    .modify({ status: "pending", error: undefined })
                    .then(() => flushQueue().then(refresh))
                }
                className="w-full rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              >
                {failed} odrzuconych — ponów wysyłkę
              </button>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-bold text-slate-500">
                Kolejka synchronizacji
              </h2>
              {docs.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">
                  Brak zgłoszeń. Zapisane zdarzenia pojawią się tutaj.
                </p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {docs.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm font-semibold">
                          {d.payload.kodZdarzenia} · {d.payload.nrZwierzecia}
                        </p>
                        <p className="text-xs text-slate-500">
                          {d.payload.dataZdarzenia}
                          {d.payload.płeć ? ` · ${d.payload.płeć}` : ""}
                          {d.refNo ? ` · ${d.refNo}` : d.error ? ` · ${d.error}` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${statusMap[d.status].cls}`}
                      >
                        {statusMap[d.status].label}
                      </span>
                    </li>
  ))}
                </ul>
              )}
            </section>
          </>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <button
              onClick={() => setView("dash")}
              className="mb-3 text-sm font-semibold text-emerald-700"
            >
              ← Wróć
            </button>
            <WycielienieFormView
              onSaved={() => {
                setView("dash");
                showToast(navigator.onLine ? "Zgłoszenie wysłane do IRZplus" : "Zapisano offline — wyśle po powrocie sieci");
                refresh();
              }}
            />
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm rounded-xl bg-slate-900 px-4 py-3 text-center text-sm font-medium text-white shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
}
