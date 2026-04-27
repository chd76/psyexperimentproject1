"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";

function DebriefContent() {
  const searchParams = useSearchParams();
  const participantId = searchParams.get("pid") || "Unknown";
  const group = searchParams.get("group") || "?";

  // Exit fullscreen when arriving at debrief
  useEffect(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    } else if ((document as unknown as { webkitFullscreenElement?: Element }).webkitFullscreenElement) {
      (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 text-center">
        <div className="space-y-3">
          <div className="text-5xl mb-4">&#10003;</div>
          <h1 className="text-3xl font-bold tracking-tight">Katılımınız için teşşekür ederiz!</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Oturumunuz başarıyla kaydedildi. Zaman algısı
            ve video tüketimi üzerine yapılan bu araştırma
            çalışmasına katıldığınız için teşekkür ederiz.
          </p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 text-left space-y-3">
          <h2 className="text-sm font-semibold text-neutral-300">
            Session Details
          </h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Katılımcı ID</span>
              <span className="text-white font-mono">{participantId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Grup</span>
              <span className="text-white font-mono">
                {group === "A" ? "A (Algoritma)" : "B (Kontrol)"}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-4 space-y-3">
          <p className="text-xs text-neutral-600">
            Bu deney, farklı içerik tavsiye stratejilerinin zaman
            algınızı nasıl etkileyebileceğini araştırdı. A Grubu,
            etkileşimi en üst düzeye çıkarmak için tasarlanmış ve
            algoritmalar tarafından derlenmiş içerikler alırken,
            B Grubu rastgele seçilmiş içerikler aldı.
          </p>
          <p className="text-xs text-neutral-600">
            Pencereyi kapatabilirsiniz.
          </p>
        </div>
      </div>
    </main>
  );
}

export default function DebriefPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-neutral-400">Loading...</p>
        </div>
      }
    >
      <DebriefContent />
    </Suspense>
  );
}
