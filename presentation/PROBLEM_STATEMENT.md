# SecureAIExam — Problem Statement

## One-line
Build an end-to-end examination platform that makes a question-paper leak **cryptographically hard before the exam** and **forensically traceable after it** — eliminating every single point of failure across authoring, sealing, printing, transport and the exam center, while proving accountability with a **tamper-evident record**.

## Context
High-stakes national exams — NEET, UPSC, and Board exams — are repeatedly disrupted by question-paper leaks that affect millions of students. A paper passes through many hands (setters, printers, transporters, district vaults, center staff, invigilators), and **every stage is a single point of failure**:

- A single insider with the key or with physical access can leak the paper before the exam.
- Once a paper is out, there is **no reliable way to identify which copy leaked or who last held it**.
- Custody is tracked on paper registers that are slow, forgeable, and blind to theft in real time.
- Logs that can be edited give no defensible account of what happened.

The result is cancelled exams, eroded public trust, and lost years for honest aspirants.

## Why partial fixes are not enough
| Point solution | Why it fails alone |
|---|---|
| Encryption only | One admin still holds the key — that is one point of failure. |
| Watermarking only | Identifies a leak after the fact, but does nothing to prevent early access. |
| Manual custody registers | Forgeable, slow, and provide no real-time alerting on a missing copy. |
| Editable audit logs | Worthless the moment an insider rewrites history to hide involvement. |

No existing system combines **prevention**, **detection**, and **accountability** in one workflow.

## The challenge (what a solution must do)
1. **No single person can open a paper.** Access must require independent cooperation of at least two parties (dual control), so no lone insider — including the server operator — can read the paper alone.
2. **Every printed copy must have a unique, recoverable identity** — both a verifiable visible mark (to reject forgeries) and an invisible one (to trace a leaked copy from a photo).
3. **Physical custody must be tracked in real time**, with an instant, high-priority alert the moment a copy goes missing or a checkpoint is skipped.
4. **Accountability must be undeniable** — an append-only, tamper-evident record of every sensitive action that breaks visibly if edited.
5. **It must run at national-exam scale** on the devices staff already carry, and degrade gracefully if a component is offline.

## Success criteria
A leak should be **hard to commit** (dual-control prevention), **impossible to hide** (real-time custody + tamper-proof audit), and **trivial to trace** (per-copy forensic fingerprinting) — engineered together, not bolted on.

## Scope (this build)
Roles for Teacher, Paper Setter, Admin, and Center/Invigilator; question intake (manual + AI PDF import); compose → seal → co-sign → print ceremony; per-copy QR + fingerprint minting; center provisioning, copy allocation, and QR scan-in; pre-exam reconciliation sweep; real-time alerts, chain-of-custody feed, and a hash-chained audit log.
