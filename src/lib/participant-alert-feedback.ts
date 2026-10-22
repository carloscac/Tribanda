const PREFS_KEY = "tribanda-match-alerts";

let sharedAudio: AudioContext | null = null;

export function matchAlertsEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(PREFS_KEY) === "1";
}

export function setMatchAlertsEnabled(on: boolean) {
  window.localStorage.setItem(PREFS_KEY, on ? "1" : "0");
  window.dispatchEvent(new Event("tribanda-alerts-changed"));
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudio) sharedAudio = new Ctx();
  return sharedAudio;
}

/** Llamar en un clic del usuario (iOS exige gesto para sonido). */
export async function unlockAlertAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") await ctx.resume();
}

export async function playMatchAlertBeep() {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    const t0 = ctx.currentTime;
    for (const [freq, start, dur] of [
      [880, 0, 0.12],
      [1175, 0.14, 0.18],
    ] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* sin audio */
  }
}

export function vibrateMatchAlert() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate([200, 80, 200, 80, 400]);
  }
}

export function canVibrate() {
  return typeof navigator !== "undefined" && "vibrate" in navigator;
}

export async function requestMatchAlertPermission() {
  if (typeof window === "undefined") return Notification.permission;
  if (!("Notification" in window)) return "denied" as NotificationPermission;
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

export function showMatchSystemNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag: "tribanda-match",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* Safari */
  }
}

export async function fireMatchAlertFeedback(title: string, body: string) {
  vibrateMatchAlert();
  if (matchAlertsEnabled()) {
    await playMatchAlertBeep();
  }
  showMatchSystemNotification(title, body);
}

/** Prueba tras activar (desde gesto del usuario). */
export async function playActivationTest() {
  await unlockAlertAudio();
  vibrateMatchAlert();
  await playMatchAlertBeep();
  showMatchSystemNotification("TriBanda", "Avisos de mesa activados. Deberías oír este tono cuando te toque jugar.");
}
