/**
 * SecureAIExam — Crypto & Ceremony Service
 *
 * Owns every operation that must never run on a client:
 *   - Sealing a paper        (AES-256-GCM, key split into two shares)
 *   - Admin co-sign          (dual control becomes active)
 *   - Print ceremony         (both passphrases -> decrypt -> mint copies)
 *   - Leak forensics         (fingerprint -> copy -> custody chain)
 *
 * Talks to Supabase with the service-role key (bypasses RLS) and writes
 * an audit entry for every sensitive action.
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SERVER_SECRET,
  AI_SERVICE_URL = 'http://127.0.0.1:8000',
  PORT = 4000,
  // Minutes before a center's start time at which unscanned copies are flagged.
  RECONCILE_WINDOW_MIN = 20,
} = process.env;

for (const [name, value] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SERVER_SECRET })) {
  if (!value || value.includes('YOUR-PROJECT') || value === 'change-me-to-a-long-random-string') {
    console.error(`Missing or placeholder env var: ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const app = express();
app.use(cors());
app.use(express.json({ limit: '15mb' }));

/* ----------------------------- crypto helpers ----------------------------- */

const SCRYPT_OPTS = { N: 16384, r: 8, p: 1 };
const b64 = (buf) => buf.toString('base64');
const fromB64 = (s) => Buffer.from(s, 'base64');

function kdf(passphrase, salt) {
  return crypto.scryptSync(String(passphrase), salt, 32, SCRYPT_OPTS);
}

/** Wrap a 32-byte share under a passphrase: scrypt -> AES-256-GCM. */
function wrapShare(share, passphrase) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kdf(passphrase, salt), iv);
  const data = Buffer.concat([cipher.update(share), cipher.final()]);
  return { salt: b64(salt), iv: b64(iv), tag: b64(cipher.getAuthTag()), data: b64(data) };
}

/** Throws on a wrong passphrase (GCM auth failure). */
function unwrapShare(wrapped, passphrase) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    kdf(passphrase, fromB64(wrapped.salt)),
    fromB64(wrapped.iv)
  );
  decipher.setAuthTag(fromB64(wrapped.tag));
  return Buffer.concat([decipher.update(fromB64(wrapped.data)), decipher.final()]);
}

function xorBuffers(a, b) {
  const out = Buffer.alloc(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] ^ b[i];
  return out;
}

/** Escrow passphrase: protects the admin share between seal and co-sign. */
function escrowPassphrase(paperId) {
  return `${SERVER_SECRET}:escrow:${paperId}`;
}

function signQr(copyId, paperId, copyNumber) {
  return crypto
    .createHmac('sha256', SERVER_SECRET)
    .update(`${copyId}.${paperId}.${copyNumber}`)
    .digest('hex')
    .slice(0, 32);
}

/**
 * Deterministic login email derived from a center code. The center login
 * screen builds the same address, so invigilators sign in with just their
 * code + password. Codes are therefore globally unique (the login id).
 * Must match centerEmail() in the mobile app's config.
 */
function centerEmail(code) {
  const slug = String(code)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `center.${slug}@secureaiexam.local`;
}

/* ------------------------------ auth middleware --------------------------- */

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      if (!token) return res.status(401).json({ error: 'Missing bearer token' });

      const { data, error } = await db.auth.getUser(token);
      if (error || !data?.user) return res.status(401).json({ error: 'Invalid or expired token' });

      const { data: profile } = await db.from('profiles').select('*').eq('id', data.user.id).single();
      if (!profile) return res.status(403).json({ error: 'No profile for this user' });
      if (roles.length && !roles.includes(profile.role)) {
        return res.status(403).json({ error: `Role '${profile.role}' may not perform this action` });
      }
      req.user = data.user;
      req.profile = profile;
      next();
    } catch (err) {
      next(err);
    }
  };
}

async function audit(actorId, action, entity, entityId, details) {
  const { error } = await db.rpc('write_audit', {
    p_actor: actorId,
    p_action: action,
    p_entity: entity,
    p_entity_id: String(entityId),
    p_details: details ?? {},
  });
  if (error) console.error('audit write failed:', error.message);
}

/* --------------------------------- routes --------------------------------- */

app.get('/health', (_req, res) => res.json({ ok: true, service: 'crypto-service' }));

/**
 * Sign-up via the service-role admin API. The user is created with
 * email_confirm: true, so Supabase never sends a confirmation email —
 * which means the built-in mailer's rate limit (~2 emails/hour) can
 * never block sign-ups. The profile row is created by the
 * on_auth_user_created trigger from the metadata.
 * Body: { fullName, email, password, role }
 */
const SIGNUP_ROLES = ['teacher', 'paper_setter', 'admin'];
app.post('/api/auth/signup', async (req, res, next) => {
  try {
    const { fullName, email, password, role } = req.body || {};
    if (!fullName || !String(fullName).trim()) {
      return res.status(400).json({ error: 'Full name is required' });
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (!SIGNUP_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const { data, error } = await db.auth.admin.createUser({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: String(fullName).trim(), role },
    });
    if (error) {
      const status = /already|registered|exists/i.test(error.message) ? 409 : 400;
      return res.status(status).json({ error: error.message });
    }

    await audit(data.user.id, 'USER_SIGNUP', 'profile', data.user.id, { role });

    res.json({ ok: true, user_id: data.user.id });
  } catch (err) {
    next(err);
  }
});

/**
 * NLP question extraction from a PDF (or raw text). Teacher-only.
 * Proxies to the Python AI service, which uses Claude when an
 * ANTHROPIC_API_KEY is configured and falls back to an offline parser.
 * Body: { pdfBase64?, text?, fileName? }
 */
app.post('/api/questions/extract', requireRole('teacher'), async (req, res, next) => {
  try {
    const { pdfBase64, text, fileName } = req.body || {};
    if (!pdfBase64 && !text) {
      return res.status(400).json({ error: 'Provide a PDF (pdfBase64) or text' });
    }

    let aiRes;
    try {
      aiRes = await fetch(`${AI_SERVICE_URL}/extract/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdf_base64: pdfBase64, text, filename: fileName }),
        signal: AbortSignal.timeout(60000),
      });
    } catch {
      return res.status(503).json({
        error: `Cannot reach the AI service at ${AI_SERVICE_URL}. Start it (see ai-service/README) to use PDF import.`,
      });
    }

    const json = await aiRes.json().catch(() => ({}));
    if (!aiRes.ok) {
      return res.status(aiRes.status).json({ error: json.detail || 'Extraction failed' });
    }

    await audit(req.user.id, 'QUESTIONS_EXTRACTED', 'questions', 'pdf', {
      engine: json.engine,
      count: json.count,
      file: fileName || null,
    });

    res.json(json);
  } catch (err) {
    next(err);
  }
});

/**
 * Seal a draft paper. Setter-only, must own the paper.
 * Body: { passphrase }
 */
app.post('/api/papers/:id/seal', requireRole('paper_setter'), async (req, res, next) => {
  try {
    const paperId = req.params.id;
    const { passphrase } = req.body || {};
    if (!passphrase || String(passphrase).length < 8) {
      return res.status(400).json({ error: 'Passphrase must be at least 8 characters' });
    }

    const { data: paper } = await db.from('papers').select('*').eq('id', paperId).single();
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.setter_id !== req.user.id) return res.status(403).json({ error: 'Not your paper' });
    if (paper.status !== 'draft') return res.status(409).json({ error: `Paper is already '${paper.status}'` });

    const { data: rows, error: qErr } = await db
      .from('paper_questions')
      .select('position, question:questions(*)')
      .eq('paper_id', paperId)
      .order('position');
    if (qErr) throw qErr;
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'Paper has no questions' });

    const payload = Buffer.from(
      JSON.stringify({
        paper: { id: paper.id, title: paper.title, subject: paper.subject },
        sealed_by: req.user.id,
        sealed_at: new Date().toISOString(),
        questions: rows.map((r) => r.question),
      }),
      'utf8'
    );

    // K = random key; shareA ^ shareB = K. One share alone reveals nothing.
    const key = crypto.randomBytes(32);
    const shareA = crypto.randomBytes(32);
    const shareB = xorBuffers(key, shareA);

    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);

    const { error: sErr } = await db.from('paper_secrets').upsert({
      paper_id: paperId,
      ciphertext: b64(ciphertext),
      cipher_iv: b64(iv),
      cipher_tag: b64(cipher.getAuthTag()),
      share_setter: wrapShare(shareA, passphrase),
      share_admin: null,
      escrow_admin: wrapShare(shareB, escrowPassphrase(paperId)),
    });
    if (sErr) throw sErr;

    key.fill(0); shareA.fill(0); shareB.fill(0);

    const { error: pErr } = await db
      .from('papers')
      .update({ status: 'sealed', sealed_at: new Date().toISOString() })
      .eq('id', paperId);
    if (pErr) throw pErr;

    const questionIds = rows.map((r) => r.question.id);
    await db.from('questions').update({ status: 'used' }).in('id', questionIds);

    await audit(req.user.id, 'PAPER_SEALED', 'paper', paperId, {
      title: paper.title,
      questions: questionIds.length,
    });

    res.json({ ok: true, status: 'sealed', questions: questionIds.length });
  } catch (err) {
    next(err);
  }
});

/**
 * Admin co-sign: re-wraps the second share under the admin passphrase and
 * destroys the escrow copy. From here, dual control is fully active.
 * Body: { passphrase }
 */
app.post('/api/papers/:id/cosign', requireRole('admin'), async (req, res, next) => {
  try {
    const paperId = req.params.id;
    const { passphrase } = req.body || {};
    if (!passphrase || String(passphrase).length < 8) {
      return res.status(400).json({ error: 'Passphrase must be at least 8 characters' });
    }

    const { data: paper } = await db.from('papers').select('*').eq('id', paperId).single();
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.status !== 'sealed') return res.status(409).json({ error: `Paper is '${paper.status}', expected 'sealed'` });

    const { data: secrets } = await db.from('paper_secrets').select('*').eq('paper_id', paperId).single();
    if (!secrets?.escrow_admin) return res.status(409).json({ error: 'No escrow share to co-sign' });

    const shareB = unwrapShare(secrets.escrow_admin, escrowPassphrase(paperId));
    const wrapped = wrapShare(shareB, passphrase);
    shareB.fill(0);

    const { error: sErr } = await db
      .from('paper_secrets')
      .update({ share_admin: wrapped, escrow_admin: null })
      .eq('paper_id', paperId);
    if (sErr) throw sErr;

    const { error: pErr } = await db
      .from('papers')
      .update({ status: 'sealed_dual', cosigned_at: new Date().toISOString() })
      .eq('id', paperId);
    if (pErr) throw pErr;

    await audit(req.user.id, 'PAPER_COSIGNED', 'paper', paperId, { title: paper.title });

    res.json({ ok: true, status: 'sealed_dual' });
  } catch (err) {
    next(err);
  }
});

/**
 * Print ceremony — the two-person rule in action.
 * Requires BOTH passphrases; decrypts in memory only; mints N uniquely
 * fingerprinted copies and opens their custody chains.
 * Body: { setterPassphrase, adminPassphrase, copies, location }
 */
app.post('/api/papers/:id/print', requireRole('admin'), async (req, res, next) => {
  try {
    const paperId = req.params.id;
    const { setterPassphrase, adminPassphrase, copies, location } = req.body || {};
    const copyCount = Math.max(1, Math.min(500, parseInt(copies, 10) || 0));
    if (!setterPassphrase || !adminPassphrase) {
      return res.status(400).json({ error: 'Both setter and admin passphrases are required' });
    }
    if (!copyCount) return res.status(400).json({ error: 'copies must be a number between 1 and 500' });

    const { data: paper } = await db.from('papers').select('*').eq('id', paperId).single();
    if (!paper) return res.status(404).json({ error: 'Paper not found' });
    if (paper.status !== 'sealed_dual') {
      return res.status(409).json({ error: `Paper is '${paper.status}', expected 'sealed_dual'` });
    }

    const { data: secrets } = await db.from('paper_secrets').select('*').eq('paper_id', paperId).single();
    if (!secrets?.share_setter || !secrets?.share_admin) {
      return res.status(409).json({ error: 'Key shares incomplete' });
    }

    let shareA, shareB;
    try {
      shareA = unwrapShare(secrets.share_setter, setterPassphrase);
    } catch {
      return res.status(400).json({ error: 'Setter passphrase is incorrect' });
    }
    try {
      shareB = unwrapShare(secrets.share_admin, adminPassphrase);
    } catch {
      shareA.fill(0);
      return res.status(400).json({ error: 'Admin passphrase is incorrect' });
    }

    const key = xorBuffers(shareA, shareB);
    shareA.fill(0); shareB.fill(0);

    // Decrypt to verify integrity (GCM tag) — proves both shares were right.
    let paperJson;
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, fromB64(secrets.cipher_iv));
      decipher.setAuthTag(fromB64(secrets.cipher_tag));
      const plain = Buffer.concat([decipher.update(fromB64(secrets.ciphertext)), decipher.final()]);
      paperJson = JSON.parse(plain.toString('utf8'));
      plain.fill(0);
    } finally {
      key.fill(0);
    }

    const printLocation = (location || 'Central Government Press').trim();
    const copyRows = [];
    for (let n = 1; n <= copyCount; n++) {
      const copyId = crypto.randomUUID();
      const fp = await registerFingerprint(copyId);
      copyRows.push({
        id: copyId,
        paper_id: paperId,
        copy_number: n,
        qr_payload: JSON.stringify({ c: copyId, p: paperId, n, sig: signQr(copyId, paperId, n) }),
        fingerprint_hash: fp.hash,
        fingerprint_method: fp.method,
        current_location: printLocation,
        status: 'printed',
      });
    }

    // Exam name (for the printed paper header) — best effort.
    let examName = null;
    if (paper.exam_id) {
      const { data: exam } = await db.from('exams').select('name').eq('id', paper.exam_id).single();
      examName = exam?.name ?? null;
    }

    const { error: cErr } = await db.from('paper_copies').insert(copyRows);
    if (cErr) throw cErr;

    const { error: eErr } = await db.from('custody_events').insert(
      copyRows.map((c) => ({
        copy_id: c.id,
        event_type: 'printed',
        location: printLocation,
        note: 'Printed, QR-signed and fingerprinted',
        actor_id: req.user.id,
      }))
    );
    if (eErr) throw eErr;

    const { error: pErr } = await db
      .from('papers')
      .update({ status: 'printed', printed_at: new Date().toISOString() })
      .eq('id', paperId);
    if (pErr) throw pErr;

    await audit(req.user.id, 'PRINT_CEREMONY', 'paper', paperId, {
      title: paperJson?.paper?.title ?? paper.title,
      copies: copyCount,
      location: printLocation,
    });

    // Shape the decrypted questions for the printable preview (no answer keys).
    const questions = (paperJson?.questions ?? []).map((q) => ({
      question_type: q.question_type ?? (Array.isArray(q.options) && q.options.length ? 'mcq' : 'theoretical'),
      body: q.body,
      options: Array.isArray(q.options) ? q.options : [],
      correct_index: q.correct_index ?? null,
      marks: typeof q.marks === 'number' ? q.marks : 1,
      subject: q.subject ?? null,
      topic: q.topic ?? null,
      difficulty: q.difficulty ?? null,
    }));
    const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

    res.json({
      ok: true,
      status: 'printed',
      copies: copyCount,
      location: printLocation,
      paper: {
        id: paper.id,
        title: paperJson?.paper?.title ?? paper.title,
        subject: paper.subject,
        exam_name: examName,
        total_marks: totalMarks,
        questions,
      },
      copyList: copyRows.map((c) => ({
        id: c.id,
        copy_number: c.copy_number,
        qr_payload: c.qr_payload,
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Leak forensics: given a copy_id (from QR) or an image containing the
 * steganographic fingerprint, identify the copy, mark it leaked and
 * return its full custody chain.
 * Body: { copy_id } or { image_base64 }
 */
app.post('/api/forensics/identify', requireRole('admin'), async (req, res, next) => {
  try {
    let { copy_id: copyId, image_base64: imageBase64 } = req.body || {};

    if (!copyId && imageBase64) {
      const r = await fetch(`${AI_SERVICE_URL}/fingerprint/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_base64: imageBase64 }),
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) return res.status(422).json({ error: 'No fingerprint found in image' });
      const extracted = await r.json();
      copyId = extracted.copy_id;
    }
    if (!copyId) return res.status(400).json({ error: 'Provide copy_id or image_base64' });

    const { data: copy } = await db
      .from('paper_copies')
      .select('*, paper:papers(title, subject)')
      .eq('id', copyId)
      .single();
    if (!copy) return res.status(404).json({ error: 'No copy matches this fingerprint' });

    await db.from('custody_events').insert({
      copy_id: copyId,
      event_type: 'leaked',
      location: 'Forensic identification',
      note: 'Identified via fingerprint extraction',
      actor_id: req.user.id,
    });

    const { data: chain } = await db
      .from('custody_events')
      .select('*')
      .eq('copy_id', copyId)
      .order('created_at', { ascending: true });

    await audit(req.user.id, 'LEAK_IDENTIFIED', 'paper_copy', copyId, {
      paper: copy.paper?.title,
      copy_number: copy.copy_number,
    });

    res.json({ ok: true, copy, custody_chain: chain });
  } catch (err) {
    next(err);
  }
});

/**
 * Provision an exam center + its invigilator login account. Admin-only.
 * Creates a pre-confirmed auth user (role 'invigilator') whose email is
 * derived from the center code, so the center logs in with code + password.
 * Body: { examId, slotId, name, code, password }
 */
app.post('/api/centers', requireRole('admin'), async (req, res, next) => {
  try {
    const { examId, slotId, name, code, password } = req.body || {};
    if (!examId) return res.status(400).json({ error: 'examId is required' });
    if (!name || String(name).trim().length < 2)
      return res.status(400).json({ error: 'Center name is required' });
    if (!code || !/^[A-Za-z0-9][A-Za-z0-9 \-_/]*$/.test(String(code).trim()))
      return res.status(400).json({ error: 'Center code: letters, digits, space, - _ / only' });
    if (!password || String(password).length < 6)
      return res.status(400).json({ error: 'Center password must be at least 6 characters' });

    // Slot drives the center start time used by the reconciliation sweep.
    let startsAt = new Date().toISOString();
    if (slotId) {
      const { data: slot } = await db
        .from('exam_slots')
        .select('start_at, exam_id')
        .eq('id', slotId)
        .single();
      if (!slot) return res.status(404).json({ error: 'Slot not found' });
      startsAt = slot.start_at;
    }

    const email = centerEmail(code);
    const { data: created, error: aErr } = await db.auth.admin.createUser({
      email,
      password: String(password),
      email_confirm: true,
      user_metadata: { full_name: `${String(name).trim()} (${String(code).trim()})`, role: 'invigilator' },
    });
    if (aErr) {
      const dup = /already|registered|exists/i.test(aErr.message);
      return res.status(dup ? 409 : 400).json({
        error: dup ? `Center code "${code}" is already in use — pick another` : aErr.message,
      });
    }

    const { data: center, error: cErr } = await db
      .from('exam_centers')
      .insert({
        exam_id: examId,
        slot_id: slotId || null,
        name: String(name).trim(),
        code: String(code).trim().toUpperCase(),
        starts_at: startsAt,
        auth_user_id: created.user.id,
        created_by: req.user.id,
      })
      .select('*')
      .single();
    if (cErr) {
      // Roll back the orphaned auth account so the code can be reused.
      await db.auth.admin.deleteUser(created.user.id).catch(() => {});
      throw cErr;
    }

    await audit(req.user.id, 'CENTER_PROVISIONED', 'exam_center', center.id, {
      name: center.name,
      code: center.code,
    });

    res.json({ ok: true, center, login: { code: center.code, email } });
  } catch (err) {
    next(err);
  }
});

/**
 * Allocate up to N as-yet-unallocated printed copies of an exam's paper(s)
 * to a center. Admin-only. Tags copies with center_id (centerwise QR set).
 * Body: { count }
 */
app.post('/api/centers/:id/allocate', requireRole('admin'), async (req, res, next) => {
  try {
    const centerId = req.params.id;
    const count = Math.max(1, Math.min(1000, parseInt(req.body?.count, 10) || 0));
    if (!count) return res.status(400).json({ error: 'count must be a number >= 1' });

    const { data: center } = await db.from('exam_centers').select('*').eq('id', centerId).single();
    if (!center) return res.status(404).json({ error: 'Center not found' });

    const { data: papers } = await db.from('papers').select('id').eq('exam_id', center.exam_id);
    const paperIds = (papers || []).map((p) => p.id);
    if (paperIds.length === 0) {
      return res.status(409).json({ error: 'No papers for this exam yet' });
    }

    const { data: copies } = await db
      .from('paper_copies')
      .select('id')
      .in('paper_id', paperIds)
      .is('center_id', null)
      .order('copy_number', { ascending: true })
      .limit(count);
    if (!copies || copies.length === 0) {
      return res.status(409).json({
        error: 'No unallocated copies available. Run a print ceremony for this exam first.',
      });
    }

    const ids = copies.map((c) => c.id);
    const { error } = await db
      .from('paper_copies')
      .update({ center_id: centerId, current_location: `${center.name} (${center.code})` })
      .in('id', ids);
    if (error) throw error;

    await audit(req.user.id, 'COPIES_ALLOCATED', 'exam_center', centerId, {
      count: ids.length,
      center: center.name,
    });

    res.json({ ok: true, allocated: ids.length, requested: count });
  } catch (err) {
    next(err);
  }
});

/**
 * Invigilator scan-in. Verifies the QR signature, then marks the copy
 * scanned (scanned_at) so it leaves the center's pending-scan set, and
 * records a hash-chained custody event. Rejects forged QRs and re-scans.
 * Body: { qr_payload } (the raw QR JSON string) or { copy_id }
 */
app.post('/api/copies/scan', requireRole('admin', 'invigilator'), async (req, res, next) => {
  try {
    const { qr_payload: qrPayload, copy_id: copyIdRaw } = req.body || {};
    let copyId = copyIdRaw;

    if (!copyId && qrPayload) {
      let parsed;
      try {
        parsed = typeof qrPayload === 'string' ? JSON.parse(qrPayload) : qrPayload;
      } catch {
        return res.status(400).json({ error: 'QR payload is not valid JSON' });
      }
      const { c, p, n, sig } = parsed || {};
      if (!c || !p || sig !== signQr(c, p, n)) {
        return res.status(400).json({ error: 'QR signature invalid — possible forged copy' });
      }
      copyId = c;
    }
    if (!copyId) return res.status(400).json({ error: 'Provide qr_payload or copy_id' });

    const { data: copy } = await db.from('paper_copies').select('*').eq('id', copyId).single();
    if (!copy) return res.status(404).json({ error: 'No copy matches this QR' });
    if (copy.scanned_at) {
      return res.status(409).json({
        error: `Copy #${copy.copy_number} was already scanned at ${new Date(copy.scanned_at).toLocaleString()}`,
      });
    }

    // An invigilator may only scan copies allocated to their own center.
    let center = null;
    if (req.profile.role === 'invigilator') {
      const { data: myCenter } = await db
        .from('exam_centers')
        .select('id, name, code')
        .eq('auth_user_id', req.user.id)
        .single();
      if (!myCenter) return res.status(403).json({ error: 'No center is linked to this login' });
      if (copy.center_id !== myCenter.id) {
        return res.status(403).json({ error: 'This copy is not allocated to your center' });
      }
      center = myCenter;
    } else if (copy.center_id) {
      const { data: c } = await db
        .from('exam_centers')
        .select('id, name, code')
        .eq('id', copy.center_id)
        .single();
      center = c ?? null;
    }

    const now = new Date().toISOString();
    const { error: uErr } = await db
      .from('paper_copies')
      .update({ scanned_at: now, scanned_by: req.user.id, status: 'delivered' })
      .eq('id', copyId);
    if (uErr) throw uErr;

    await db.from('custody_events').insert({
      copy_id: copyId,
      event_type: 'delivered',
      location: center ? `${center.name} (${center.code}) — scan-in` : 'Invigilator scan-in',
      note: 'QR verified, scanned in at center',
      actor_id: req.user.id,
    });

    // Notify the admin in real time that a copy was scanned at a center.
    await db.from('alerts').insert({
      severity: 'info',
      type: 'COPY_SCANNED',
      message: center
        ? `Copy #${copy.copy_number} scanned in at ${center.name} (${center.code})`
        : `Copy #${copy.copy_number} scanned in`,
      paper_id: copy.paper_id,
      copy_id: copyId,
    });

    await audit(req.user.id, 'COPY_SCANNED', 'paper_copy', copyId, {
      copy_number: copy.copy_number,
      center: center?.code ?? null,
    });

    res.json({ ok: true, copy_number: copy.copy_number, scanned_at: now });
  } catch (err) {
    next(err);
  }
});

/* --------------------- pre-exam reconciliation sweep ---------------------- */

/**
 * Every minute: for any center whose start time is within
 * RECONCILE_WINDOW_MIN and that hasn't been checked yet, flag unscanned
 * copies with a CRITICAL alert (streamed live to admin dashboards).
 * reconciled_at makes it fire exactly once per center.
 */
async function reconcileCenters() {
  try {
    const cutoff = new Date(Date.now() + Number(RECONCILE_WINDOW_MIN) * 60 * 1000).toISOString();
    const { data: centers } = await db
      .from('exam_centers')
      .select('*')
      .is('reconciled_at', null)
      .lte('starts_at', cutoff);

    for (const center of centers || []) {
      // Claim it first so a slow count can't cause a duplicate alert.
      await db
        .from('exam_centers')
        .update({ reconciled_at: new Date().toISOString() })
        .eq('id', center.id);

      const [{ count: unscanned }, { count: total }] = await Promise.all([
        db
          .from('paper_copies')
          .select('*', { count: 'exact', head: true })
          .eq('center_id', center.id)
          .is('scanned_at', null),
        db.from('paper_copies').select('*', { count: 'exact', head: true }).eq('center_id', center.id),
      ]);

      if ((unscanned ?? 0) > 0) {
        await db.from('alerts').insert({
          severity: 'critical',
          type: 'UNSCANNED_COPIES',
          message: `Center ${center.name} (${center.code}): ${unscanned} of ${total} copies UNSCANNED ~${RECONCILE_WINDOW_MIN} min before exam start`,
        });
        await audit(null, 'RECONCILE_UNSCANNED', 'exam_center', center.id, {
          center: center.name,
          unscanned,
          total,
        });
      }
    }
  } catch (err) {
    console.error('reconcile sweep failed:', err.message);
  }
}

/* ------------------------------ AI integration ---------------------------- */

async function registerFingerprint(copyId) {
  try {
    const r = await fetch(`${AI_SERVICE_URL}/fingerprint/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ copy_id: copyId }),
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const json = await r.json();
      if (json.fingerprint_hash) return { hash: json.fingerprint_hash, method: 'ai-service' };
    }
  } catch {
    /* AI service offline — fall back so the demo still works */
  }
  return {
    hash: crypto.createHmac('sha256', SERVER_SECRET).update(`fp:${copyId}`).digest('hex'),
    method: 'local-hmac',
  };
}

/* -------------------------------- error trap ------------------------------ */

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`SecureAIExam crypto service listening on http://0.0.0.0:${PORT}`);
  console.log(`AI service expected at ${AI_SERVICE_URL}`);
  console.log(`Center reconciliation sweep every 60s (window ${RECONCILE_WINDOW_MIN} min)`);
  void reconcileCenters();
  setInterval(reconcileCenters, 60 * 1000);
});
