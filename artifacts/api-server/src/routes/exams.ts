import { Router, type Request, type Response, type NextFunction } from "express";
import { supabaseAdmin } from "../lib/supabaseAdmin";

const router = Router();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

interface StudentRequest extends Request {
  studentId?: string;
  schoolId?: string;
}

/**
 * Online exam questions (and their correct answers) must never reach the
 * browser except through this server, which strips `correct_answer` before
 * responding. RLS alone can't do that (it's row-level, not column-level),
 * and question_bank's own SELECT policy is staff-only precisely so a
 * student can't just query it directly. Grading also happens here, never
 * client-side, so a tampered request body can't award marks.
 */
async function requireStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ") || !SUPABASE_URL) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);

  let userRes: globalThis.Response;
  try {
    userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not verify your session right now. Please try again shortly." });
    return;
  }
  if (userRes.status === 401 || userRes.status === 403) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  if (!userRes.ok) {
    res.status(503).json({ error: "Could not verify your session right now. Please try again shortly." });
    return;
  }
  const user = (await userRes.json().catch(() => ({}))) as { id?: string };
  if (!user.id) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  let profRes: globalThis.Response;
  try {
    profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,school_id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not load your account right now. Please try again shortly." });
    return;
  }
  const profiles = (await profRes.json().catch(() => [])) as { role?: string; school_id?: string }[];
  const role = profiles[0]?.role ?? "";
  const schoolId = profiles[0]?.school_id ?? null;
  if (!schoolId || role !== "student") {
    res.status(403).json({ error: "Only students can take exams." });
    return;
  }

  (req as StudentRequest).studentId = user.id;
  (req as StudentRequest).schoolId = schoolId;
  next();
}

const LETTERS = ["A", "B", "C", "D"] as const;
type Letter = (typeof LETTERS)[number];
const LETTER_TO_FIELD: Record<Letter, "option_a" | "option_b" | "option_c" | "option_d"> = {
  A: "option_a",
  B: "option_b",
  C: "option_c",
  D: "option_d",
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface BankQuestion {
  id: string;
  question_text: string;
  question_type: "objective" | "theory";
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  marks: number;
}

function publicOptions(q: BankQuestion, order: string[]) {
  return order.map((letter) => ({ letter, text: q[LETTER_TO_FIELD[letter as Letter]] }));
}

function publicQuestion(
  q: BankQuestion,
  optionOrder: string[],
  extra?: { studentAnswer: string; isCorrect: boolean | null; marksAwarded: number | null; revealAnswer: boolean },
) {
  return {
    id: q.id,
    question_text: q.question_text,
    question_type: q.question_type,
    marks: q.marks,
    options: q.question_type === "objective" ? publicOptions(q, optionOrder) : [],
    student_answer: extra?.studentAnswer ?? "",
    is_correct: extra?.isCorrect ?? null,
    marks_awarded: extra?.marksAwarded ?? null,
    correct_answer: extra?.revealAnswer ? q.correct_answer : undefined,
  };
}

/**
 * Loads an attempt's questions joined back to question_bank, in sort order.
 * `revealAnswer` should only ever be true once the attempt is no longer
 * in_progress (submitted/graded) — the exam is over by then.
 */
async function loadAttemptQuestions(attemptId: string, revealAnswer: boolean) {
  const { data, error } = await supabaseAdmin!
    .from("online_exam_attempt_questions")
    .select(
      "question_id, sort_order, option_order, student_answer, is_correct, marks_awarded, question_bank(id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, marks)",
    )
    .eq("attempt_id", attemptId)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  return data
    .filter((row: any) => row.question_bank)
    .map((row: any) => {
      const q: BankQuestion = { ...row.question_bank, marks: Number(row.question_bank.marks) };
      return publicQuestion(q, (row.option_order as string[]) ?? LETTERS.slice(), {
        studentAnswer: row.student_answer ?? "",
        isCorrect: row.is_correct,
        marksAwarded: row.marks_awarded === null ? null : Number(row.marks_awarded),
        revealAnswer,
      });
    });
}

/** Grades every objective question in the attempt and updates its totals/status. Idempotent. */
async function gradeAndFinalize(attemptId: string, durationMinutes: number, startedAt: string) {
  const { data: rows } = await supabaseAdmin!
    .from("online_exam_attempt_questions")
    .select("id, question_type, marks, student_answer, question_bank(correct_answer)")
    .eq("attempt_id", attemptId);

  const questionRows = rows ?? [];
  let hasTheory = false;

  await Promise.all(
    questionRows.map((row: any) => {
      if (row.question_type !== "objective") {
        hasTheory = true;
        return Promise.resolve();
      }
      const correct = row.question_bank?.correct_answer ?? "";
      const isCorrect = !!row.student_answer && row.student_answer === correct;
      return supabaseAdmin!
        .from("online_exam_attempt_questions")
        .update({ is_correct: isCorrect, marks_awarded: isCorrect ? Number(row.marks) : 0 })
        .eq("id", row.id);
    }),
  );

  const objectiveScore = questionRows
    .filter((r: any) => r.question_type === "objective")
    .reduce((sum: number, r: any) => sum + (r.student_answer === r.question_bank?.correct_answer ? Number(r.marks) : 0), 0);

  const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  const timeTaken = Math.min(elapsedSeconds, durationMinutes * 60 + 300);

  const status = hasTheory ? "submitted" : "graded";
  const score = hasTheory ? null : objectiveScore;

  await supabaseAdmin!
    .from("online_exam_attempts")
    .update({
      status,
      objective_score: objectiveScore,
      theory_score: hasTheory ? null : 0,
      score,
      submitted_at: new Date().toISOString(),
      time_taken_seconds: timeTaken,
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId);

  return { status, score, objectiveScore, hasTheory, timeTaken };
}

router.post("/exams/:examId/start", requireStudent, async (req: Request, res: Response) => {
  const examId = String(req.params.examId);
  const studentId = (req as StudentRequest).studentId!;
  const schoolId = (req as StudentRequest).schoolId!;

  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: exam } = await supabaseAdmin
    .from("exams")
    .select("id, school_id, type, start_date, end_date")
    .eq("id", examId)
    .maybeSingle();

  if (!exam || exam.school_id !== schoolId || exam.type !== "online") {
    res.status(404).json({ error: "Online exam not found." });
    return;
  }

  const { data: settings } = await supabaseAdmin
    .from("online_exam_settings")
    .select("*")
    .eq("exam_id", examId)
    .maybeSingle();

  if (!settings || !settings.is_published) {
    res.status(403).json({ error: "This exam isn't published yet." });
    return;
  }

  const today = new Date().toISOString().split("T")[0];
  if (exam.start_date && today < exam.start_date) {
    res.status(403).json({ error: "This exam hasn't opened yet." });
    return;
  }
  if (exam.end_date && today > exam.end_date) {
    res.status(403).json({ error: "This exam has closed." });
    return;
  }

  const { data: existing } = await supabaseAdmin
    .from("online_exam_attempts")
    .select("id, status, started_at, duration_minutes, total_marks")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing && existing.status !== "in_progress") {
    res.status(409).json({ error: "You have already taken this exam." });
    return;
  }

  if (existing) {
    const questions = await loadAttemptQuestions(existing.id, false);
    res.json({ attempt: existing, questions });
    return;
  }

  let bankQuery = supabaseAdmin
    .from("question_bank")
    .select("id, question_text, question_type, option_a, option_b, option_c, option_d, correct_answer, marks")
    .eq("school_id", schoolId)
    .eq("is_active", true);
  if (settings.subject_id) bankQuery = bankQuery.eq("subject_id", settings.subject_id);
  if (settings.difficulty) bankQuery = bankQuery.eq("difficulty", settings.difficulty);

  const { data: bank } = await bankQuery;
  const pool = (bank ?? []) as BankQuestion[];

  if (pool.length === 0) {
    res.status(400).json({ error: "No questions in the bank match this exam's configuration yet." });
    return;
  }

  const ordered = settings.shuffle_questions ? shuffle(pool) : pool;
  const selected = ordered.slice(0, settings.question_count);
  const totalMarks = selected.reduce((sum, q) => sum + Number(q.marks), 0);
  const startedAt = new Date().toISOString();

  const { data: attempt, error: attemptErr } = await supabaseAdmin
    .from("online_exam_attempts")
    .insert({
      school_id: schoolId,
      exam_id: examId,
      student_id: studentId,
      status: "in_progress",
      started_at: startedAt,
      duration_minutes: settings.duration_minutes,
      total_marks: totalMarks,
    })
    .select("id, status, started_at, duration_minutes, total_marks")
    .single();

  if (attemptErr || !attempt) {
    req.log?.error?.(attemptErr);
    res.status(500).json({ error: "Could not start the exam. Please try again." });
    return;
  }

  const attemptQuestionRows = selected.map((q, index) => ({
    attempt_id: attempt.id,
    question_id: q.id,
    sort_order: index,
    question_type: q.question_type,
    option_order: q.question_type === "objective" ? (settings.shuffle_options ? shuffle(LETTERS.slice()) : LETTERS.slice()) : [],
    marks: q.marks,
  }));

  await supabaseAdmin.from("online_exam_attempt_questions").insert(attemptQuestionRows);

  const questions = selected.map((q, index) =>
    publicQuestion(q, attemptQuestionRows[index].option_order, {
      studentAnswer: "",
      isCorrect: null,
      marksAwarded: null,
      revealAnswer: false,
    }),
  );

  res.json({ attempt, questions });
});

router.get("/exams/:examId/attempt", requireStudent, async (req: Request, res: Response) => {
  const examId = String(req.params.examId);
  const studentId = (req as StudentRequest).studentId!;

  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: attempt } = await supabaseAdmin
    .from("online_exam_attempts")
    .select("id, status, started_at, duration_minutes, total_marks, objective_score, theory_score, score, submitted_at")
    .eq("exam_id", examId)
    .eq("student_id", studentId)
    .maybeSingle();

  if (!attempt) {
    res.status(404).json({ error: "You haven't started this exam yet." });
    return;
  }

  const questions = await loadAttemptQuestions(attempt.id, attempt.status !== "in_progress");
  res.json({ attempt, questions });
});

router.post("/exams/attempts/:attemptId/answer", requireStudent, async (req: Request, res: Response) => {
  const attemptId = String(req.params.attemptId);
  const studentId = (req as StudentRequest).studentId!;
  const { question_id, answer } = req.body as { question_id?: string; answer?: string };

  if (!supabaseAdmin || !question_id) {
    res.status(400).json({ error: "Missing question_id." });
    return;
  }

  const { data: attempt } = await supabaseAdmin
    .from("online_exam_attempts")
    .select("id, student_id, status, started_at, duration_minutes")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.student_id !== studentId) {
    res.status(404).json({ error: "Attempt not found." });
    return;
  }
  if (attempt.status !== "in_progress") {
    res.json({ status: attempt.status });
    return;
  }

  const elapsedSeconds = Math.floor((Date.now() - new Date(attempt.started_at).getTime()) / 1000);
  if (elapsedSeconds > attempt.duration_minutes * 60 + 60) {
    const result = await gradeAndFinalize(attemptId, attempt.duration_minutes, attempt.started_at);
    res.json({ timeExpired: true, ...result });
    return;
  }

  const { error } = await supabaseAdmin
    .from("online_exam_attempt_questions")
    .update({ student_answer: answer ?? "", answered_at: new Date().toISOString() })
    .eq("attempt_id", attemptId)
    .eq("question_id", question_id);

  if (error) {
    res.status(500).json({ error: "Could not save your answer." });
    return;
  }

  res.json({ saved: true });
});

router.post("/exams/attempts/:attemptId/submit", requireStudent, async (req: Request, res: Response) => {
  const attemptId = String(req.params.attemptId);
  const studentId = (req as StudentRequest).studentId!;

  if (!supabaseAdmin) {
    res.status(503).json({ error: "Server misconfigured." });
    return;
  }

  const { data: attempt } = await supabaseAdmin
    .from("online_exam_attempts")
    .select("id, student_id, status, started_at, duration_minutes, total_marks")
    .eq("id", attemptId)
    .maybeSingle();

  if (!attempt || attempt.student_id !== studentId) {
    res.status(404).json({ error: "Attempt not found." });
    return;
  }

  if (attempt.status !== "in_progress") {
    res.json({ status: attempt.status, score: null, alreadySubmitted: true });
    return;
  }

  const result = await gradeAndFinalize(attemptId, attempt.duration_minutes, attempt.started_at);
  res.json({ ...result, totalMarks: Number(attempt.total_marks) });
});

export default router;
