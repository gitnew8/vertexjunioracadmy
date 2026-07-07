import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ExamSecuritySettings = {
  id: string;
  scope: string;
  fullscreen_required: boolean;
  tab_switch_limit: number;
  camera_required: boolean;
  camera_snapshot_interval_sec: number;
  mic_monitoring: boolean;
  ai_behavior_tracking: boolean;
  randomize_questions: boolean;
  randomize_options: boolean;
  per_question_timer_sec: number;
  allow_skip: boolean;
  block_copy_paste: boolean;
  block_screenshot: boolean;
  warning_limit: number;
  auto_action: "flag" | "auto_submit" | "lock";
  result_policy_low: ResultPolicy;
  result_policy_medium: ResultPolicy;
  result_policy_high: ResultPolicy;
  system_enabled: boolean;
};

export type ResultPolicy = "release" | "hold_teacher" | "hold_admin";
export type RiskLabel = "low" | "medium" | "high";

export const DEFAULT_SETTINGS: ExamSecuritySettings = {
  id: "",
  scope: "default",
  fullscreen_required: true,
  tab_switch_limit: 3,
  camera_required: false,
  camera_snapshot_interval_sec: 30,
  mic_monitoring: false,
  ai_behavior_tracking: true,
  randomize_questions: true,
  randomize_options: true,
  per_question_timer_sec: 0,
  allow_skip: true,
  block_copy_paste: true,
  block_screenshot: true,
  warning_limit: 3,
  auto_action: "auto_submit",
  result_policy_low: "release",
  result_policy_medium: "hold_teacher",
  result_policy_high: "hold_admin",
  system_enabled: true,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabase as any;

export async function fetchExamSecuritySettings(): Promise<ExamSecuritySettings> {
  const { data } = await sb
    .from("exam_security_settings")
    .select("*")
    .eq("scope", "default")
    .maybeSingle();
  return (data as ExamSecuritySettings) || DEFAULT_SETTINGS;
}

export async function saveExamSecuritySettings(patch: Partial<ExamSecuritySettings>) {
  const { error } = await sb
    .from("exam_security_settings")
    .update(patch)
    .eq("scope", "default");
  if (error) throw error;
}



type EventType =
  | "tab_switch"
  | "fullscreen_exit"
  | "copy"
  | "paste"
  | "right_click"
  | "screenshot"
  | "face_missing"
  | "multi_face"
  | "noise"
  | "ai_suspicion"
  | "snapshot"
  | "warning"
  | "auto_submit";

export async function logSecurityEvent(
  attemptCtx: { attempt_id?: string | null; student_id?: string | null; test_id?: string | null },
  event_type: EventType,
  payload: Record<string, unknown> = {},
  severity: "low" | "medium" | "high" = "low",
) {
  try {
    await sb.from("exam_security_events").insert({
      attempt_id: attemptCtx.attempt_id || null,
      student_id: attemptCtx.student_id || null,
      test_id: attemptCtx.test_id || null,
      event_type,
      severity,
      payload,
    });
  } catch {
    // fail silent — never block test taking
  }

}


// Deterministic seeded shuffle
export function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 1_000_000) / 1_000_000;
  };
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export type SecurityContext = {
  test_id?: string | null;
  student_id?: string | null;
  attempt_id?: string | null;
};

export type UseExamSecurityOptions = {
  active: boolean;
  settings: ExamSecuritySettings;
  ctx: SecurityContext;
  onAutoSubmit: (reason: string) => void;
};

export function useExamSecurity({ active, settings, ctx, onAutoSubmit }: UseExamSecurityOptions) {
  const [warnings, setWarnings] = useState(0);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const warnRef = useRef(0);
  const submittedRef = useRef(false);

  function warn(reason: string, severity: "low" | "medium" | "high" = "medium") {
    if (submittedRef.current) return;
    warnRef.current += 1;
    setWarnings(warnRef.current);
    logSecurityEvent(ctx, "warning", { reason }, severity);
    toast.warning(`⚠️ ${reason} — Warning ${warnRef.current}/${settings.warning_limit}`);
    if (
      settings.warning_limit > 0 &&
      warnRef.current >= settings.warning_limit &&
      settings.auto_action === "auto_submit"
    ) {
      submittedRef.current = true;
      logSecurityEvent(ctx, "auto_submit", { reason }, "high");
      onAutoSubmit(reason);
    }
  }

  // Fullscreen
  useEffect(() => {
    if (!active || !settings.fullscreen_required) return;
    const enter = async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
      } catch {
        /* ignore */
      }
    };
    enter();
    const onChange = () => {
      if (!document.fullscreenElement && active && !submittedRef.current) {
        logSecurityEvent(ctx, "fullscreen_exit", {}, "medium");
        warn("Fullscreen exit detected");
      }
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings.fullscreen_required]);

  // Tab / visibility change
  useEffect(() => {
    if (!active) return;
    const onVis = () => {
      if (document.hidden && !submittedRef.current) {
        setTabSwitches((n) => n + 1);
        logSecurityEvent(ctx, "tab_switch", {}, "high");
        if (settings.tab_switch_limit > 0) warn("Tab / window change detected", "high");
      }
    };
    const onBlur = () => onVis();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings.tab_switch_limit]);

  // Copy/paste/right-click
  useEffect(() => {
    if (!active || !settings.block_copy_paste) return;
    const block = (e: Event, type: EventType) => {
      e.preventDefault();
      logSecurityEvent(ctx, type, {}, "low");
      toast.error("Copy / paste blocked during exam");
    };
    const c = (e: Event) => block(e, "copy");
    const p = (e: Event) => block(e, "paste");
    const r = (e: Event) => block(e, "right_click");
    document.addEventListener("copy", c);
    document.addEventListener("paste", p);
    document.addEventListener("cut", c);
    document.addEventListener("contextmenu", r);
    return () => {
      document.removeEventListener("copy", c);
      document.removeEventListener("paste", p);
      document.removeEventListener("cut", c);
      document.removeEventListener("contextmenu", r);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings.block_copy_paste]);

  // Screenshot / print shortcuts
  useEffect(() => {
    if (!active || !settings.block_screenshot) return;
    const onKey = (e: KeyboardEvent) => {
      const bad =
        e.key === "PrintScreen" ||
        ((e.ctrlKey || e.metaKey) && (e.key === "p" || e.key === "P" || e.key === "s" || e.key === "S"));
      if (bad) {
        e.preventDefault();
        logSecurityEvent(ctx, "screenshot", { key: e.key }, "medium");
        warn("Screenshot / print attempt blocked", "medium");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings.block_screenshot]);

  // Camera + optional mic
  useEffect(() => {
    if (!active) return;
    if (!settings.camera_required && !settings.mic_monitoring) return;
    let stopped = false;
    let snapTimer: ReturnType<typeof setInterval> | null = null;
    let noiseTimer: ReturnType<typeof setInterval> | null = null;
    let audioCtx: AudioContext | null = null;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: settings.camera_required,
          audio: settings.mic_monitoring,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setCameraOn(settings.camera_required);
        setMicOn(settings.mic_monitoring);

        if (settings.camera_required) {
          const v = videoRef.current;
          if (v) {
            v.srcObject = stream;
            v.muted = true;
            await v.play().catch(() => {});
          }
          const interval = Math.max(10, settings.camera_snapshot_interval_sec) * 1000;
          snapTimer = setInterval(async () => {
            try {
              const vv = videoRef.current;
              if (!vv || vv.videoWidth === 0) return;
              const canvas = document.createElement("canvas");
              canvas.width = 320;
              canvas.height = 240;
              const g = canvas.getContext("2d");
              if (!g) return;
              g.drawImage(vv, 0, 0, canvas.width, canvas.height);
              // Basic "face missing" heuristic: very dark or very bright frame
              const img = g.getImageData(0, 0, canvas.width, canvas.height);
              let sum = 0;
              for (let i = 0; i < img.data.length; i += 4) {
                sum += img.data[i] + img.data[i + 1] + img.data[i + 2];
              }
              const avg = sum / (img.data.length / 4) / 3;
              const blob: Blob | null = await new Promise((res) =>
                canvas.toBlob((b) => res(b), "image/jpeg", 0.55),
              );
              if (blob && ctx.attempt_id) {
                const path = `${ctx.attempt_id}/${Date.now()}.jpg`;
                await supabase.storage.from("exam-snapshots").upload(path, blob, {
                  contentType: "image/jpeg",
                  upsert: false,
                });
                logSecurityEvent(ctx, "snapshot", { path, brightness: Math.round(avg) }, "low");
              }
              if (avg < 20 || avg > 240) {
                logSecurityEvent(ctx, "face_missing", { brightness: Math.round(avg) }, "medium");
              }
            } catch {
              /* ignore snap errors */
            }
          }, interval);
        }

        if (settings.mic_monitoring) {
          audioCtx = new AudioContext();
          const src = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 512;
          src.connect(analyser);
          const buf = new Uint8Array(analyser.frequencyBinCount);
          noiseTimer = setInterval(() => {
            analyser.getByteTimeDomainData(buf);
            let rms = 0;
            for (const b of buf) {
              const v = (b - 128) / 128;
              rms += v * v;
            }
            rms = Math.sqrt(rms / buf.length);
            if (rms > 0.25) {
              logSecurityEvent(ctx, "noise", { rms: Math.round(rms * 100) / 100 }, "low");
            }
          }, 5000);
        }
      } catch {
        toast.error("Camera / mic access required by admin. Please allow and retry.");
      }
    })();

    return () => {
      stopped = true;
      if (snapTimer) clearInterval(snapTimer);
      if (noiseTimer) clearInterval(noiseTimer);
      if (audioCtx) audioCtx.close().catch(() => {});
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraOn(false);
      setMicOn(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, settings.camera_required, settings.mic_monitoring, settings.camera_snapshot_interval_sec]);

  return { warnings, tabSwitches, cameraOn, micOn, videoRef };
}

// Server-side risk computation (client-side for now; app has no server auth)
export function computeRisk(events: { event_type: string; severity: string }[]): {
  score: number;
  label: RiskLabel;
} {
  let score = 0;
  const weight: Record<string, number> = {
    tab_switch: 15,
    fullscreen_exit: 8,
    copy: 5,
    paste: 5,
    right_click: 1,
    screenshot: 10,
    face_missing: 8,
    multi_face: 20,
    noise: 3,
    ai_suspicion: 12,
    warning: 5,
    auto_submit: 30,
  };
  for (const e of events) {
    score += weight[e.event_type] || 2;
    if (e.severity === "high") score += 5;
  }
  score = Math.min(100, score);
  const label: RiskLabel = score >= 60 ? "high" : score >= 25 ? "medium" : "low";
  return { score, label };
}

export function policyToStatus(policy: ResultPolicy): string {
  return policy === "release"
    ? "auto_released"
    : policy === "hold_teacher"
      ? "hold_teacher"
      : "hold_admin";
}
