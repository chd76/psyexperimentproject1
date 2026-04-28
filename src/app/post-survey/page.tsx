"use client";

import { useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

// ─── Speed scale (-2 … +2) ───────────────────────────────────────────────────
const SPEED_LABELS: Record<number, string> = {
  [-2]: "Çok yavaş",
  [-1]: "yavaş",
  [0]: "ne hızlı ne yavaş",
  [1]: "hızlı",
  [2]: "çok hızlı",
};
const SPEED_OPTIONS = [-2, -1, 0, 1, 2];

// ─── Likert scale (0 … 4) ────────────────────────────────────────────────────
const LIKERT_LABELS: Record<number, string> = {
  [0]: "kesinlikle katılmıyorum",
  [1]: "katılmıyorum",
  [2]: "karasızım/nötr",
  [3]: "katılıyorum",
  [4]: "kesinlikle katılıyorum",
};
const LIKERT_OPTIONS = [0, 1, 2, 3, 4];

// ─── Question definitions ─────────────────────────────────────────────────────
const SPEED_QUESTIONS: { key: string; label: string; optional?: boolean }[] = [
  { key: "speed_general",      label: "Genelde zaman senin için ne kadar hızlı geçiyor?" },
  { key: "speed_next_hour",    label: "Önümüzdeki bir saatin ne kadar hızlı geçmesini bekliyorsun?" },
  { key: "speed_last_week",    label: "Geçen hafta senin için ne kadar hızlı geçti?" },
  { key: "speed_last_month",   label: "Geçen ay senin için ne kadar hızlı geçti?" },
  { key: "speed_last_year",    label: "Geçen yıl senin için ne kadar hızlı geçti?" },
  { key: "speed_last_10_years",label: "Son 10 yıl senin için ne kadar hızlı geçti?" },
  { key: "speed_childhood",    label: "Çocukluğunuz (<12 yaş) ne kadar hızlı geçti?" },
  { key: "speed_youth",        label: "Gençliğiniz (13–19 yaş) ne kadar hızlı geçti?" },
  { key: "speed_adult_20s",    label: "20 ile 29 yaş arasındaki yetişkinlik döneminiz ne kadar hızlı geçti?" },
  { key: "speed_adult_30s",    label: "30 ile 39 yaş arasındaki yetişkinlik döneminiz ne kadar hızlı geçti?", optional: true },
];

interface LikertGroup {
  title: string;
  questions: { key: string; label: string }[];
}

const LIKERT_GROUPS: LikertGroup[] = [
  {
    title: "Zaman Baskısı",
    questions: [
      { key: "pressure_1", label: "Görevlerimi tamamlamak için yeterli zamanım yok." },
      { key: "pressure_2", label: "Sık sık zaman baskısı hissediyorum." },
      { key: "pressure_3", label: "Önemli işlere kendimi adamak için genellikle yeterli zamanım olmuyor." },
      { key: "pressure_4", label: "Sık sık zamanın tükenmekte olduğunu düşünüyorum." },
      { key: "pressure_5", label: "Yapmak istediğim her şeyi yapamadığım için önceliklerimi belirlemem gerekiyor." },
    ],
  },
  {
    title: "Zamanın Genişlemesi",
    questions: [
      { key: "expansion_1", label: "Zamanım boş geçiyor gibi geliyor." },
      { key: "expansion_2", label: "Zamanın hiç geçmek istemediğini sık sık düşünüyorum." },
      { key: "expansion_3", label: "Sık sık sıkılıyorum." },
      { key: "expansion_4", label: "Çok fazla zamanım var." },
      { key: "expansion_5", label: "Zamanımı sık sık hiçbir şey yapmadan geçiriyorum." },
    ],
  },
  {
    title: "Metaforlar: Hız",
    questions: [
      { key: "metaphor_speed_1", label: "Zaman, hızla giden bir trendir." },
      { key: "metaphor_speed_2", label: "Zaman, dörtnala koşan bir attır." },
      { key: "metaphor_speed_3", label: "Zaman, şelale gibi akan bir sudur." },
    ],
  },
  {
    title: "Metaforlar: Yavaşlık",
    questions: [
      { key: "metaphor_slow_1", label: "Zaman, uçsuz bucaksız bir gökyüzüdür." },
      { key: "metaphor_slow_2", label: "Zaman, sessiz ve hareketsiz bir denizdir." },
      { key: "metaphor_slow_3", label: "Zaman, sıkıcı bir şarkıdır." },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function SpeedRow({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {SPEED_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          title={SPEED_LABELS[opt]}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium transition
            ${value === opt
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
        >
          <span>{opt > 0 ? `+${opt}` : opt}</span>
          <span className="text-[10px] font-normal opacity-70 whitespace-nowrap">{SPEED_LABELS[opt]}</span>
        </button>
      ))}
    </div>
  );
}

function LikertRow({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap justify-center">
      {LIKERT_OPTIONS.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          title={LIKERT_LABELS[opt]}
          className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-sm font-medium transition
            ${value === opt
              ? "bg-blue-600 text-white"
              : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700"
            }`}
        >
          <span>{opt}</span>
          <span className="text-[10px] font-normal opacity-70 whitespace-nowrap">{LIKERT_LABELS[opt]}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
function PostSurveyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const participantId = searchParams.get("pid") || "";
  const group = searchParams.get("group") || "";

  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Synchronous guard against rapid double-clicks.
  const submittingRef = useRef(false);

  const set = (key: string, value: number) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  // All required keys (optional ones excluded from validation)
  const requiredKeys = [
    ...SPEED_QUESTIONS.filter((q) => !q.optional).map((q) => q.key),
    ...LIKERT_GROUPS.flatMap((g) => g.questions.map((q) => q.key)),
  ];
  const allAnswered = requiredKeys.every((k) => answers[k] != null);

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!allAnswered) {
      setError("Lütfen tüm soruları yanıtlayın.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/save-post-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId, ...answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      console.error("Failed to save post-survey:", err);
      setError("Veriler kaydedilemedi. Lütfen tekrar deneyin.");
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    const params = new URLSearchParams({ pid: participantId, group });
    router.push(`/debrief?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white px-4 py-10">
      <div className="mx-auto max-w-2xl space-y-10">
        {/* Başlık */}
        <div className="text-center">
          <p className="text-base font-medium text-white">
            Lütfen sıradaki soruları dürüstçe cevaplayın.
          </p>
        </div>

        {/* ── Bölüm 1: Hız ölçeği ── */}
        <section className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Şimdiki Zaman ve Geçmiş Zamanın Kişisel Deneyimi
            </h2>
            <p className="text-xs text-neutral-400">
              Derecelendirme Ölçeği:{" "}
              <span className="text-neutral-200">
                −2 Çok yavaş &nbsp;·&nbsp; −1 yavaş &nbsp;·&nbsp; 0 ne hızlı ne yavaş &nbsp;·&nbsp; +1 hızlı &nbsp;·&nbsp; +2 çok hızlı
              </span>
            </p>
          </div>

          <div className="space-y-6">
            {SPEED_QUESTIONS.map((q) => (
              <div key={q.key} className="space-y-2">
                <p className="text-base font-medium text-white">
                  {q.label}
                  {q.optional && (
                    <span className="ml-2 text-xs text-neutral-500">(isteğe bağlı)</span>
                  )}
                </p>
                <SpeedRow value={answers[q.key] ?? null} onChange={(v) => set(q.key, v)} />
              </div>
            ))}
          </div>
        </section>

        <div className="border-t border-neutral-800" />

        {/* ── Bölüm 2: Likert ölçeği ── */}
        <section className="space-y-8">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">
              Öznel Zaman Deneyimine İlişkin İfadeler/Metaforlar
            </h2>
            <p className="text-xs text-neutral-400">
              Derecelendirme Ölçeği:{" "}
              <span className="text-neutral-200">
                0 kesinlikle katılmıyorum &nbsp;·&nbsp; 1 katılmıyorum &nbsp;·&nbsp; 2 karasızım/nötr &nbsp;·&nbsp; 3 katılıyorum &nbsp;·&nbsp; 4 kesinlikle katılıyorum
              </span>
            </p>
          </div>

          <div className="space-y-6">
            {LIKERT_GROUPS.flatMap((grp) =>
              grp.questions.map((q) => (
                <div key={q.key} className="space-y-2">
                  <p className="text-base font-medium text-white">{q.label}</p>
                  <LikertRow value={answers[q.key] ?? null} onChange={(v) => set(q.key, v)} />
                </div>
              ))
            )}
          </div>
        </section>

        {/* Gönder */}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button
          onClick={handleSubmit}
          disabled={!allAnswered || loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Kaydediliyor..." : "Anketi Tamamla"}
        </button>
      </div>
    </div>
  );
}

export default function PostSurveyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-neutral-950">
          <p className="text-neutral-400">Yükleniyor...</p>
        </div>
      }
    >
      <PostSurveyContent />
    </Suspense>
  );
}
