import { Router, type Request, type Response, type NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

const router = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (!SUPABASE_URL) {
    res.status(500).json({ error: "Server misconfigured: missing Supabase URL" });
    return;
  }
  const token = auth.slice(7);
  const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!userRes.ok) {
    res.status(401).json({ error: "Invalid or expired session" });
    return;
  }
  next();
}

async function parseFile(fileContent: string, fileType: string): Promise<string> {
  const buffer = Buffer.from(fileContent, "base64");

  if (fileType === "pdf") {
    const pdfParse = require("pdf-parse") as (
      buf: Buffer,
    ) => Promise<{ text: string }>;
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  if (fileType === "docx") {
    const mammoth = require("mammoth") as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>;
    };
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Unsupported file type");
}

router.post(
  "/extract-questions",
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { text, fileContent, fileType } = req.body as {
        text?: string;
        fileContent?: string;
        fileType?: string;
      };

      let rawText = text?.trim() ?? "";

      if (fileContent && fileType && fileType !== "text") {
        rawText = await parseFile(fileContent, fileType);
      }

      if (!rawText) {
        res.status(400).json({ error: "No text content provided" });
        return;
      }

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: `You are an expert educator processing exam materials. Your job is to extract EVERY question from the text and produce clean, well-structured records for a question bank.

## Classification
- **"objective"**: Any multiple-choice question with distinct options (A/B/C/D or 1/2/3/4 or i/ii/iii/iv). If choices exist, it is objective.
- **"theory"**: Essay, short-answer, fill-in-the-blank, structured, calculation, or any question that requires a written response.

## Extraction rules — handle ALL these formats:
1. **Numbered questions**: "1.", "1)", "Q1.", "Question 1", "i.", "(a)" — all are valid question starters.
2. **Answers included inline**: If a correct answer is marked (e.g. asterisk *, underline notation, bold, "(Ans: B)", "Answer: C", answer key), record it in correct_answer but do NOT include the answer marker in question_text.
3. **Answer keys at the end**: Match answers back to their questions (e.g. "1-B, 2-A, 3-D").
4. **Options with answers mixed in**: Extract options A/B/C/D cleanly — strip any "(correct)" or similar markers from the option text, but set correct_answer.
5. **Multi-part theory questions**: If a question has sub-parts (a, b, c) that are themselves questions, create one entry per sub-part. If sub-parts are just parts of one question (e.g. "calculate x and y"), keep as one theory question.
6. **Explanations or model answers after questions**: IGNORE them — do not include explanations, notes, or sample answers in question_text.
7. **Section headers**: Ignore headers like "Section A", "Part I", "Instructions" etc. — do not create question entries for them.
8. **Fill-in-the-blank**: Treat as theory. Represent the blank as "______" in question_text.
9. **Diagrams referenced**: If a question references a figure/diagram you cannot see, keep the question text as-is.
10. **Incomplete or cut-off questions**: Include them if they are clearly a question, mark difficulty as "medium".

## Field rules
- **question_text**: The question only — clean, no answer markers, no "Q1." prefix numbers.
- **option_a/b/c/d**: For objective only. Clean option text without letter prefix (e.g. store "Lagos" not "A. Lagos"). Empty string "" for theory.
- **correct_answer**: "A", "B", "C", or "D" if identifiable, otherwise "".
- **topic**: Infer from context (subject area, chapter, theme). Use "" if unclear.
- **difficulty**: "easy" | "medium" | "hard" — infer from complexity.
- **marks**: 1 for objective; 2–20 for theory based on expected depth.

Return ONLY a valid JSON array. No markdown fences, no explanation, no preamble:
[
  {
    "question_text": "What is the capital of Nigeria?",
    "question_type": "objective",
    "option_a": "Lagos",
    "option_b": "Abuja",
    "option_c": "Kano",
    "option_d": "Port Harcourt",
    "correct_answer": "B",
    "topic": "Geography",
    "difficulty": "easy",
    "marks": 1
  },
  {
    "question_text": "Explain the process of photosynthesis and state TWO factors that affect its rate.",
    "question_type": "theory",
    "option_a": "",
    "option_b": "",
    "option_c": "",
    "option_d": "",
    "correct_answer": "",
    "topic": "Biology",
    "difficulty": "medium",
    "marks": 8
  }
]

TEXT TO PROCESS:
${rawText.slice(0, 14000)}`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== "text") {
        throw new Error("Unexpected AI response type");
      }

      const raw = content.text.trim();

      // Try to extract a JSON array from the response — handles:
      // • bare array, • ```json fences, • extra prose before/after
      let questions: unknown[] = [];
      const jsonMatch = raw.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed)) questions = parsed;
        } catch {
          // fall through — questions stays []
        }
      }

      if (questions.length === 0) {
        // Give the caller a clear message; log the raw AI text for debugging
        console.warn("No questions extracted. AI response was:", raw.slice(0, 500));
        res.status(422).json({
          error:
            "No questions found in the pasted text. Make sure the content contains numbered or clearly structured questions.",
        });
        return;
      }

      res.json({ questions, count: questions.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("extract-questions error:", message);
      res.status(500).json({ error: message });
    }
  },
);

export default router;
