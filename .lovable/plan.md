## Admin-Controlled Anti-Cheating System

Ek complete anti-cheating layer test flow me add karenge. Saari security rules **sirf admin** control karega — students/teachers change nahi kar sakte.

---

### 1. Database (1 migration)

**New table: `exam_security_settings`** (singleton row, admin-only write)
- `fullscreen_required` bool
- `tab_switch_limit` int (0 = unlimited log only, N = auto submit after N)
- `camera_required` bool, `camera_snapshot_interval_sec` int
- `mic_monitoring` bool
- `ai_behavior_tracking` bool
- `randomize_questions` bool, `randomize_options` bool
- `per_question_timer_sec` int (0 = off)
- `allow_skip` bool
- `block_copy_paste` bool, `block_screenshot` bool
- `warning_limit` int
- `auto_action` enum: `flag` | `auto_submit` | `lock`
- `result_policy_low` / `medium` / `high` enum: `release` | `hold_teacher` | `hold_admin`

**New table: `exam_security_events`** (append-only per attempt)
- `attempt_id`, `student_id`, `test_id`
- `event_type`: `tab_switch` | `fullscreen_exit` | `copy` | `paste` | `right_click` | `screenshot` | `face_missing` | `multi_face` | `noise` | `ai_suspicion` | `snapshot`
- `severity`: low/med/high
- `payload` jsonb (snapshot url, duration, etc.)
- `created_at`

**Extend `test_attempts`:**
- `warnings_count` int
- `risk_score` int (0-100)
- `risk_label` text (low/medium/high)
- `result_status` text (auto_released / hold_teacher / hold_admin / disqualified)
- `snapshots` jsonb[] (storage paths)

**Storage bucket:** `exam-snapshots` (private, admin read).

RLS + GRANTs as per rules.

---

### 2. Client library: `src/lib/exam-security.ts`

Ek reusable hook `useExamSecurity(attemptId, settings)` jo handle kare:
- Fullscreen request + `fullscreenchange` listener
- `visibilitychange` + `blur` tab-switch detection
- `contextmenu`, `copy`, `paste`, `cut` blockers
- Keyboard listeners for PrintScreen / Ctrl+P / Ctrl+S
- Camera stream + periodic `canvas.toBlob` → upload to `exam-snapshots`
- Optional face-detection using browser `FaceDetector` API (fallback: brightness check for "face missing")
- Mic `AnalyserNode` RMS threshold for noise flag
- AI behavior: track per-question time, flag if <2s avg or identical timing pattern
- Warning counter with toast + auto-submit hook when limit reached
- Sends events via `logSecurityEvent(attemptId, type, payload)`

---

### 3. Student test page (`src/routes/student.test.$id.tsx`)

- Load `exam_security_settings` before start
- Pre-test permission gate: camera/mic prompts if enabled, fullscreen button
- Mount `useExamSecurity` during attempt
- Apply randomization based on settings (questions + options shuffle with seed = attempt_id)
- Per-question timer bar if enabled; auto-advance
- Disable "skip / go back" if `allow_skip=false`
- On auto-submit trigger from security hook → submit with reason
- Compute `risk_score` client-side (sanity) but recompute server-side on submit

---

### 4. Server function: `finalizeAttemptSecurity`

`createServerFn` with `requireSupabaseAuth`:
- Reads all events for attempt, computes risk_score/label
- Applies admin `result_policy_*` → sets `result_status`
- Returns whether result is visible to student

Student result page respects `result_status` (shows "Under review" if held).

---

### 5. Admin pages

**`/teacher/exam-security`** (new route)
- Full settings form (all toggles above) — one card per section with clear Hindi/English labels
- Save via upsert to singleton row
- "Reset to defaults" button

**`/teacher/exam-security/live`** (new route)
- Realtime dashboard using Supabase realtime on `exam_security_events` + `test_attempts`
- Table of active attempts: student, test, tab switches, camera alerts, AI score, time elapsed
- Actions per row: **Force submit**, **Pause**, **Disqualify**
- Filter by risk

**`/teacher/exam-security/reports/[attempt_id]`**
- Full event timeline
- Snapshot gallery
- Risk breakdown
- Approve / Reject result buttons
- PDF export

Add sidebar links in `admin-shell`: "Exam Security", "Live Monitor".

---

### 6. Teacher (non-admin) limits

Teachers see reports and can *suggest* action (adds a note), but settings form is admin-role gated via `has_role(auth.uid(),'admin')`. Existing `user_roles` used.

---

### Out of scope this turn
- Real ML face-recognition (browser FaceDetector only; not on Safari — graceful fallback)
- Parent view, certificates, streaks, payment gateway
- Native mobile app lockdown (browser-only enforcement)

---

### Technical notes
- Fullscreen enforcement is best-effort on browsers; document as such in T&C
- Snapshots uploaded as JPEGs (~50KB) at admin-set interval; auto-cleanup after 90 days via cron (later)
- All security events logged even if `auto_action=flag` so admin has full audit trail
