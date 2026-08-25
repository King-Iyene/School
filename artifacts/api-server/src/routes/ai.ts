import { Router, type Request, type Response, type NextFunction } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

// ── Auth: validate the Supabase session token and stash it for data queries ──
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
    res.status(503).json({ error: "The assistant is temporarily unavailable. Please try again shortly." });
    return;
  }
  const token = auth.slice(7);

  // Validate the session token upstream. Network/upstream failures should be a
  // 503 (try again), not a generic 500 — only a genuine invalid token is 401.
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
    req.log?.error?.({ status: userRes.status }, "auth: /auth/v1/user returned non-ok");
    res.status(503).json({ error: "Could not verify your session right now. Please try again shortly." });
    return;
  }
  const user = (await userRes.json().catch(() => ({}))) as { id?: string };
  if (!user.id) {
    res.status(401).json({ error: "Invalid session" });
    return;
  }

  // Staff-only: check the caller's profile role server-side. Also fetch the
  // caller's school_id here so write actions can be scoped server-side.
  let profRes: globalThis.Response;
  try {
    profRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${user.id}&select=role,school_id`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } },
    );
  } catch (e) {
    req.log?.error?.(e);
    res.status(503).json({ error: "Could not load your account right now. Please try again shortly." });
    return;
  }
  if (!profRes.ok) {
    req.log?.error?.({ status: profRes.status }, "auth: profiles lookup returned non-ok");
    res.status(503).json({ error: "Could not load your account right now. Please try again shortly." });
    return;
  }
  const profiles = (await profRes.json().catch(() => [])) as { role?: string; school_id?: string }[];
  const role = profiles[0]?.role ?? "";
  const schoolId = profiles[0]?.school_id ?? null;
  if (!STAFF_ROLES.has(role)) {
    res.status(403).json({ error: "The AI assistant is available to school staff only." });
    return;
  }

  const r = req as AuthedRequest;
  r.supabaseToken = token;
  r.userId = user.id;
  r.schoolId = schoolId;
  next();
}

interface AuthedRequest extends Request {
  supabaseToken?: string;
  userId?: string;
  schoolId?: string | null;
}

const STAFF_ROLES = new Set([
  "super_admin",
  "admin",
  "principal",
  "head_teacher",
  "teacher",
  "nur_prim_teacher",
  "accountant",
  "security_officer",
  "non_teaching_staff",
  "matron",
  "porter",
  "cleaner",
  "admin_support",
  "diocesan_official",
]);

// ── Simple per-user rate limit (in-memory): 15 requests per 5 minutes ────────
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 5 * 60 * 1000;
const usage = new Map<string, number[]>();
function rateLimited(userId: string): boolean {
  const now = Date.now();
  const arr = (usage.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (arr.length >= RATE_LIMIT) {
    usage.set(userId, arr);
    return true;
  }
  arr.push(now);
  usage.set(userId, arr);
  return false;
}

// ── Error helpers: log detail server-side, return short generic messages ─────
function logError(detail: unknown, msg: string): void {
  // pino logger isn't in scope here; fall back to console but keep it terse.
  // eslint-disable-next-line no-console
  console.error(`[ai] ${msg}`, detail);
}
function friendlyDbError(status: number): string {
  if (status === 401 || status === 403) {
    return "You don't have permission to do that, or your session expired.";
  }
  if (status === 409) return "That conflicts with existing data (possible duplicate).";
  if (status === 400 || status === 422) return "Some details were invalid and could not be saved.";
  return "The database request could not be completed. Please try again.";
}

// ── Read-only data access (RLS enforced via the caller's own token) ──────────
// Only these tables can be queried, and only via GET (no writes possible).
const ALLOWED_TABLES = new Set([
  "schools",
  "profiles",
  "prospective_students",
  "fee_structures",
  "fee_payments",
  "fees_collections",
  "fees_master",
  "fees_types",
  "requisitions",
  "student_attendance",
  "staff_attendance_records",
  "exams",
  "exam_marks_records",
  "grades",
  "result_compilations",
  "classes",
  "subjects",
  "admission_queries",
]);

const TABLE_GUIDE = `
Available tables (query via the query_table tool; column names as used by the app):
- schools: id, name, address, phone, email, motto, established_year
- profiles: id, school_id, role (super_admin|admin|principal|head_teacher|teacher|nur_prim_teacher|accountant|security_officer|non_teaching_staff|student|parent|...), first_name, last_name, email, phone, gender, date_of_birth, admission_number, staff_id, student_id, is_active, created_at. Students are profiles with role=student.
- prospective_students (admissions applicants): id, school_id, admission_number, first_name, last_name, gender, date_of_birth, email, phone, guardian fields, previous_school, status, exam/interview fields, created_at
- fee_structures: id, school_id, name, amount, class_level, term_id, academic_year_id, due_date, is_mandatory
- fee_payments: id, student_id, fee_structure_id, school_id, amount_paid, payment_date, payment_method, receipt_number, status
- fees_collections: student_id, fees_master_id, payment_date, amount fields, receipt_no
- fees_master: amount, due_date, fees_types; fees_types: fee type names
- requisitions: id, school_id, title, description, amount, status (pending|approved|rejected|disbursed|retired|reimbursed), items, date_needed, created_at
- student_attendance: student_id, class_id, date, status (present|absent|late|excused)
- staff_attendance_records: staff attendance
- exams: id, name, start_date, end_date
- exam_marks_records: student_id, subject_id, exam_name_id, ca1, ca2, ca3, exam, is_absent
- grades: student_id, class_id, subject_id, term_id, academic_year_id, ca1_score, ca2_score, ca3_score, exam_score, total_score, grade, remark
- result_compilations: compiled results
- classes, subjects: school class/subject definitions
- admission_queries: admission enquiries
`;

const ACTION_GUIDE = `
You can also PROPOSE a small set of write actions using the propose_action tool. You NEVER perform writes yourself — you only propose them, and the action is created ONLY after the staff member taps Approve in the app.

Supported action types and their required fields:
- create_announcement: title, content. Optional: audience (one of: all, student, teacher, parent, accountant, principal — default "all"), is_pinned (boolean), publish_date (YYYY-MM-DD).
- create_admission_query (a walk-in / phone admission enquiry lead): student_name. Optional: phone, email, address, source, class_interested, description, next_follow_up_date (YYYY-MM-DD).
- create_prospective_student (an admissions applicant record): first_name, last_name, class_applying_for, guardian_name, guardian_phone, guardian_email. Optional: gender, date_of_birth (YYYY-MM-DD), phone, address, state_of_origin, current_school, student_type (day|boarding), guardian_relationship, guardian_occupation, emergency_contact.
- create_requisition (a spending/purchase request): title, amount (number, Naira). Optional: description, date_needed (YYYY-MM-DD).

Rules for actions:
1. Gather ALL required fields from the user first. If any required field is missing, ASK for it — do not guess or invent values.
2. Do NOT set school_id, author_id, requester_id, status, or ids — the system fills those from the signed-in staff member.
3. When you have the fields, call propose_action ONCE with the type and a payload of the fields you collected. Then tell the user, in one short sentence, that you've prepared the action and it needs their approval to be created.
4. Never claim the record was created. It is only created after the user approves.`;

const SYSTEM_PROMPT = `You are the AI assistant inside the Okrika Grammar School management portal, used by school staff.
You answer questions and produce analysis from live school data, and you can propose a small set of write actions for the user to approve.

How to work:
1. Use the query_table tool to fetch data. Data access is governed by the requesting user's own permissions (row-level security) — if a query returns no rows, the data may not exist OR the user may not have access; say so honestly.
2. Prefer targeted queries: select only needed columns, use filters, use count when the user asks "how many".
3. For analysis, fetch the data then compute summaries yourself (totals, averages, trends, groupings).
4. Amounts are in Nigerian Naira (₦). Dates: present as DD Month YYYY.
5. To create data, use the propose_action tool (see below). If the user asks for something not in the supported action list, explain you can't do that yet and point them to the relevant portal page.
6. Never fabricate data. If you could not retrieve something, say so.

Style — be brief and direct:
- Lead with the answer (the number, name, or fact) in the first line. Add at most 2-3 supporting details.
- No greetings, no filler ("Great question!", "I'd be happy to..."), no restating the question, no closing offers ("Let me know if...").
- Use a short bullet list or compact table only when there are multiple items to show. One-fact answers should be one or two sentences.
${TABLE_GUIDE}
${ACTION_GUIDE}`;

const queryTool: Anthropic.Tool = {
  name: "query_table",
  description:
    "Run a read-only query against a school database table (PostgREST). Returns JSON rows. Use PostgREST filter syntax for the filters object, e.g. {\"role\": \"eq.student\", \"created_at\": \"gte.2026-01-01\", \"status\": \"in.(pending,approved)\"}.",
  input_schema: {
    type: "object",
    properties: {
      table: { type: "string", description: "Table name (must be one of the allowed tables)" },
      select: { type: "string", description: "Comma-separated columns, may include embedded resources per PostgREST. Default '*'." },
      filters: {
        type: "object",
        description: "Map of column -> PostgREST operator expression (eq., neq., gt., gte., lt., lte., like., ilike., in., is.)",
        additionalProperties: { type: "string" },
      },
      order: { type: "string", description: "e.g. 'created_at.desc'" },
      limit: { type: "number", description: "Max rows (default 100, max 500)" },
      count_only: { type: "boolean", description: "If true, return only the exact row count, no rows." },
    },
    required: ["table"],
  },
};

// ── Write actions (two-phase: propose → user approves → execute) ─────────────
// The model may only PROPOSE actions. Each proposal is validated against a
// strict per-action schema; only allow-listed fields survive. Execution happens
// in a separate endpoint after the user approves, re-validated server-side.

type ActionType =
  | "create_announcement"
  | "create_admission_query"
  | "create_prospective_student"
  | "create_requisition";

interface FieldSpec {
  type: "string" | "number" | "boolean" | "date" | "enum";
  required?: boolean;
  values?: string[]; // for enum
  maxLen?: number;
}

interface ActionSpec {
  table: string;
  label: string; // human-friendly noun for summaries
  fields: Record<string, FieldSpec>;
}

const ACTION_SPECS: Record<ActionType, ActionSpec> = {
  create_announcement: {
    table: "announcements",
    label: "announcement",
    fields: {
      title: { type: "string", required: true, maxLen: 200 },
      content: { type: "string", required: true, maxLen: 5000 },
      audience: { type: "enum", values: ["all", "student", "teacher", "parent", "accountant", "principal"], maxLen: 20 },
      is_pinned: { type: "boolean" },
      publish_date: { type: "date" },
    },
  },
  create_admission_query: {
    table: "admission_queries",
    label: "admission enquiry",
    fields: {
      student_name: { type: "string", required: true, maxLen: 200 },
      phone: { type: "string", maxLen: 40 },
      email: { type: "string", maxLen: 200 },
      address: { type: "string", maxLen: 500 },
      source: { type: "string", maxLen: 100 },
      class_interested: { type: "string", maxLen: 100 },
      description: { type: "string", maxLen: 2000 },
      next_follow_up_date: { type: "date" },
    },
  },
  create_prospective_student: {
    table: "prospective_students",
    label: "applicant",
    fields: {
      first_name: { type: "string", required: true, maxLen: 100 },
      last_name: { type: "string", required: true, maxLen: 100 },
      class_applying_for: { type: "string", required: true, maxLen: 100 },
      guardian_name: { type: "string", required: true, maxLen: 200 },
      guardian_phone: { type: "string", required: true, maxLen: 40 },
      guardian_email: { type: "string", required: true, maxLen: 200 },
      gender: { type: "enum", values: ["male", "female", "Male", "Female"], maxLen: 10 },
      date_of_birth: { type: "date" },
      phone: { type: "string", maxLen: 40 },
      address: { type: "string", maxLen: 500 },
      state_of_origin: { type: "string", maxLen: 100 },
      current_school: { type: "string", maxLen: 200 },
      student_type: { type: "enum", values: ["day", "boarding"], maxLen: 10 },
      guardian_relationship: { type: "string", maxLen: 50 },
      guardian_occupation: { type: "string", maxLen: 100 },
      emergency_contact: { type: "string", maxLen: 100 },
    },
  },
  create_requisition: {
    table: "requisitions",
    label: "requisition",
    fields: {
      title: { type: "string", required: true, maxLen: 200 },
      amount: { type: "number", required: true },
      description: { type: "string", maxLen: 2000 },
      date_needed: { type: "date" },
    },
  },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate a raw payload against an action spec. Returns a cleaned payload with
 * ONLY allow-listed fields, or an error message. Never trust extra keys.
 */
function validateAction(
  type: string,
  raw: unknown,
): { ok: true; type: ActionType; clean: Record<string, unknown> } | { ok: false; error: string } {
  if (!(type in ACTION_SPECS)) {
    return { ok: false, error: `Unknown action type '${type}'.` };
  }
  const actionType = type as ActionType;
  const spec = ACTION_SPECS[actionType];
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "Action payload must be an object." };
  }
  const input = raw as Record<string, unknown>;
  const clean: Record<string, unknown> = {};

  for (const [key, fs] of Object.entries(spec.fields)) {
    const val = input[key];
    const missing = val === undefined || val === null || val === "";
    if (missing) {
      if (fs.required) return { ok: false, error: `Missing required field '${key}'.` };
      continue;
    }
    switch (fs.type) {
      case "string": {
        if (typeof val !== "string") return { ok: false, error: `Field '${key}' must be text.` };
        const s = val.trim();
        if (fs.maxLen && s.length > fs.maxLen) return { ok: false, error: `Field '${key}' is too long.` };
        if (s) clean[key] = s;
        break;
      }
      case "enum": {
        if (typeof val !== "string" || !(fs.values ?? []).includes(val)) {
          return { ok: false, error: `Field '${key}' must be one of: ${(fs.values ?? []).join(", ")}.` };
        }
        clean[key] = val;
        break;
      }
      case "number": {
        const n = typeof val === "number" ? val : Number(val);
        if (!Number.isFinite(n)) return { ok: false, error: `Field '${key}' must be a number.` };
        if (n < 0) return { ok: false, error: `Field '${key}' cannot be negative.` };
        clean[key] = n;
        break;
      }
      case "boolean": {
        clean[key] = val === true || val === "true";
        break;
      }
      case "date": {
        if (typeof val !== "string" || !DATE_RE.test(val)) {
          return { ok: false, error: `Field '${key}' must be a date (YYYY-MM-DD).` };
        }
        clean[key] = val;
        break;
      }
    }
  }
  return { ok: true, type: actionType, clean };
}

/** Build a short human-readable summary of what will be created. */
function summarizeAction(type: ActionType, clean: Record<string, unknown>): string {
  const spec = ACTION_SPECS[type];
  switch (type) {
    case "create_announcement":
      return `Post announcement "${clean.title}" to ${clean.audience ?? "all"}.`;
    case "create_admission_query":
      return `Log admission enquiry for ${clean.student_name}.`;
    case "create_prospective_student":
      return `Create applicant record for ${clean.first_name} ${clean.last_name} (${clean.class_applying_for}).`;
    case "create_requisition":
      return `Create requisition "${clean.title}" for ₦${Number(clean.amount).toLocaleString()}.`;
    default:
      return `Create ${spec.label}.`;
  }
}

/**
 * Map a validated payload onto the actual DB columns, injecting server-side
 * fields (school_id, author_id, etc.). The model NEVER supplies these.
 */
function buildInsertRow(
  type: ActionType,
  clean: Record<string, unknown>,
  ctx: { userId: string; schoolId: string | null },
): Record<string, unknown> {
  switch (type) {
    case "create_announcement": {
      const audience = (clean.audience as string) ?? "all";
      const target_roles =
        audience === "all"
          ? ["student", "teacher", "principal", "parent", "accountant"]
          : [audience];
      return {
        title: clean.title,
        content: clean.content,
        target_roles,
        is_pinned: clean.is_pinned === true,
        publish_date: clean.publish_date ?? null,
        school_id: ctx.schoolId,
        author_id: ctx.userId,
      };
    }
    case "create_admission_query":
      return {
        student_name: clean.student_name,
        phone: clean.phone ?? null,
        email: clean.email ?? null,
        address: clean.address ?? null,
        source: clean.source ?? null,
        class_interested: clean.class_interested ?? null,
        description: clean.description ?? null,
        status: "new",
        next_follow_up_date: clean.next_follow_up_date ?? null,
        school_id: ctx.schoolId,
      };
    case "create_prospective_student":
      return {
        first_name: clean.first_name,
        last_name: clean.last_name,
        class_applying_for: clean.class_applying_for,
        guardian_name: clean.guardian_name,
        guardian_phone: clean.guardian_phone,
        guardian_email: clean.guardian_email,
        gender: clean.gender ?? null,
        date_of_birth: clean.date_of_birth ?? null,
        phone: clean.phone ?? null,
        address: clean.address ?? null,
        state_of_origin: clean.state_of_origin ?? null,
        current_school: clean.current_school ?? null,
        student_type: clean.student_type ?? null,
        guardian_relationship: clean.guardian_relationship ?? null,
        guardian_occupation: clean.guardian_occupation ?? null,
        emergency_contact: clean.emergency_contact ?? null,
        medical_conditions: "None",
        status: "pending",
        school_id: ctx.schoolId,
      };
    case "create_requisition":
      return {
        title: clean.title,
        description: clean.description ?? null,
        amount: clean.amount,
        date_needed: clean.date_needed ?? null,
        status: "pending",
        school_id: ctx.schoolId,
        requester_id: ctx.userId,
      };
  }
}

const proposeActionTool: Anthropic.Tool = {
  name: "propose_action",
  description:
    "Propose a write action for the staff member to approve. This does NOT create anything — it only prepares a proposal that the user must approve in the app. Gather all required fields first. Do not set school_id, author_id, requester_id, status, or ids; the system fills those in.",
  input_schema: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["create_announcement", "create_admission_query", "create_prospective_student", "create_requisition"],
        description: "The kind of record to create.",
      },
      payload: {
        type: "object",
        description: "The collected field values for the action (see the action guide for required fields).",
        additionalProperties: true,
      },
    },
    required: ["type", "payload"],
  },
};

async function runQuery(
  input: {
    table: string;
    select?: string;
    filters?: Record<string, string>;
    order?: string;
    limit?: number;
    count_only?: boolean;
  },
  userToken: string,
): Promise<string> {
  const { table, select, filters, order, limit, count_only } = input;
  if (!ALLOWED_TABLES.has(table)) {
    return JSON.stringify({ error: `Table '${table}' is not queryable. Allowed: ${[...ALLOWED_TABLES].join(", ")}` });
  }
  // Allow only a safe character set for select/order (column names, embedded
  // resources, count/aggregate syntax) before handing to PostgREST.
  const SELECT_RE = /^[a-zA-Z0-9_.,()* ]{1,500}$/;
  const ORDER_RE = /^[a-zA-Z0-9_.,() ]{1,200}$/;
  if (select && !SELECT_RE.test(select)) {
    return JSON.stringify({ error: "Invalid 'select' value. Use only column names separated by commas." });
  }
  if (order && !ORDER_RE.test(order)) {
    return JSON.stringify({ error: "Invalid 'order' value. Use e.g. 'created_at.desc'." });
  }
  const params = new URLSearchParams();
  params.set("select", count_only ? "id" : (select || "*"));
  if (filters) {
    for (const [col, expr] of Object.entries(filters)) {
      if (/^[a-zA-Z0-9_]+$/.test(col) && typeof expr === "string") params.append(col, expr);
    }
  }
  if (order) params.set("order", order);
  params.set("limit", String(Math.min(Math.max(1, limit ?? 100), 500)));

  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${userToken}`,
  };
  if (count_only) headers["Prefer"] = "count=exact";

  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params.toString()}`, { headers });
  if (!resp.ok) {
    // Log the raw PostgREST body server-side, but never echo it to the model/user.
    const body = await resp.text().catch(() => "");
    logError({ table, status: resp.status, body: body.slice(0, 1000) }, "query_table failed");
    return JSON.stringify({ error: friendlyDbError(resp.status) });
  }
  if (count_only) {
    const range = resp.headers.get("content-range"); // e.g. "0-24/3021"
    const count = range?.split("/")[1] ?? "unknown";
    return JSON.stringify({ count: Number(count) || count });
  }
  const rows = (await resp.json()) as unknown[];
  let text = JSON.stringify(rows);
  if (text.length > 30000) {
    text = JSON.stringify({ note: "Result truncated; refine your query (fewer columns / tighter filters).", rows: rows.slice(0, 50) });
  }
  return text;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

router.post("/ai/chat", requireAuth, async (req: Request, res: Response) => {
  try {
    const { messages } = req.body as { messages?: ChatMessage[] };
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "messages array required" });
      return;
    }
    if (JSON.stringify(messages).length > 60000) {
      res.status(413).json({ error: "Conversation too long. Clear the chat and try again." });
      return;
    }
    const r = req as Request & { supabaseToken?: string; userId?: string };
    const token = r.supabaseToken!;
    if (rateLimited(r.userId ?? "anon")) {
      res.status(429).json({ error: "You're sending questions too quickly. Please wait a few minutes." });
      return;
    }

    // Keep only the last 20 turns to bound cost
    const history: Anthropic.MessageParam[] = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).slice(0, 8000),
    }));

    const convo: Anthropic.MessageParam[] = [...history];
    let finalText = "";
    let proposedAction: {
      id: string;
      type: ActionType;
      summary: string;
      payload: Record<string, unknown>;
    } | null = null;

    for (let step = 0; step < 8; step++) {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [queryTool, proposeActionTool],
        messages: convo,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text",
      );

      if (toolUses.length === 0 || response.stop_reason !== "tool_use") {
        finalText = textBlocks.map((b) => b.text).join("\n");
        break;
      }

      convo.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        let result: string;
        if (tu.name === "propose_action") {
          const input = tu.input as { type?: string; payload?: unknown };
          const v = validateAction(input.type ?? "", input.payload);
          if (!v.ok) {
            result = JSON.stringify({ error: v.error, hint: "Fix the fields and propose again, or ask the user for missing details." });
          } else {
            // Prepare a single proposal to return to the client. The model does
            // not execute it — the user must approve.
            proposedAction = {
              id: `act_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
              type: v.type,
              summary: summarizeAction(v.type, v.clean),
              payload: v.clean,
            };
            registerPendingAction(proposedAction.id, r.userId!, v.type, v.clean);
            result = JSON.stringify({
              status: "proposed",
              note: "The action has been prepared and is awaiting the user's approval in the app. Tell the user it needs their approval; do not claim it was created.",
            });
          }
        } else {
          try {
            result = await runQuery(tu.input as Parameters<typeof runQuery>[0], token);
          } catch (e) {
            logError(e, "query_table threw");
            result = JSON.stringify({ error: "The data query could not be completed." });
          }
        }
        results.push({ type: "tool_result", tool_use_id: tu.id, content: result });
      }
      convo.push({ role: "user", content: results });

      // Once an action is proposed, get one closing message then stop.
      if (proposedAction) {
        const closing = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 500,
          system: SYSTEM_PROMPT,
          tools: [queryTool, proposeActionTool],
          messages: convo,
        });
        finalText = closing.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("\n");
        break;
      }
    }

    if (!finalText) {
      finalText = proposedAction
        ? "I've prepared this action — approve it below to create the record."
        : "I ran out of steps while gathering data for that question. Try asking something more specific.";
    }
    res.json(proposedAction ? { reply: finalText, proposedAction } : { reply: finalText });
  } catch (err) {
    req.log?.error?.(err);
    res.status(500).json({ error: "AI request failed. Please try again." });
  }
});

// ── Execute an approved action (idempotent) ──────────────────────────────────
// Proposals are registered server-side at propose time and claimed atomically
// (single-process) on execution, so a client cannot forge payloads or replay
// an approved action. Claimed = removed before insert; re-registered on a
// failed insert so the user can retry.
interface PendingAction {
  userId: string;
  type: ActionType;
  payload: Record<string, unknown>;
  expiresAt: number;
}
const pendingActions = new Map<string, PendingAction>();
const PENDING_TTL_MS = 30 * 60 * 1000;
const PENDING_CAP = 2000;

function registerPendingAction(id: string, userId: string, type: ActionType, payload: Record<string, unknown>) {
  const now = Date.now();
  for (const [k, p] of pendingActions) if (p.expiresAt < now) pendingActions.delete(k);
  if (pendingActions.size >= PENDING_CAP) {
    const oldest = pendingActions.keys().next().value;
    if (oldest) pendingActions.delete(oldest);
  }
  pendingActions.set(id, { userId, type, payload, expiresAt: now + PENDING_TTL_MS });
}

const executedActions = new Set<string>();
const EXECUTED_CAP = 5000;

router.post("/ai/execute-action", requireAuth, async (req: Request, res: Response) => {
  try {
    const r = req as AuthedRequest;
    const token = r.supabaseToken!;
    const body = req.body as { id?: unknown };
    const id = typeof body.id === "string" ? body.id : "";

    if (!id || id.length > 100) {
      res.status(400).json({ error: "A valid action id is required." });
      return;
    }
    if (executedActions.has(id)) {
      res.status(409).json({ error: "This action has already been carried out." });
      return;
    }

    // Only server-registered proposals may execute — the client sends just the
    // id; type and payload come from what the model proposed and we validated.
    const pending = pendingActions.get(id);
    if (!pending || pending.expiresAt < Date.now() || pending.userId !== r.userId) {
      res.status(410).json({ error: "This action is no longer available. Ask the assistant to prepare it again." });
      return;
    }
    pendingActions.delete(id); // claim before inserting — prevents double-submit

    // Re-validate the stored payload server-side (defense in depth).
    const v = validateAction(pending.type, pending.payload);
    if (!v.ok) {
      res.status(400).json({ error: v.error });
      return;
    }
    if (!r.schoolId) {
      res.status(400).json({ error: "Your account is not linked to a school, so this action can't be saved." });
      return;
    }

    const row = buildInsertRow(v.type, v.clean, { userId: r.userId!, schoolId: r.schoolId });
    const spec = ACTION_SPECS[v.type];

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/${spec.table}`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(row),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => "");
      logError({ table: spec.table, type: v.type, status: resp.status, body: errBody.slice(0, 1000) }, "execute-action insert failed");
      // Re-register so the user can retry after a failed insert.
      registerPendingAction(id, pending.userId, pending.type, pending.payload);
      res.status(resp.status === 401 || resp.status === 403 ? 403 : 400).json({ error: friendlyDbError(resp.status) });
      return;
    }

    // Mark executed (idempotency). Bound the set size.
    if (executedActions.size >= EXECUTED_CAP) executedActions.clear();
    executedActions.add(id);

    res.json({ success: true, message: `Done — the ${spec.label} was created.` });
  } catch (err) {
    logError(err, "execute-action threw");
    res.status(500).json({ error: "The action could not be completed. Please try again." });
  }
});

export default router;
