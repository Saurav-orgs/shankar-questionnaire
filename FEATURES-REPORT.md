# Spine Patient Filter — Features Report

**Pre-consultation triage platform for a senior spine surgeon's clinic**
Status: POC feature-complete except AI summary generation · 7 August 2026

---

## The problem

The clinic loses consultation slots to patients who don't have a surgical spine problem — hip arthritis, shoulder impingement, vascular leg pain, inflammatory back pain, untreated mechanical back pain.

This platform sits **before** the appointment. The patient answers an adaptive questionnaire on their phone in Hindi or English (5–7 min). The doctor gets a **triage verdict** and a 30-second summary. The deliverable is not a summary — it's a **routing decision**.

**Stack:** NestJS + PostgreSQL API, two React/Vite front-ends (patient mobile, doctor desktop). 14 REST endpoints.

---

## What's built

**Patient questionnaire** — 63 questions across 11 sections with adaptive branching (a neck-pain patient never sees the 13 low-back questions). Full English/हिंदी support with mid-flow language switching. Autosave and resumable links. **Emergency interrupt**: a cauda equina answer set halts the form immediately and directs the patient to A&E.

Two design decisions worth noting:
- Answers are stored as **option codes, never display strings** — a form filled entirely in Hindi renders in English for the doctor with zero translation step.
- Changing an answer that hides later questions **clears those hidden answers**, so a rule can never fire on a branch the patient no longer qualifies for.

**Triage rules engine** — 26 rules: 22 verdict-producing plus 4 advisory.

| Band | Rules | Meaning |
|---|---|---|
| RED | 7 | Emergency/urgent — cauda equina, myelopathy, infection, malignancy, fracture |
| AMBER | 7 | Genuine spine consult — radiculopathy, stenosis, failed conservative care |
| **GREY** | **6** | **Refer elsewhere — hip, shoulder, vascular, inflammatory, widespread** |
| GREEN | 2 | Conservative management |
| Advisory | 4 | Notes that never change the verdict (pregnancy, recent imaging, etc.) |

The GREY band is the commercial point: these are the patients being filtered off the surgeon's calendar. Precedence is deterministic and **every verdict displays the named rules that produced it** with plain-English reasoning — nothing is a black box. Unmatched cases are flagged for manual triage rather than silently defaulting.

**Doctor dashboard** — passcode login, priority-sorted worklist with emergencies pinned top, band filters and name/mobile search. Patient detail shows verdict banner, summary, "Why this verdict", and the full record in English. The doctor records agree/disagree plus routing and notes — closing the loop and building the dataset needed to validate the rules. Every login, view and decision is written to an audit log.

**Quality** — **102 automated tests, all passing** (73 API including one named patient fixture per rule, 29 patient-web). A drift check fails the build if the two copies of the branching evaluator diverge. Seed validation rejects unknown question keys, bad option codes, duplicate rule codes and missing Hindi strings before they reach the database.

---

## Pending: AI summary

The one specified feature not yet built — and the one that changes what the doctor does with the consultation.

**Why it matters.** The rules engine decides *where the patient goes*. The model gives the doctor an understanding of *this patient's problem* — and, as an explicit output section, a short list of **what to ask them**: the ambiguities in their answers, the discriminators the questionnaire couldn't settle, the history worth probing face to face. The consultation starts at minute five instead of minute zero.

**Today** every patient gets a deterministic **template summary** built from the rule output — snapshot, complaint, key findings, red flags, supporting rules. It is accurate and usable, but it only restates what the patient answered. It cannot suggest what to ask next.

### The approach: a model we train and own

We are fine-tuning **Qwen 3 4B**, an open-weights model, on training data we generate ourselves from the questionnaire and rules engine. It runs **on the machine** — the same laptop that serves the app.

That choice has three consequences worth stating plainly:

- **No running cost.** No API subscription, no per-patient charge, no cloud GPU. The model weights are free, the training framework is free, and training and inference both run on existing hardware. Total external spend on this phase: nil.
- **No patient data leaves the building.** There is no third-party AI call anywhere in the request path. Given this is sensitive personal data under the DPDP Act, that is a materially stronger position than any vendor's privacy setting — and it is a straightforward thing to say to a clinic.
- **No vendor dependency.** We own the model. Nothing breaks if a provider changes pricing, terms, or availability.

**Hinglish support** is part of this. Because answers are stored as option codes, 61 of the 63 questions are already language-neutral — Hinglish only affects the two free-text fields, roughly 800 characters per patient. The model is trained on code-mixed input directly, so *"2 saal se lower back mein dard hai, bending karne pe zyada"* is understood and rendered in English for the doctor.

**Why a 4B model is sufficient:** the rules engine makes every clinical decision. The model writes four short prose sections and reads a little free text. It is a narrow writing task, not a reasoning one.

**Already in place:** the `summary_source` / `model` / `prompt_version` columns are migrated, there is a single call site in `TriageService`, and the doctor UI already renders whatever summary arrives. The integration point is built; only the model is missing.

### Timeline

| Stage | Effort |
|---|---|
| Training set — generator across all 26 rules, Hinglish synthesis, 300–500 authored summaries | ~2 weeks |
| Fine-tune and evaluate — overnight per run, budget 2–3 runs | ~1.5 weeks |
| Local inference server, wired behind the existing call site | 1–2 days |

**Roughly 3–4 weeks.** The bulk is authoring training examples, not engineering. Risk stays low throughout: the template summary continues to ship the whole time, so the doctor panel is never without a summary, and a model that fails validation degrades to today's behaviour rather than failing.

---

## Next steps

1. **Clinical review of the 26 rules with the surgeon.** This now sits ahead of the model work rather than beside it: the model is trained on summaries derived from these rules, so a rule that changes after training means retraining rather than a one-line fix. Review before the training run, not after.
2. **Build the training set** — synthetic patients across all 26 rules, Hinglish free text, hand-authored summaries. No external cost, and it can start immediately.
3. **Fine-tune, evaluate, ship on-device.**
4. **Use the doctor review data** to tune the rules; agree/disagree capture is already live and every reviewed patient is a data point.
