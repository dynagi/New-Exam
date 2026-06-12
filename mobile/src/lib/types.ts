export type Role = 'teacher' | 'paper_setter' | 'admin' | 'invigilator';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export type QuestionStatus = 'submitted' | 'approved' | 'used';
export type QuestionType = 'mcq' | 'theoretical';
export type QuestionSource = 'manual' | 'pdf';

export interface Question {
  id: string;
  teacher_id: string;
  exam_id: string | null;
  subject: string;
  topic: string | null;
  difficulty: 'easy' | 'medium' | 'hard';
  question_type: QuestionType;
  marks: number;
  source: QuestionSource;
  body: string;
  options: string[];
  /** null for theoretical questions (no answer key). */
  correct_index: number | null;
  status: QuestionStatus;
  created_at: string;
  exam?: { name: string } | null;
}

/** A question parsed from a PDF by the NLP service, before it's saved. */
export interface ExtractedQuestion {
  question_type: QuestionType;
  body: string;
  options: string[];
  correct_index: number | null;
  marks: number;
  subject?: string | null;
  topic?: string | null;
  difficulty?: 'easy' | 'medium' | 'hard';
}

export type PaperStatus =
  | 'draft'
  | 'sealed'
  | 'sealed_dual'
  | 'printed'
  | 'distributed'
  | 'completed';

export interface Paper {
  id: string;
  title: string;
  subject: string;
  setter_id: string;
  exam_id: string | null;
  status: PaperStatus;
  question_count: number;
  sealed_at: string | null;
  cosigned_at: string | null;
  printed_at: string | null;
  created_at: string;
  setter?: { full_name: string } | null;
  exam?: { name: string } | null;
}

export type CopyStatus =
  | 'printed'
  | 'in_transit'
  | 'at_center'
  | 'delivered'
  | 'missing'
  | 'leaked';

export interface PaperCopy {
  id: string;
  paper_id: string;
  copy_number: number;
  qr_payload: string;
  fingerprint_hash: string;
  fingerprint_method: string;
  current_location: string;
  status: CopyStatus;
  center_id: string | null;
  scanned_at: string | null;
  scanned_by: string | null;
  created_at: string;
  paper?: { title: string } | null;
}

export interface ExamCenter {
  id: string;
  exam_id: string;
  slot_id: string | null;
  name: string;
  code: string;
  starts_at: string;
  reconciled_at: string | null;
  auth_user_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface ExamSlot {
  id: string;
  exam_id: string;
  label: string;
  slot_no: number;
  start_at: string;
  end_at: string;
  duration_min: number;
  created_at: string;
}

export interface CustodyEvent {
  id: string;
  copy_id: string;
  event_type: CopyStatus;
  location: string;
  note: string | null;
  actor_id: string | null;
  prev_hash: string | null;
  hash: string | null;
  created_at: string;
  copy?: { copy_number: number; paper_id: string } | null;
}

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface AlertRow {
  id: string;
  severity: AlertSeverity;
  type: string;
  message: string;
  paper_id: string | null;
  copy_id: string | null;
  acknowledged: boolean;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  prev_hash: string | null;
  hash: string | null;
  created_at: string;
}

/** A question as it appears inside a decrypted paper at print time. */
export interface PaperQuestionContent {
  question_type: QuestionType;
  body: string;
  options: string[];
  correct_index: number | null;
  marks: number;
  subject?: string | null;
  topic?: string | null;
  difficulty?: string | null;
}

export interface PrintedCopy {
  id: string;
  copy_number: number;
  qr_payload: string;
}

/** Returned by the print ceremony — everything needed to render & print. */
export interface PrintResult {
  ok: boolean;
  status: string;
  copies: number;
  location: string;
  paper: {
    id: string;
    title: string;
    subject: string;
    exam_name?: string | null;
    total_marks: number;
    questions: PaperQuestionContent[];
  };
  copyList: PrintedCopy[];
}

export interface Exam {
  id: string;
  name: string;
  exam_date: string;
  duration_min: number;
  status: string;
  paper_id: string | null;
  created_by: string;
  created_at: string;
}

export const ROLE_LABEL: Record<Role, string> = {
  teacher: 'Teacher',
  paper_setter: 'Paper Setter',
  admin: 'Admin',
  invigilator: 'Invigilator',
};
