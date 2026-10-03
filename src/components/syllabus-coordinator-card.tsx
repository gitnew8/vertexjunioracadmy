import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurriculum, CUSTOM_CURRICULUM_KEY } from "@/lib/custom-curriculum";

export function SyllabusCoordinatorCard({ loginNumber, defaultClass }: { loginNumber: string; defaultClass: string }) {
  const [allowed, setAllowed] = useState(false);
  const cur = useCurriculum();
  const qc = useQueryClient();
  const [cls, setCls] = useState(defaultClass);
  const [subject, setSubject] = useState("");
  const [chapter, setChapter] = useState("");
  const [topics, setTopics] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase
      .from("students")
      .select("can_manage_curriculum")
      .eq("login_number", loginNumber)
      .maybeSingle()
      .then(({ data }) => setAllowed(!!data?.can_manage_curriculum));
  }, [loginNumber]);

  if (!allowed) return null;

  async function submit() {
    if (!cls || !subject.trim() || !chapter.trim()) return toast.error("Class, subject aur chapter bharein");
    setBusy(true);
    const { error } = await supabase.rpc("curriculum_student_add", {
      p_login: loginNumber,
      p_class: cls,
      p_subject: subject.trim(),
      p_chapter: chapter.trim(),
      p_topics: topics.split(/[,\n]/).map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Chapter jud gaya ✅ Dhanyavaad!");
    setChapter("");
    setTopics("");
    qc.invalidateQueries({ queryKey: CUSTOM_CURRICULUM_KEY });
  }

  const input = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm";
  return (
    <section className="mt-8 rounded-2xl border border-primary/30 bg-card p-5">
      <h2 className="font-semibold text-lg">📚 Syllabus Coordinator</h2>
      <p className="text-sm text-muted-foreground">Admin ne aapko chapters aur topics jodne ki anumati di hai.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <select className={input} value={cls} onChange={(e) => setCls(e.target.value)}>
          {cur.classes.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input className={input} list="syl-subjects" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
        <datalist id="syl-subjects">{cur.subjectsFor(cls).map((s) => <option key={s} value={s} />)}</datalist>
        <input className={input} placeholder="Chapter ka naam" value={chapter} onChange={(e) => setChapter(e.target.value)} />
        <input className={input} placeholder="Topics (comma se alag)" value={topics} onChange={(e) => setTopics(e.target.value)} />
      </div>
      <button onClick={submit} disabled={busy} className="mt-3 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold disabled:opacity-60">
        {busy ? "Saving…" : "Add Chapter"}
      </button>
    </section>
  );
}
