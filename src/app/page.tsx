"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function Onboarding() {
  const [participantId, setParticipantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Synchronous guards against rapid double-clicks (state-based `loading` is
  // async and won't disable the button before a second click slips through).
  const startingRef = useRef(false);
  const submittingRef = useRef(false);

  // Two-step flow: "id" then "survey"
  const [step, setStep] = useState<"id" | "survey">("id");
  const [group, setGroup] = useState("");
  const [interruptionTime, setInterruptionTime] = useState(0);

  // Survey fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [device, setDevice] = useState("");
  const [screenTime, setScreenTime] = useState("");

  // Step 1: Validate ID and get group assignment
  const handleStart = async () => {
    if (startingRef.current) return;
    const trimmed = participantId.trim();
    if (!trimmed) return;

    startingRef.current = true;
    setLoading(true);
    setError("");

    try {
      // Pass participant_id so the server can dedupe per participant —
      // refreshes / repeat visits no longer inflate group_counts.
      const res = await fetch(
        `/api/assign-group?pid=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();

      if (!data.group) {
        throw new Error("No group returned");
      }

      setGroup(data.group);
      const it = Math.floor(Math.random() * (420 - 180 + 1)) + 180;
      setInterruptionTime(it);
      setStep("survey");
      setLoading(false);
      startingRef.current = false;
    } catch {
      setError("Server bağlantısı başarısız. Lütfen tekrar deneyin, devam etmesi halinde cahid.emin@gmail.com ile iletişime geçin.");
      setLoading(false);
      startingRef.current = false;
    }
  };

  // Step 2: Save survey and navigate to feed
  const handleSurveySubmit = async () => {
    if (submittingRef.current) return;
    if (!name.trim() || !age || !department.trim() || !location.trim() || !device || !screenTime) {
      setError("Lütfen bütün soruları yanıtlayın.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/save-pre-survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participant_id: participantId.trim(),
          name: name.trim(),
          age: parseInt(age, 10),
          department: department.trim(),
          location: location.trim(),
          device,
          avg_daily_screen_time_hours: parseInt(screenTime, 10),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        setError("Database hatası. Lütfen cahid.emin@gmail.com ile iletişime geçin");
        setLoading(false);
        submittingRef.current = false;
        return;
      }

      // Request fullscreen before navigating (user gesture from button click)
      try {
        const el = document.documentElement;
        const requestFs =
          el.requestFullscreen ||
          (el as unknown as { webkitRequestFullscreen?: () => Promise<void> }).webkitRequestFullscreen;
        if (requestFs) {
          await requestFs.call(el);
        }
      } catch (e) {
        console.warn("Tam ekran hatası:", e);
      }

      const params = new URLSearchParams({
        pid: participantId.trim(),
        group,
        it: interruptionTime.toString(),
      });

      router.push(`/feed?${params.toString()}`);
    } catch {
      setError("Failed to connect to server. Please contact 05535259122.");
      setLoading(false);
      submittingRef.current = false;
    }
  };

  const inputClass =
    "w-full rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3 text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition";

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">
            Dijital Medya Davranış Labı
          </h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            {step === "id"
              ? "Çalışmada sosyal medya davranışlarının kısa formatlı videolar üzerinden gözlemlenmesi hedeflenmektedir. Deney sonrasında sosyal medya davranışını ölçen bir ölçek sunulacaktır, doğru ya da yanlış cevap yoktur. Lütfen doğal bir şekilde izleyin."
              : "Lütfen aşağıdaki soruları cevaplayın"}
          </p>
        </div>

        {/* Step 1: Participant ID */}
        {step === "id" && (
          <div className="space-y-4">
            <div className="text-left space-y-2">
              <label
                htmlFor="participant-id"
                className="text-sm font-medium text-neutral-300"
              >
                Participant ID
              </label>
              <input
                id="participant-id"
                type="text"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleStart()}
                placeholder="Katılımcı ID'nizi girin."
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 text-left">{error}</p>
            )}

            <button
              onClick={handleStart}
              disabled={!participantId.trim() || loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Yönlendiriliyor..." : "Devam Et"}
            </button>
          </div>
        )}

        {/* Step 2: Pre-experiment Survey */}
        {step === "survey" && (
          <div className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Adınız ve soyadınız nedir ?
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tam isminiz"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Kaç yaşındasınız?
              </label>
              <input
                type="number"
                min="1"
                max="120"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Yaş"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Departmanınız nedir?
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Bilgisayar Mühendisliği"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Nereden katılım sağlıyorsunuz?
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Ev, kütüphane, kafe"
                className={inputClass}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Ne tür cihaz kullanıyorsunuz?
              </label>
              <div className="flex gap-3">
                {["iOS", "Android", "PC"].map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setDevice(opt)}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition ${device === opt
                      ? "border-blue-500 bg-blue-600/20 text-blue-400"
                      : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
                      }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-neutral-300">
                Günlük ortalama sosyal medya ve video uygulamalarında toplam ekran süreniz nedir ?
              </label>
              <p className="text-xs text-neutral-500">
                (YouTube, Instagram, Twitter/X, TikTok, etc.)
              </p>
              <input
                type="number"
                min="0"
                max="24"
                value={screenTime}
                onChange={(e) => setScreenTime(e.target.value)}
                placeholder="Günlük ortalama saat"
                className={inputClass}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400">{error}</p>
            )}

            <button
              onClick={handleSurveySubmit}
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? "Cevaplarınız Kaydediliyor..." : "Deneye Katıl"}
            </button>
          </div>
        )}

        <p className="text-xs text-neutral-600">
          Katılarak, bu araştırma çalışmasına rıza göstermiş oluyorsunuz.
        </p>
      </div>
    </main>
  );
}
