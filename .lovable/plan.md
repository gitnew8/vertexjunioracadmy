## AI Exam Platform — Vertex Junior Academy

Admin AI se question paper banayega, students apni class ke tests dekh kar attempt karenge. Existing admin gate (`/teacher`) aur student login (`/student`) reuse karenge.

### 1. Database (one migration)

**`tests`**
- `id`, `title`, `student_class`, `subject`, `chapter`, `language` (en/hi/bilingual)
- `time_limit_min` int, `total_marks` int
- `status` text ('draft' | 'published'), `created_at`

**`test_questions`**
- `id`, `test_id` → tests (cascade)
- `q_no` int, `section` text (MCQ/TrueFalse/OneWord/Short)
- `question` text, `options` jsonb (null for non-MCQ)
- `correct_answer` text, `marks` int default 1
- `difficulty` text

**`test_attempts`**
- `id`, `test_id`, `student_id` → students
- `started_at`, `submitted_at`, `time_taken_sec`
- `score` int, `total` int
- `answers` jsonb ({q_id: answer})
- unique(test_id, student_id) — ek baar hi submit

RLS: public read/write (admin gate + student gate already UI-side; same pattern as fees/payments).

### 2. AI Integration

TanStack server route `/api/public/generate-questions` (POST) — Lovable AI Gateway via `@ai-sdk/openai-compatible`, model `google/gemini-3-flash-preview`, structured output (Zod schema) for question array. Inputs: class, subject, chapter, count, types[], difficulty, language. Returns clean JSON questions ready to insert.

LOVABLE_API_KEY already present.

### 3. Admin Routes (under `/teacher`)

- **`/teacher/tests`** — list tests, filter by class/subject, "Create with AI" button, edit/publish/delete, export PDF
- **`/teacher/tests/$id`** — edit questions (regenerate single Q, edit text/answer, add/remove), set timer/marks, publish toggle
- **`/teacher/tests/$id/results`** — student attempts table, per-question analysis (% correct), Excel/PDF export

Sidebar: add "Exams" entry.

### 4. Student Routes

- **`/student`** — naya "My Tests" section: published tests for student's class (not yet attempted vs completed with score)
- **`/student/test/$id`** — read-only test taking:
  - Timer countdown
  - Sectioned questions, MCQ radio / TF radio / text input
  - "Submit" → calculate score server-side via server fn, save attempt
  - Result screen: score, correct/wrong per question, time taken
  - One-time submit (check existing attempt before allow)

### 5. PDF Export
Reuse jsPDF + autoTable in `src/lib/export.ts`. Add `exportTestPaperPDF(test, questions)` (clean printable) and `exportResultsPDF(test, attempts)`.

### 6. Files to create/edit
- migration (3 tables + RLS)
- `src/lib/ai-gateway.ts` (provider helper)
- `src/routes/api/generate-questions.ts` (server route)
- `src/lib/exam-export.ts` (test paper + results PDF)
- `src/routes/teacher.tests.tsx` (list + create dialog)
- `src/routes/teacher.tests.$id.tsx` (editor)
- `src/routes/teacher.tests.$id.results.tsx`
- `src/routes/student.test.$id.tsx` (taking + result)
- edit `src/routes/student.tsx` (My Tests section)
- edit `src/components/admin-shell.tsx` (sidebar "Exams" link)

### 7. Out of scope
- No proctoring/anti-cheat
- No question bank reuse across tests
- No re-attempt (one submission only)

### Build order
1. Migration
2. AI server route + provider helper
3. Admin tests list + AI generate dialog
4. Test editor + publish
5. Student test-taking + result
6. Results analytics + PDF exports
