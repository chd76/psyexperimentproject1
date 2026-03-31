# Fullscreen Implementation Plan

## Context
The experiment measures time perception distortion. If participants can see the system clock, it defeats the purpose. We need forced fullscreen mode to hide the clock on both mobile and desktop.

---

## Platform Support Summary

| Platform | Fullscreen API | Clock Hidden? | Workaround |
|----------|---------------|---------------|------------|
| Desktop Chrome/Firefox/Edge | Full support | Yes | None needed |
| Android Chrome | Full support | Yes (hides status bar) | None needed |
| iOS Safari | NOT supported on `documentElement` | No | PWA mode or Guided Access |

---

## Implementation

### 1. Trigger fullscreen on session start — `src/app/page.tsx`

In `handleStart()`, request fullscreen before navigating:

```tsx
const handleStart = async () => {
  // ... existing validation & group assignment logic ...

  // Request fullscreen (requires user gesture — button click satisfies this)
  try {
    const el = document.documentElement;
    const requestFs = el.requestFullscreen
      || (el as any).webkitRequestFullscreen
      || (el as any).msRequestFullscreen;
    if (requestFs) {
      await requestFs.call(el);
    }
  } catch (e) {
    console.warn("Fullscreen request failed:", e);
  }

  router.push(`/feed?${params.toString()}`);
};
```

### 2. Enforce fullscreen during experiment — `src/app/feed/page.tsx`

Add a fullscreen enforcement hook inside `FeedContent`:

```tsx
const [isFullscreen, setIsFullscreen] = useState(true);

useEffect(() => {
  const handleFsChange = () => {
    const fsActive = !!(
      document.fullscreenElement ||
      (document as any).webkitFullscreenElement
    );
    setIsFullscreen(fsActive);

    if (!fsActive && playerRef.current) {
      playerRef.current.pauseVideo(); // Pause video when not fullscreen
    }
  };

  document.addEventListener("fullscreenchange", handleFsChange);
  document.addEventListener("webkitfullscreenchange", handleFsChange);

  return () => {
    document.removeEventListener("fullscreenchange", handleFsChange);
    document.removeEventListener("webkitfullscreenchange", handleFsChange);
  };
}, []);

const reEnterFullscreen = async () => {
  try {
    await document.documentElement.requestFullscreen();
    setIsFullscreen(true);
    if (playerRef.current) playerRef.current.playVideo();
  } catch (e) {
    console.warn("Fullscreen re-entry failed:", e);
  }
};
```

Add a re-enter overlay in JSX (show when `!isFullscreen && !showSurvey`):

```tsx
{!isFullscreen && !showSurvey && (
  <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90">
    <p className="text-white text-lg mb-4 text-center px-6">
      Please return to fullscreen to continue the experiment.
    </p>
    <button
      onClick={reEnterFullscreen}
      className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
    >
      Re-enter Fullscreen
    </button>
  </div>
)}
```

### 3. Exit fullscreen on debrief — `src/app/debrief/page.tsx`

```tsx
useEffect(() => {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}, []);
```

### 4. Viewport & PWA setup — `src/app/layout.tsx`

Add to `<head>`:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<link rel="manifest" href="/manifest.json" />
```

### 5. PWA manifest for iOS — `public/manifest.json`

```json
{
  "name": "Video Time Perception Lab",
  "short_name": "TimeLab",
  "start_url": "/",
  "display": "fullscreen",
  "background_color": "#000000",
  "theme_color": "#000000"
}
```

### 6. iOS detection & prompt — `src/app/page.tsx`

Detect iOS Safari and show "Add to Home Screen" instructions before the experiment:

```tsx
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
const isStandalone = (window.navigator as any).standalone === true;

// If iOS and NOT running as PWA, show instruction overlay
if (isIOS && !isStandalone) {
  // Show: "For the best experience, tap Share > Add to Home Screen, then open from there."
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/app/page.tsx` | Trigger fullscreen + iOS detection |
| `src/app/feed/page.tsx` | Enforce fullscreen, pause on exit, re-enter overlay |
| `src/app/debrief/page.tsx` | Exit fullscreen on mount |
| `src/app/layout.tsx` | Viewport meta, PWA meta tags, manifest link |
| `public/manifest.json` | New file — PWA manifest |

---

## Verification Checklist

- [ ] Desktop Chrome/Firefox: "Start Experiment" goes fullscreen, clock is hidden
- [ ] Desktop: pressing Esc shows re-enter overlay, video pauses
- [ ] Desktop: clicking "Re-enter Fullscreen" resumes
- [ ] Android Chrome: fullscreen hides status bar and clock
- [ ] iOS Safari (in-browser): shows "Add to Home Screen" prompt
- [ ] iOS Safari (PWA from home screen): runs without browser chrome
- [ ] Debrief page exits fullscreen automatically
- [ ] Survey modal still works correctly in fullscreen

---

## Limitation Notes

- **iOS Safari in-browser**: Cannot programmatically hide the clock. PWA or Guided Access are the only options.
- **Guided Access (lab setting)**: If devices are controlled, enable Settings > Accessibility > Guided Access on iOS devices before the session. This locks the device into the app and hides the status bar entirely. No code changes needed.
- **Firefox quirk**: Some Firefox versions show a "Press Esc to exit" banner for a few seconds — this is unavoidable.
