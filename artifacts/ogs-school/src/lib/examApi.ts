import { supabase } from './supabase';
import { apiUrl } from './apiUrl';
import type { OnlineExamAttempt, ExamAttemptQuestion } from './types';

async function authedFetch(path: string, init?: RequestInit) {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(apiUrl(path), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong. Please try again.');
  return body;
}

export interface AttemptSession {
  attempt: OnlineExamAttempt;
  questions: ExamAttemptQuestion[];
}

export function startExam(examId: string): Promise<AttemptSession> {
  return authedFetch(`/api/exams/${examId}/start`, { method: 'POST' });
}

export function getAttempt(examId: string): Promise<AttemptSession> {
  return authedFetch(`/api/exams/${examId}/attempt`);
}

export function saveAnswer(attemptId: string, questionId: string, answer: string) {
  return authedFetch(`/api/exams/attempts/${attemptId}/answer`, {
    method: 'POST',
    body: JSON.stringify({ question_id: questionId, answer }),
  });
}

export interface SubmitResult {
  status: 'submitted' | 'graded';
  score: number | null;
  totalMarks: number;
  hasTheory: boolean;
}

export function submitExam(attemptId: string): Promise<SubmitResult> {
  return authedFetch(`/api/exams/attempts/${attemptId}/submit`, { method: 'POST' });
}
