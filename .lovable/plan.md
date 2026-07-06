## More Test – More Gift System

Ek complete reward + pricing + T&C system add karenge existing exam platform ke upar. Sab kuch admin controlled hoga.

---

### 1. Database (ek migration)

**`tests` table me naye columns:**
- `price` numeric default 0 (admin manual set kare)
- `discount_price` numeric nullable (₹99 → ₹49 wala)
- `is_free` boolean default true

**`reward_rules`** (admin editable gift ladder)
- `id`, `title` (e.g. "Brand New Pen")
- `min_tests` int (10, 25, 50, 100)
- `min_score_percent` int (90, 85, 80, 75)
- `cycle_days` int default 30
- `stock` int
- `image_url` text nullable
- `active` boolean
- `sort_order` int

**`reward_claims`** (student ne kaunsa gift claim/earn kiya)
- `id`, `student_id`, `rule_id`
- `status` text ('pending' | 'approved' | 'rejected' | 'delivered')
- `earned_at`, `approved_at`, `notes`
- unique(student_id, rule_id) — ek cycle me ek gift

**`app_settings`** (T&C aur global config)
- `key` text primary key, `value` jsonb
- seed: `terms_and_conditions`, `reward_system_enabled`

RLS: existing pattern (public read/write, UI-side gating).

---

### 2. Admin Panel — naye pages

**`/teacher/rewards`**
- Gift ladder table: add/edit/delete rules (title, min tests, min %, stock, image, cycle days)
- Reward system on/off toggle
- T&C editor (rich textarea, saves to `app_settings`)
- Pending claims table → Approve / Reject / Mark Delivered
- Export claims (Excel/PDF)

**`/teacher/tests` update**
- Har test ke saath price fields: Free toggle, Price ₹, Discount ₹
- List view me price column

---

### 3. Student Side

**`/student` dashboard me naya "Rewards Progress" card:**
- Total tests attempted (last N days)
- Best score, average score
- Progress bars for each active reward rule (e.g. "7 / 10 tests · avg 92%")
- Next unlockable gift preview with image
- Claimed rewards history
- Auto-award logic: jab conditions match ho, `reward_claims` me `pending` insert ho (unique constraint duplicates rokega)

**Test list me price badge:**
- "FREE" badge ya "₹49 ~~₹99~~"
- Test start karne se pehle price + T&C modal

**T&C page/modal:**
- Reward rules ke saath auto show
- Admin ne set kiya wo text

---

### 4. Auto Reward Logic

Server function `checkAndAwardRewards(student_id)`:
- Har active rule ke liye, cycle window (last `cycle_days`) me distinct tests count nikaale
- Average % >= `min_score_percent` aur count >= `min_tests` ho
- Agar existing claim nahi hai → insert `pending`
- Student dashboard load pe aur test submit ke baad chalega

---

### 5. Files

Naye:
- migration
- `src/lib/rewards.functions.ts` (checkAndAwardRewards, listRules, claims CRUD)
- `src/routes/teacher.rewards.tsx`
- `src/components/reward-progress-card.tsx`
- `src/components/test-price-badge.tsx`

Edit:
- `src/routes/teacher.tests.tsx` (price fields in create/edit dialog)
- `src/routes/teacher.tests.$id.tsx` (price fields)
- `src/routes/student.tsx` (Rewards Progress section + price badges)
- `src/routes/student.test.$id.tsx` (price + T&C modal before start, auto-check after submit)
- `src/components/admin-shell.tsx` (sidebar "Rewards" link)

---

### 6. Out of scope (baad me add kar sakte hain)
- Leaderboard, streak, coins/bonus, parent login, certificate auto-gen — plan me mention hain but is turn me nahi banayenge (bahut bada ho jayega). Confirm karo agar chahiye toh next turn me add kar dunga.
- Payment gateway integration — abhi sirf price display hoga, actual online payment nahi.

---

Build order: migration → admin rewards page → student progress + price display → auto-award logic.

Kya main is plan pe implement karu, ya pehle koi cheez adjust karni hai (jaise leaderboard/certificate bhi include kare, ya payment gateway bhi)?