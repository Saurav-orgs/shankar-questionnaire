# Spine Patient Filtering Platform — POC Spec

**Version:** 0.1 (draft)
**Date:** 2026-08-03
**Status:** Pre-build spec, awaiting doctor review

---

## 1. Purpose

A senior spine surgeon's clinic receives many patients who do not have a surgical spine problem — hip arthritis, shoulder impingement, vascular leg pain, inflammatory back pain, and non-specific mechanical back pain that has never been treated conservatively. Each of these consumes a consultation slot that a genuine spine candidate needed.

This platform sits **before** the appointment. The patient answers an adaptive questionnaire (5–7 minutes, phone-friendly, Hindi or English). The system produces a **triage verdict** and a **30-second summary** for the doctor.

The deliverable is not a summary. **The deliverable is a routing decision.**

### Success criteria for the POC demo

| # | Criterion |
|---|---|
| 1 | Patient completes the flow in ≤ 7 minutes on a phone |
| 2 | Doctor understands a patient's situation in ≤ 30 seconds |
| 3 | The system correctly sorts the seeded demo patients into four buckets |
| 4 | A cauda equina answer set halts the questionnaire and shows an emergency screen |
| 5 | Every triage verdict shows the named rules that produced it — nothing is a black box |

---

## 2. ⚠ Clinical safety notice

**The clinical logic in this document is a draft written without physician review.** It is modelled on widely published red-flag and referral guidance, but it has not been validated by the consulting surgeon or any clinician.

Consequences for the build:

- Every screen shown to a patient carries: *"This is not a medical diagnosis. It helps the doctor prepare for your visit."*
- The doctor dashboard carries: *"Draft triage logic — pending clinical review."*
- The system **never tells a patient they do or don't have a spine problem.** It routes; it does not diagnose.
- Section 12 lists the questions to put to the doctor at the demo. Treat that as a deliverable of the POC, not an afterthought.

---

## 3. Scope

### In scope
- Landing page with doctor profile
- Language selection (English / हिंदी) affecting the entire patient flow
- Consent step
- Patient details
- Chief complaint selection
- Early red-flag screen with emergency interrupt
- Adaptive branched questionnaire (region-specific + non-spine discriminators + function + treatment history)
- Deterministic rule engine producing a triage verdict
- AI-generated prose summary with deterministic fallback
- Doctor panel: passcode gate, triage-sorted table, detail view, decision capture

### Out of scope for the POC
- File / MRI upload *(explicitly deferred)*
- Docker
- Monorepo tooling
- OTP / mobile verification
- Real doctor accounts, roles, password reset
- Payments, appointment booking, EMR integration
- SMS / WhatsApp notifications
- Analytics dashboards

---

## 4. Architecture

Three independent projects side by side. No workspace tooling, no shared package.

```
filter-patient/
├── plan.md
├── api/            NestJS + Sequelize + PostgreSQL       :4000
├── patient-web/    React + Vite + TypeScript             :5173
└── doctor-web/     React + Vite + TypeScript             :5176
```

### Why two separate web apps

The two panels are genuinely different products that happen to share a database:

- **Different users** — patients in a waiting room on a mid-range Android phone; the surgeon on a desktop.
- **Different design languages** — the patient app is one question per screen, huge tap targets, bilingual. The doctor app is a dense English-only table. There was never much UI worth sharing between them.
- **Different security exposure** — the patient app is public by necessity. The doctor app holds every patient's name, phone number and health data, and should be deployable behind a separate subdomain, IP allowlist, or VPN without dragging the public app along with it.
- **Different release cadence** — questionnaire wording will change often; the dashboard will not.

Cost of the split: three dev servers instead of two, CORS configured for two origins, and a duplicated Tailwind config. All trivial. The one thing that genuinely would have been shared — the branching evaluator — is not needed by the doctor app at all, so the split costs nothing there.

### Stack

**api/**
- NestJS 10, TypeScript
- Sequelize 6 + `sequelize-typescript`, `pg` driver
- `umzug` or `sequelize-cli` migrations (no `sync({alter:true})` past Phase 1)
- `class-validator` / `class-transformer` for DTOs
- Local HTTP call to the on-device summary model (§9) — no third-party AI SDK, no API key
- Local PostgreSQL 15 (already running)

**patient-web/**
- React 18 + Vite + TypeScript
- `react-router-dom` v6
- `@tanstack/react-query`
- Tailwind CSS
- `react-i18next` for UI chrome (buttons, labels, errors)
- Question text comes from the API already localised — see §7
- Mobile-first; designed against a 360×640 viewport

**doctor-web/**
- React 18 + Vite + TypeScript
- `react-router-dom` v6
- `@tanstack/react-query`
- Tailwind CSS
- No i18n — English only
- Desktop-first; dense table layout

### Environment

`api/.env`
```
PORT=4000
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=rohitsingh
DATABASE_PASSWORD=11223344
DATABASE_NAME=spine
DATABASE_SSL=false
DATABASE_LOGGING=false
DOCTOR_PANEL_PASSCODE=<set at build time>
SESSION_SECRET=<random>
SUMMARY_MODEL_URL=http://localhost:8080
AI_SUMMARY_ENABLED=true
PATIENT_WEB_ORIGIN=http://localhost:5173
DOCTOR_WEB_ORIGIN=http://localhost:5176
```

`patient-web/.env`
```
VITE_API_BASE_URL=http://localhost:4000/api
```

`doctor-web/.env`
```
VITE_API_BASE_URL=http://localhost:4000/api
```

CORS on the API allows exactly these two origins, with `credentials: true` for the doctor session cookie.

Both web apps pin their port with `strictPort: true`. If a port is taken the dev server must fail loudly rather than drift to another port, because a silent port change would break the API's CORS allowlist in a way that looks like a bug in the app. `doctor-web` uses **5176** — 5174 and 5175 are occupied by other projects on this machine.

`.env` files are git-ignored. `.env.example` is committed with placeholder values.

---

## 5. The triage model

Every submitted assessment exits with exactly one category.

| Category | Meaning | Doctor action | Urgency |
|---|---|---|---|
| 🔴 **RED** | Red flag / emergency / progressive neurological deficit | See now, or send to emergency | `emergency` \| `urgent` |
| 🟠 **AMBER** | Genuine spine-specialist candidate — radicular, stenotic, myelopathic, or failed conservative care | Book consultation | `routine` |
| 🟢 **GREEN** | Mechanical spine pain, early or untreated, no neurological involvement | Conservative care / physiotherapy first, review in 6 weeks | `non_urgent` |
| ⚪ **GREY** | Pattern does not fit a spine problem | Route to another specialty | `non_urgent` |

**GREY is the category that justifies this project.** A system that only sorts spine patients by severity does not solve the stated problem. The non-spine discriminator questions (§6, Section F) are the core clinical content, not an add-on.

### Precedence

`RED > AMBER > GREY > GREEN`

All rules are evaluated; matches are collected and all are shown to the doctor. The category is set by the highest-severity match. GREY rules carry explicit "no radicular / no neurological finding" preconditions, so an AMBER/GREY collision should be rare — where one occurs, AMBER wins and the report carries a secondary note (*"also screen hip"*).

If **no** rule matches, the category is `GREEN` with pathway `"Needs clinical assessment — no rule pattern matched"`, and the report is flagged `unmatched: true`. Unmatched cases are the feedback signal for improving the rules; they must be visible, not silently bucketed.

---

## 6. Question bank

63 questions defined. Branching decides how many are actually asked.

**Measured after implementation** (Phase 2, driving the real API): a full lumbar patient is asked **47**, a hip patient 45, a neck patient ~44. That is well above the 30–34 originally estimated here, and one-question-per-screen at 47 screens will not hold the 5–7 minute budget.

**Consequence for Phase 3:** homogeneous groups get one screen, not one screen per question.

| Group | Screens |
|---|---|
| Patient details (6) | 1 screen |
| Red flags (10) | 1 screen, 10 yes/no rows |
| Function (4) | 1 screen |
| Everything clinical | 1 question per screen |

That converts 47 questions into roughly 30 screens while asking exactly the same things. The red-flag block in particular reads naturally as a single checklist and badly as ten separate screens.

Notation: `key` · type · options as `code` labels. Every question stores an option **code**; English and Hindi are display layers over the same code. This is what lets a patient answer in Hindi and the doctor read English.

### Section A — Consent & language (2 screens, not questions)

- Language toggle: English / हिंदी. Persisted on the assessment; switchable at any time mid-flow.
- Consent text + checkbox. Must be accepted before any patient data is stored.

> **EN:** I agree that my answers and contact details will be shared with Dr. \<name\> and their clinic to help prepare for my visit. This form does not give a diagnosis and is not a substitute for seeing a doctor.
>
> **HI:** मैं सहमत हूँ कि मेरे उत्तर और संपर्क विवरण डॉ. \<नाम\> और उनके क्लिनिक के साथ साझा किए जाएँगे, ताकि मेरी विज़िट की तैयारी हो सके। यह फ़ॉर्म कोई निदान नहीं देता और डॉक्टर से मिलने का विकल्प नहीं है।

### Section B — Patient details (5)

| key | EN | HI | type |
|---|---|---|---|
| `name` | Your full name | आपका पूरा नाम | text |
| `age` | Your age | आपकी उम्र | number 1–120 |
| `gender` | Gender | लिंग | `male` पुरुष / `female` महिला / `other` अन्य |
| `mobile` | Mobile number | मोबाइल नंबर | tel, 10-digit IN |
| `occupation` | What work do you do? | आप क्या काम करते हैं? | select + other |

`occupation` options — `driver` ड्राइवर · `farm_labour` किसान / मज़दूर · `desk_job` ऑफ़िस / डेस्क का काम · `homemaker` गृहिणी · `teacher` शिक्षक · `shop_business` दुकान / व्यापार · `retired` सेवानिवृत्त · `student` छात्र · `other` अन्य

Occupation is clinically relevant (load exposure, driving posture, ability to return to work), not just demographic.

### Section C — Chief complaint (2)

**`chief_complaint`** · multi-select, min 1
EN: *What is troubling you? Select all that apply.* · HI: *आपको क्या तकलीफ़ है? जो भी लागू हो चुनें।*

| code | EN | HI |
|---|---|---|
| `neck_pain` | Neck pain | गर्दन में दर्द |
| `upper_back_pain` | Upper back pain | ऊपरी पीठ में दर्द |
| `low_back_pain` | Lower back pain | कमर में दर्द |
| `leg_pain` | Leg pain | पैर में दर्द |
| `arm_pain` | Arm or hand pain | बांह या हाथ में दर्द |
| `numbness` | Numbness | सुन्नपन |
| `tingling` | Tingling / pins and needles | झुनझुनी / चींटियाँ चलना |
| `weakness` | Weakness | कमज़ोरी |
| `walking_difficulty` | Difficulty walking | चलने में कठिनाई |
| `none_of_these` | None of these | इनमें से कोई नहीं |

**`primary_complaint`** · single-select from the codes chosen above
EN: *Which one troubles you the most?* · HI: *इनमें से सबसे ज़्यादा परेशानी किससे है?*

Drives branch ordering and the summary headline.

> **Escape hatch:** `none_of_these` skips regional branches, asks Section F + a free-text box, and produces GREY with pathway *"Complaint not spine-patterned — clinical triage needed."* Never dead-end a patient.

### Section D — Red flags (asked EARLY, always, 10)

Moved ahead of the detailed branches deliberately. If a patient has cauda equina symptoms, spending four more minutes on pain scores is a safety failure.

| key | EN | HI |
|---|---|---|
| `rf_bladder` | Have you recently lost control of your urine, or been unable to pass urine? | क्या हाल ही में आपका पेशाब पर काबू नहीं रहा, या पेशाब आना बंद हो गया? |
| `rf_bowel` | Have you recently lost control of your bowels? | क्या हाल ही में आपका मल (शौच) पर काबू नहीं रहा? |
| `rf_saddle` | Is there numbness around your private parts, inner thighs, or buttocks — the area that touches a saddle? | क्या आपके गुप्तांगों, जाँघों के अंदरूनी हिस्से, या नितंबों के आसपास सुन्नपन है? |
| `rf_progressive_weakness` | Is weakness in your leg or foot getting worse quickly, or does your foot drag on the ground? | क्या पैर या पंजे की कमज़ोरी तेज़ी से बढ़ रही है, या पैर ज़मीन पर घिसटता है? |
| `rf_trauma` | Have you had a fall or accident recently? | क्या हाल में आपको कोई चोट, गिरना या दुर्घटना हुई है? |
| `rf_fever` | Do you have fever along with the pain? | क्या दर्द के साथ बुखार भी रहता है? |
| `rf_cancer` | Have you ever been treated for cancer? | क्या आपका कभी कैंसर का इलाज हुआ है? |
| `rf_weight_loss` | Have you lost weight without trying? | क्या बिना कोशिश किए आपका वज़न घट रहा है? |
| `rf_night_pain` | Does the pain wake you from sleep at night? | क्या दर्द रात में आपकी नींद तोड़ देता है? |
| `rf_immuno` | Do you have diabetes, take steroids long-term, or have low immunity? | क्या आपको मधुमेह (शुगर) है, आप लंबे समय से स्टेरॉयड ले रहे हैं, या आपकी रोग-प्रतिरोधक क्षमता कमज़ोर है? |

All yes / no / not sure — `yes` `no` `unsure` · हाँ / नहीं / पता नहीं.

`unsure` on a cauda equina item is treated as `yes` for safety.

**Emergency interrupt** — if `rf_bladder` ∨ `rf_bowel` ∨ `rf_saddle` is yes/unsure, **or** `rf_progressive_weakness` is yes:

The questionnaire stops immediately. Full-screen, non-dismissible:

> **EN — Please seek medical care now.** Some of your answers describe symptoms that need to be checked urgently, today. Please go to the nearest hospital emergency department, or call the clinic on \<phone\>. Do not wait for an appointment.
>
> **HI — कृपया तुरंत डॉक्टर को दिखाएँ।** आपके कुछ उत्तर ऐसे लक्षण बताते हैं जिन्हें आज ही, तुरंत जाँचना ज़रूरी है। कृपया नज़दीकी अस्पताल के इमरजेंसी विभाग में जाएँ, या क्लिनिक को \<फ़ोन\> पर कॉल करें। अपॉइंटमेंट का इंतज़ार न करें।

The partial assessment is saved, marked `emergency_triggered = true`, given category RED / `emergency`, and pushed to the top of the doctor dashboard. **A partial emergency record is more valuable than a complete routine one.**

### Section E — Lower back / leg branch (13)

Shown if `chief_complaint` includes any of `low_back_pain`, `leg_pain`, `walking_difficulty`.

| key | EN | HI | options |
|---|---|---|---|
| `lbp_duration` | How long have you had this pain? | यह दर्द आपको कब से है? | `lt_2w` <2 weeks · `2_6w` 2–6 weeks · `6w_3m` 6 weeks–3 months · `3_12m` 3–12 months · `gt_1y` more than a year |
| `lbp_onset` | How did it start? | यह कैसे शुरू हुआ? | `sudden_lift` suddenly, after lifting or bending · `sudden_injury` after an injury · `gradual` gradually · `no_cause` no clear reason |
| `lbp_severity` | Pain right now, 0 = none, 10 = worst | अभी दर्द कितना है? 0 = बिल्कुल नहीं, 10 = सबसे ज़्यादा | slider 0–10 |
| `lbp_radiate` | How far down does the pain travel? | दर्द कहाँ तक जाता है? | `none` stays in the back · `buttock` to the buttock · `above_knee` to the thigh, above the knee · `below_knee` below the knee, to the calf or foot |
| `lbp_side` | Which side? | किस तरफ़? | `left` बायाँ · `right` दायाँ · `both` दोनों |
| `lbp_cough` | Does coughing, sneezing or straining make the leg pain worse? | क्या खाँसने, छींकने या ज़ोर लगाने पर पैर का दर्द बढ़ता है? | yes/no/unsure |
| `lbp_sitting` | Is it worse when sitting for a long time? | क्या देर तक बैठने पर दर्द बढ़ता है? | yes/no |
| `lbp_walking` | Is it worse when standing or walking? | क्या खड़े होने या चलने पर दर्द बढ़ता है? | yes/no |
| `lbp_bend_relief` | When leg pain stops you walking, does bending forward or sitting down relieve it? | जब चलते-चलते पैर का दर्द रोक देता है, तो क्या आगे झुकने या बैठ जाने से आराम मिलता है? | yes/no/na |
| `lbp_walk_distance` | How far can you walk before the pain stops you? | दर्द रोकने से पहले आप कितनी दूर चल पाते हैं? | `unlimited` no limit · `gt_500m` more than 500 m · `100_500m` 100–500 m · `lt_100m` less than 100 m |
| `lbp_numbness` | Is there numbness or tingling in your leg or foot? | क्या आपके पैर या पंजे में सुन्नपन या झुनझुनी है? | yes/no |
| `lbp_weakness` | Do you have difficulty standing on your toes or heels, or does your foot feel weak? | क्या पंजों या एड़ी के बल खड़े होने में दिक्कत है, या पैर कमज़ोर लगता है? | yes/no/unsure |
| `lbp_rest_relief` | Does lying down relieve the pain? | क्या लेटने पर दर्द में आराम मिलता है? | yes/no |

`lbp_radiate` as a four-level answer is far more discriminating than "does it travel to the leg — yes/no." **Below the knee** is the finding that matters.

`lbp_bend_relief` vs. Section F's `vasc_claudication` is the neurogenic-versus-vascular discriminator — the single highest-value pair of questions in this instrument.

### Section F — Neck / arm branch (11)

Shown if `chief_complaint` includes any of `neck_pain`, `arm_pain`, `upper_back_pain`.

| key | EN | HI | options |
|---|---|---|---|
| `neck_duration` | How long have you had neck pain? | गर्दन का दर्द कब से है? | same scale as `lbp_duration` |
| `neck_severity` | Pain right now, 0–10 | अभी दर्द कितना है? 0–10 | slider |
| `neck_radiate` | How far down the arm does the pain go? | दर्द बांह में कहाँ तक जाता है? | `none` stays in the neck · `shoulder` to the shoulder only · `above_elbow` to the upper arm · `below_elbow` below the elbow, to the hand or fingers |
| `neck_side` | Which side? | किस तरफ़? | left/right/both |
| `neck_numbness_hand` | Numbness or tingling in your hand or fingers? | क्या हाथ या उँगलियों में सुन्नपन या झुनझुनी है? | yes/no |
| `neck_grip` | Do you drop things, or struggle to hold objects? | क्या आपके हाथ से चीज़ें गिर जाती हैं, या पकड़ने में दिक्कत होती है? | yes/no |
| `myelo_buttons` | Difficulty with fine work — buttoning a shirt, picking up a coin, writing? | क्या बारीक कामों में दिक्कत होती है — शर्ट के बटन लगाना, सिक्का उठाना, लिखना? | yes/no |
| `myelo_gait` | Do you feel unsteady on your feet, or lose balance while walking? | क्या चलते समय लड़खड़ाहट होती है या संतुलन बिगड़ता है? | yes/no |
| `myelo_both_hands` | Are both hands affected? | क्या दोनों हाथ प्रभावित हैं? | yes/no |
| `myelo_urinary` | Any new urgency or frequency in passing urine? | क्या हाल में पेशाब की जल्दी या बार-बार जाने की समस्या शुरू हुई है? | yes/no |
| `neck_headache` | Headache along with the neck pain? | क्या गर्दन के दर्द के साथ सिरदर्द भी रहता है? | yes/no |

The four `myelo_*` questions screen for **cervical myelopathy** — progressive, time-sensitive, and the most consequential thing a neck questionnaire can miss. The original plan's "difficulty holding objects" catches only part of it.

### Section G — Non-spine discriminators (7, always asked)

**This section is the filter.** It is what makes GREY possible.

| key | EN | HI | shown when |
|---|---|---|---|
| `hip_groin` | Is the pain mainly in the groin or the front of the hip joint, rather than the back? | क्या दर्द मुख्य रूप से कमर के जोड़ या जाँघ के ऊपरी अगले हिस्से में है, न कि पीठ में? | any lower-limb / back complaint |
| `hip_socks` | Difficulty putting on socks or shoes, or getting out of a car, because the hip feels stiff? | क्या जुर्राब या जूते पहनने में, या गाड़ी से उतरने में दिक्कत होती है क्योंकि कूल्हा जकड़ा लगता है? | `hip_groin` = yes |
| `shoulder_overhead` | Is the arm pain worse when you reach overhead, and does it stay above the elbow? | क्या हाथ ऊपर उठाने पर बांह का दर्द बढ़ता है, और दर्द कोहनी से ऊपर ही रहता है? | arm/neck branch |
| `vasc_claudication` | When leg pain stops you walking, what helps — standing still, or sitting down / leaning forward? | जब चलते-चलते पैर का दर्द रोक देता है, तो आराम किससे मिलता है — बस खड़े रहने से, या बैठने / आगे झुकने से? | `lbp_walk_distance` ≠ `unlimited` · `stand_still` / `sit_bend` / `neither` |
| `inflam_morning_stiffness` | Is your back stiff for more than 30 minutes after waking? | क्या सुबह उठने के बाद आपकी पीठ आधे घंटे से ज़्यादा जकड़ी रहती है? | back complaint |
| `inflam_exercise_better` | Does the pain get better with movement and worse with rest? | क्या चलने-फिरने से दर्द कम होता है और आराम करने से बढ़ता है? | back complaint |
| `widespread_pain` | Do you have pain in many parts of the body — arms, legs, all over — along with constant tiredness? | क्या शरीर के कई हिस्सों में दर्द रहता है — हाथ, पैर, पूरे शरीर में — साथ में हमेशा थकान भी? | always |

`vasc_claudication` is the highest-yield question in the set. Two patients present identically — *"my leg hurts when I walk"* — and one belongs to a vascular surgeon.

### Section H — Function (4, always asked)

Doctors act on function, not on a 0–10 number. Ask both.

| key | EN | HI | options |
|---|---|---|---|
| `func_work` | Can you do your normal work? | क्या आप अपना रोज़ का काम कर पाते हैं? | `fully` yes, normally · `difficulty` yes, but with difficulty · `stopped` I have had to stop working |
| `func_sleep` | Does the pain disturb your sleep? | क्या दर्द से आपकी नींद खराब होती है? | `never` · `sometimes` · `most_nights` |
| `func_daily` | Do you need help with daily tasks — dressing, bathing? | क्या रोज़ के कामों में मदद चाहिए — कपड़े पहनना, नहाना? | `independent` · `some_help` · `needs_help` |
| `func_worsening` | Over the last month, is it getting better, staying the same, or getting worse? | पिछले एक महीने में यह बेहतर हो रहा है, वैसा ही है, या बिगड़ रहा है? | `better` · `same` · `worse` |

### Section I — Treatment history (4, always asked)

**Probably the single highest-yield filter in the whole instrument.** A senior spine surgeon should not be the first stop for someone who has never done physiotherapy.

| key | EN | HI | options |
|---|---|---|---|
| `tx_tried` | What have you already tried? Select all. | आपने अब तक क्या-क्या आज़माया है? सब चुनें। | `nothing` कुछ नहीं · `rest` सिर्फ़ आराम · `painkillers` दर्द की दवाइयाँ · `physio` फ़िज़ियोथेरेपी · `injection` इंजेक्शन · `alt_medicine` आयुर्वेदिक / होम्योपैथिक / देसी इलाज · `surgery` रीढ़ की सर्जरी |
| `tx_physio_duration` | How long did you do physiotherapy? | आपने फ़िज़ियोथेरेपी कितने समय तक की? | `lt_2w` · `2_6w` · `gt_6w` — shown if `physio` |
| `tx_response` | Did the treatment help? | क्या इलाज से आराम मिला? | `fully` पूरी तरह · `partly` कुछ हद तक · `not_at_all` बिल्कुल नहीं — shown if not `nothing` |
| `tx_prior_surgery` | Have you had spine surgery before? If yes, when and where? | क्या पहले कभी रीढ़ की सर्जरी हुई है? अगर हाँ, तो कब और कहाँ? | yes+text / no |

### Section J — Prior imaging (2, always asked)

No file upload in this POC. We record whether imaging exists.

| key | EN | HI | options |
|---|---|---|---|
| `img_done` | Have you had any scans for this problem? | क्या इस समस्या के लिए कोई जाँच हुई है? | multi — `none` · `xray` एक्स-रे · `mri` एमआरआई · `ct` सीटी स्कैन |
| `img_when` | When was the most recent one? | सबसे हाल की जाँच कब हुई थी? | `lt_3m` · `3_12m` · `gt_1y` — shown if not `none` |

### Section K — Other conditions (1)

`comorbidities` · multi-select — `none` · `diabetes` मधुमेह (शुगर) · `smoking` धूम्रपान · `hypertension` उच्च रक्तचाप · `osteoporosis` हड्डियों का भुरभुरापन · `thyroid` थायरॉयड · `heart` हृदय रोग

Feeds the infection, fracture, and vascular rules.

### Section L — Free text (1)

`free_text` · optional textarea, max 500 chars
EN: *Is there anything else you want the doctor to know?* · HI: *क्या आप डॉक्टर को कुछ और बताना चाहते हैं?*

Never omit this. Structured options always lose the patient who does not fit them — and the ones who do not fit are exactly the ones worth reading about.

---

## 7. Localisation design

- Question text, option labels, help text and consent copy live in the **questionnaire JSON** as `{ "en": "...", "hi": "..." }` objects. One source, versioned with the questionnaire.
- Static UI chrome (Next, Back, Submit, validation errors) lives in `react-i18next` resource files.
- **Answers are stored as codes, never as display strings.** A Hindi patient selecting `below_knee` stores `below_knee`; the doctor panel renders the English label for that code. This is why the doctor panel can be English-only while the patient flow is fully bilingual, with zero translation at read time.
- Free text and `tx_prior_surgery` detail are stored verbatim in whatever the patient typed, with the language recorded. The AI summary is instructed to translate these to English and mark them as *(translated)*.
- The language toggle is available on every screen, not only the landing page. Patients switch mid-form more often than you would expect.
- Numerals: Latin digits throughout (`8/10`, `43`), not Devanagari numerals. This matches how numbers actually appear on Indian phones and forms.
- The doctor panel is English-only for the POC.

---

## 8. Rules engine

### Design principles

1. **Deterministic, not AI.** The same answers must always produce the same category. A doctor who sees two identical patients classified differently will never trust the tool again.
2. **Rules as data.** A JSON array in `questionnaire_versions.rules`, versioned alongside the questions. Printable and reviewable by the doctor without reading code.
3. **Every rule explains itself.** The verdict shows the matched rule codes and their plain-English explanations.
4. **Every rule has a test.** Fixture-driven, one named patient scenario per rule minimum.

### Rule shape

```json
{
  "code": "RED_CAUDA_EQUINA",
  "label": "Suspected cauda equina syndrome",
  "category": "RED",
  "urgency": "emergency",
  "severity": 100,
  "pathway": "Emergency department today — do not wait for OPD",
  "explain": "Bladder, bowel, or saddle sensory symptoms reported alongside back pain.",
  "when": {
    "any": [
      { "q": "rf_bladder", "op": "in", "value": ["yes", "unsure"] },
      { "q": "rf_bowel",   "op": "in", "value": ["yes", "unsure"] },
      { "q": "rf_saddle",  "op": "in", "value": ["yes", "unsure"] }
    ]
  }
}
```

Operators: `eq` `neq` `in` `not_in` `includes` `excludes` `gte` `lte` `answered` `unanswered`. Combinators: `all` `any` `not`. Nesting allowed.

### Draft rule set

#### RED

| code | condition | pathway |
|---|---|---|
| `RED_CAUDA_EQUINA` | `rf_bladder` ∨ `rf_bowel` ∨ `rf_saddle` = yes/unsure | Emergency department today |
| `RED_PROGRESSIVE_DEFICIT` | `rf_progressive_weakness` = yes | Same-day review |
| `RED_MYELOPATHY` | (`myelo_buttons` ∨ `myelo_gait`) ∧ (`myelo_both_hands` ∨ `myelo_urinary`) | Urgent spine consult — query cervical myelopathy |
| `RED_INFECTION` | `rf_fever` = yes ∧ back/neck pain ∧ (`diabetes` ∨ `rf_immuno` ∨ `rf_night_pain`) | Urgent — rule out spinal infection |
| `RED_MALIGNANCY` | `rf_cancer` = yes ∧ (`rf_night_pain` ∨ `rf_weight_loss`) | Urgent — rule out metastatic disease |
| `RED_FRACTURE` | `rf_trauma` = yes ∧ (`age` ≥ 50 ∨ `osteoporosis`) | Urgent imaging before OPD |

#### AMBER

| code | condition | pathway |
|---|---|---|
| `AMBER_LUMBAR_RADICULOPATHY` | `lbp_radiate` = `below_knee` ∧ (`lbp_numbness` ∨ `lbp_cough`) ∧ duration ≥ 6 weeks | Spine consult — likely nerve root involvement |
| `AMBER_MOTOR_DEFICIT` | `lbp_weakness` = yes ∧ ¬`rf_progressive_weakness` | Spine consult — motor involvement, examine |
| `AMBER_STENOSIS` | `lbp_walk_distance` ∈ {`lt_100m`,`100_500m`} ∧ `lbp_bend_relief` = yes ∧ `age` ≥ 50 | Spine consult — query lumbar canal stenosis |
| `AMBER_CERVICAL_RADICULOPATHY` | `neck_radiate` = `below_elbow` ∧ `neck_numbness_hand` ∧ duration ≥ 6 weeks | Spine consult — cervical radiculopathy |
| `AMBER_FAILED_CONSERVATIVE` | duration ≥ 6 weeks ∧ `tx_physio_duration` = `gt_6w` ∧ `tx_response` = `not_at_all` ∧ `func_work` ≠ `fully` | Spine consult — conservative care exhausted |
| `AMBER_POST_SURGICAL` | `tx_tried` includes `surgery` | Spine consult — previous spine surgery |
| `AMBER_FUNCTIONAL_COLLAPSE` | `func_work` = `stopped` ∧ `func_worsening` = `worse` ∧ duration ≥ 6 weeks | Spine consult — significant functional loss |

#### GREY — all require: no red flag, no `below_knee`/`below_elbow` radiation, no motor deficit

| code | condition | route to |
|---|---|---|
| `GREY_HIP` | `hip_groin` ∧ `hip_socks` ∧ `lbp_radiate` ∈ {`none`,`buttock`} | Orthopaedics — hip |
| `GREY_SHOULDER` | `shoulder_overhead` ∧ `neck_radiate` ∈ {`none`,`shoulder`} ∧ ¬`neck_numbness_hand` | Orthopaedics — shoulder |
| `GREY_VASCULAR` | `vasc_claudication` = `stand_still` ∧ (`smoking` ∨ `diabetes`) | Vascular surgery — query peripheral arterial disease |
| `GREY_INFLAMMATORY` | `age` < 45 ∧ `inflam_morning_stiffness` ∧ `inflam_exercise_better` ∧ duration > 3 months | Rheumatology — query axial spondyloarthritis |
| `GREY_WIDESPREAD` | `widespread_pain` = yes ∧ no radicular pattern | Pain medicine / rheumatology |
| `GREY_UNCLEAR` | `chief_complaint` = `none_of_these` | Clinical triage — complaint not spine-patterned |

#### GREEN

| code | condition | pathway |
|---|---|---|
| `GREEN_ACUTE_MECHANICAL` | duration < 6 weeks ∧ `lbp_radiate` ∈ {`none`,`buttock`,`above_knee`} ∧ no neuro ∧ no red flag | Conservative care, review at 6 weeks |
| `GREEN_UNTREATED_CHRONIC` | duration ≥ 6 weeks ∧ no radicular ∧ `tx_tried` ⊆ {`nothing`,`rest`,`painkillers`,`alt_medicine`} | Structured physiotherapy first, review at 6 weeks |

`GREEN_UNTREATED_CHRONIC` is expected to be the largest bucket by volume and is the primary mechanism by which the clinic reclaims consultation slots.

### Output

```ts
interface TriageResult {
  category: 'RED' | 'AMBER' | 'GREY' | 'GREEN';
  urgency: 'emergency' | 'urgent' | 'routine' | 'non_urgent';
  pathway: string;
  matchedRules: { code: string; label: string; explain: string; severity: number }[];
  redFlags: { key: string; label: string; answer: string }[];
  secondaryNotes: string[];   // e.g. "also screen hip"
  unmatched: boolean;
  completeness: number;       // 0-1, answered / applicable
  contradictions: string[];   // e.g. "reports no back pain but answered back-pain questions"
}
```

---

## 9. AI summary

The rule engine decides. The model writes.

The summary is not decoration. The rules engine answers *where does this patient go*; the summary answers *what should the doctor ask them*. That is what turns a routing decision into a better consultation, and it is the part the deterministic template cannot do — a template can only restate answers, never suggest a next question.

### One model in production, zero third-party services

| Role | What | Where | Sees real patients |
|---|---|---|---|
| **Training labels** | Hand-authored during development | Offline, one-time | No |
| **Production model** | Gemma 3 4B + LoRA adapter, fine-tuned in-house | On-device | Yes |

**No API key, no subscription, no cloud spend.** Qwen 3 4B is open weights, MLX is Apple's own framework, training and inference both run on the development M1. The training summaries are written by hand during development rather than bought from a labelling service or generated through a paid API.

**Everything stays on the machine.** Patient answers never cross the network — there is no third-party AI call anywhere in the request path. For the demo this is also the pitch: questionnaire, triage and summary all run on one laptop, offline.

**Why 4B is enough.** The rules engine makes every decision, and all 61 structured answers arrive as option codes. The model writes four short prose sections and reads up to ~800 characters of free text. It is a narrow generation task, not a reasoning one.

### Output

Fixed sections — *Snapshot*, *Key findings* (3–5 bullets), *Supporting the triage verdict*, *What the doctor may want to ask*.

The verdict itself is **never generated**. The category, urgency and pathway are rendered by application code from `TriageResult`; the model fills only the prose. This makes constraint 1 below structural rather than a promise the prompt has to keep.

### Constraints

Trained into the model, and verified on every response:

1. Never state or imply a category different from `TriageResult.category`.
2. Never introduce a symptom, finding, or history item not present in the input.
3. Never state a diagnosis as fact — use *"pattern consistent with"*, *"query"*, *"suggests"*.
4. Render free text in English and mark it *(translated)*. Input may be Devanagari Hindi **or Hinglish** — Roman-script code-mixed Hindi and English, e.g. *"2 saal se lower back mein dard hai, bending karne pe zyada"*. Only two fields carry free text: `free_text` (500 chars) and `tx_prior_surgery_detail` (300 chars); every other answer is an option code and needs no translation.
5. Maximum 150 words. It is a 30-second read, and the constraint is the product.

### Training

1. **Generate** synthetic assessments sweeping all 26 rules plus branch and advisory combinations, extending `scripts/seed-demo-patients.py`.
2. **Synthesise Hinglish free text** for a substantial share of them, so the model sees code-mixed input during training rather than at inference for the first time.
3. **Author 300–500 target summaries** by hand against those assessments, covering every rule and every combination of the four output sections. Expand programmatically with controlled variation — phrasing, ordering, patient particulars — since the input side is already structured and the output shape is fixed.
4. **Fine-tune** Gemma 3 4B (4-bit) with LoRA via MLX on the M1. Peak ~7–9 GB of 16 GB; roughly an overnight run per iteration.
5. **Evaluate** against a held-out set with an automated harness checking all five constraints.

The dataset is small by fine-tuning standards, and deliberately so: the model is learning format and voice, not knowledge. Every decision is already made by the rules engine, and 61 of the 63 questions arrive as option codes. If the eval shows gaps, the fix is more hand-authored examples in the weak areas — the cost is authoring time, not money.

Base-model choice was settled by a zero-shot Hinglish comprehension bake-off before training — fine-tuning teaches format and style cheaply, but it does not cheaply teach a language the base model does not already know. **Gemma 3 4B won** on 50 samples: 78.8% fact recall against Qwen 3 4B's 68.6%, and 2 untranslated samples against Qwen's 5. Full results and the surviving failures are in `training-data/bakeoff/RESULTS.md`.

Qwen 3 **8B scored worse than 4B** (66.0%, 8 untranslated), so the failure is not capacity — both Qwen sizes treat Roman-script Hinglish as already-English and echo it back. That rules out escalating to a larger model, which would in any case need ~12–14 GB peak for a LoRA against 16 GB of unified memory.

**Dependency:** the model is trained on summaries derived from the §8 rules. Those rules are unreviewed (§2). A wrong rule is a one-line fix today and a retrain afterwards, so clinical review should land before the training run, not after.

### Fallback

**Fallback is mandatory.** If the model errors, times out, or fails validation, generate the summary from the deterministic template built from the rule output, and set `summary_source = 'template'`. The doctor must never open a patient and find an empty card.

The timeout is **30 s**, not the 15 s first specified here. Measured on the
deployed hardware: a realistic full patient record — every section answered,
a free-text note — takes ~16.5 s of actual generation, already past 15 s
before any scheduling variance. 15 s was a target set before the model
existed to measure against; 30 s is the number the real M1 + Gemma 3 4B
combination needs, found by timing `scripts/summary-server.py` directly
against holdout-length input.

The template path is already built and tested, and it is what runs until the student model ships — so there is no window in which the doctor panel has no summary at all.

Summary generation runs synchronously on submit for the POC — the patient's confirmation screen absorbs the latency — with the template fallback keeping worst-case time bounded.

`prompt_version` and `model` are stored on every result so regressions are traceable; `model` records the base model plus the adapter version.

---

## 10. Data model

PostgreSQL 15, database `spine`. UUID primary keys (`gen_random_uuid()`, pgcrypto).

### `doctors`
`id` · `full_name` · `qualifications` · `specialty` · `bio_en` · `bio_hi` · `photo_url` · `clinic_name` · `clinic_address` · `clinic_phone` · `emergency_phone` · `created_at` · `updated_at`

### `questionnaire_versions`
`id` · `version` int unique · `schema` jsonb · `rules` jsonb · `status` enum(`draft`,`published`,`archived`) · `published_at` · `created_at`

Answers reference the version they were captured under, so editing questions never corrupts historical submissions. The doctor **will** want wording changes weekly — design for that from day one.

### `assessments`
`id` · `public_token` text unique (32-char urlsafe) · `doctor_id` fk · `questionnaire_version_id` fk · `language` enum(`en`,`hi`) · `status` enum(`in_progress`,`submitted`,`abandoned`) · `consent_at` · `patient_name` · `patient_age` int · `patient_gender` · `patient_mobile` · `patient_occupation` · `answers` jsonb default `'{}'` · `current_question_key` · `emergency_triggered` bool · `started_at` · `submitted_at` · `last_activity_at` · `created_at` · `updated_at`

Answers as a single JSONB column: the schema is versioned and variable, so a normalised `answers` table buys querying power the POC does not need and costs migration pain it cannot afford. GIN index on `answers` if querying is needed later.

### `triage_results`
`id` · `assessment_id` fk unique · `category` enum · `urgency` enum · `pathway` text · `matched_rules` jsonb · `red_flags` jsonb · `secondary_notes` jsonb · `unmatched` bool · `completeness` numeric · `summary_text` text · `summary_source` enum(`ai`,`template`) · `model` · `prompt_version` · `generated_at`

### `doctor_reviews`
`id` · `assessment_id` fk · `decision` enum(`accept_consult`,`route_physio`,`route_other_specialty`,`request_more_info`,`decline`) · `route_to` · `agreed_with_triage` bool · `notes` · `reviewed_by` · `reviewed_at`

**Capturing the doctor's decision is not optional.** Without it there is no way to know whether the filter works — and "did the surgeon agree with the machine, and how often" is the most persuasive slide you can put in front of them at the next meeting.

### `audit_logs`
`id` · `actor` · `action` · `entity` · `entity_id` · `ip` · `user_agent` · `created_at`

Every doctor-panel view of patient data is logged. This is health data with names and phone numbers.

### Indexes
`assessments(public_token)` · `assessments(status, submitted_at DESC)` · `triage_results(category)` · `triage_results(assessment_id)` · `doctor_reviews(assessment_id)`

---

## 11. API

Base `http://localhost:4000/api`. Patient endpoints authenticate by opaque `public_token` in the path; the doctor panel uses a passcode-issued httpOnly session cookie.

### Public
```
GET   /doctor-profile                         doctor card for the landing page
GET   /questionnaire/active?lang=en|hi        published schema, localised
POST  /assessments                            { doctorId, language, consent } -> { token }
PATCH /assessments/:token/details             patient details
PATCH /assessments/:token/answers             { answers: {...} } — autosave, partial
POST  /assessments/:token/submit              validate -> rules -> summary -> persist
GET   /assessments/:token/summary-status      patient confirmation screen
```

### Doctor (passcode-gated)
```
POST  /doctor/auth                            { passcode } -> session cookie
POST  /doctor/logout
GET   /doctor/me                              session check on app boot
GET   /doctor/assessments?category=&q=&page=  triage-sorted list
GET   /doctor/assessments/:id                 full detail + answers + result
GET   /doctor/questionnaire/:versionId        en-only schema for label rendering
POST  /doctor/assessments/:id/review          decision capture
```

### Validation

The client evaluates branching locally for instant screen transitions. **The server re-validates the complete answer set on submit** against the same versioned schema — every required-and-visible question must be answered, every value must be a legal code. The client is a convenience; the server is the authority.

The branching evaluator is a pure function of ~120 lines. Without a monorepo it is deliberately duplicated at `api/src/questionnaire/evaluator.ts` and `patient-web/src/questionnaire/evaluator.ts`, with a header comment in both pointing at the other. Duplicating 120 lines of pure logic is cheaper than the workspace tooling that has been ruled out — but it must be kept in sync, and an identical fixture file in both projects asserts they produce the same results.

`doctor-web` does not need the evaluator at all. It renders stored answers, it does not drive branching.

### How doctor-web renders Hindi answers in English

Answers are stored as codes (§7). To display them, `doctor-web` fetches the questionnaire version the assessment was captured under and looks up English labels for each code:

```
GET /doctor/questionnaire/:versionId    -> schema with en labels only
```

Cached by `versionId` in react-query with an infinite stale time — published versions are immutable. No translation happens at read time, and no question text is duplicated into the doctor app.

### Rate limiting
`@nestjs/throttler` — 20 assessment creations per IP per hour, 10 failed passcode attempts per IP per hour.

---

## 12. Frontend

### Routes — patient-web (`:5173`)

```
/                             landing — doctor profile, language toggle, Start
/a/:token/consent
/a/:token/details
/a/:token/complaint
/a/:token/q/:key              one question per screen
/emergency                    full-screen interrupt (no token in URL)
/a/:token/done                confirmation
```

### Routes — doctor-web (`:5176`)

```
/login                        passcode
/                             dashboard table
/patients/:id                 detail
```

With the apps split, the doctor routes lose their `/doctor` prefix — the whole app is the doctor panel. In production the two are separate deployments (for example `assess.clinic.in` and `review.clinic.in`), and the doctor host can sit behind an IP allowlist or VPN without affecting patient access.

### Patient flow principles

- **One question per screen for clinical questions**, grouped screens for details, red flags and function — see §6 for the measured counts that forced this.
- Large tap targets. Thumb-reachable Next button. Assume a mid-range Android phone in a waiting room on 4G.
- **Progress bar**, honest about branching: "Question 12 of about 30."
- **Back** always works and preserves answers.
- **Autosave** on every answer via `PATCH /answers`; the token URL resumes an interrupted session.
- **Disclaimer** in the footer of every screen.
- **No PII in URLs** — the token is opaque and carries no patient identity.
- Language toggle in the header on every screen.

### Doctor dashboard

Table, sorted by urgency then submission time, newest first.

| Priority | Patient | Age/Sex | Main complaint | Duration | Red flags | Verdict | Submitted | Status |
|---|---|---|---|---|---|---|---|---|

- Colour-coded priority chip; RED rows visually distinct at a glance
- Filter chips: All / RED / AMBER / GREY / GREEN / Unreviewed
- Search by name or mobile

### Doctor detail page

Everything above the fold in the first screen — that is the 30-second promise:

1. **Verdict banner** — category, urgency, pathway
2. **Snapshot** — name, age, sex, occupation, main complaint, duration, severity, function
3. **AI summary** — the 150-word read
4. **Why this verdict** — matched rules with their plain-English explanations
5. **Red flags** — explicit, including the negatives ("all red flags answered no")

Below the fold: full answers grouped by section, prior imaging, treatment history, free text, then the **decision capture** form.

---

## 13. Build phases

Each phase ends at a demonstrable state.

### Phase 0 — Scaffold
`api/` NestJS project, `patient-web/` and `doctor-web/` Vite projects, `.gitignore`, three `.env.example` files, `git init`, CORS for both web origins, Sequelize connected to the existing `spine` DB and verified with a health endpoint.
**Done when:** `GET /api/health` returns DB status, and both web apps render a placeholder that successfully calls it cross-origin.

### Phase 1 — Data layer
All migrations, models, associations, seeds: one doctor, questionnaire v1 (full bilingual schema from §6), draft rules from §8.
**Done when:** `spine` DB holds a published questionnaire version and a doctor row.

### Phase 2 — Questionnaire API + evaluator
Schema delivery, assessment lifecycle, autosave, the branching evaluator plus its shared fixtures.
**Done when:** a full assessment can be driven start to finish with curl.

### Phase 3 — patient-web
Landing, language, consent, details, complaint, one-question-per-screen flow, emergency interrupt, confirmation. Mobile-first.
**Done when:** a real patient journey completes on a phone viewport in under 7 minutes, in both languages.

### Phase 4 — Rules engine
Evaluator, all rules from §8, and the fixture suite — **at minimum 15 named patient scenarios**, at least one per rule plus the collision and unmatched cases.
**Done when:** `npm test` in `api/` is green and every rule has a passing fixture.

*Phase 4 comes before Phase 5 deliberately. The rules are the product; the AI is presentation.*

### Phase 5 — AI summary

Split in two. 5a builds the dataset; 5b trains and ships the model. No third-party service in either.

*Base model settled by bake-off: **Gemma 3 4B**. See `training-data/bakeoff/RESULTS.md`.*

**5a — Training set.** Synthetic patient generator sweeping all 26 rules, Hinglish free-text synthesis for the two textarea fields, 300–500 hand-authored target summaries, programmatic expansion, held-out split.
**Done when:** every rule has labelled examples, a meaningful share carry Hinglish free text, and the set is split for training and evaluation.

**5b — Model.** LoRA fine-tune of Qwen 3 4B on the M1 via MLX, five-constraint eval harness, local inference server, wired behind the existing `TriageService` call site with the template as fallback.
**Done when:** the summary is generated on-device with no network call, passes the eval on the held-out set, and pulling the network changes nothing.

*5a is the long pole — authoring is the bulk of the work. 5b is cheap in effort but slow in wall-clock: each training iteration is an overnight run on an M1, so budget two or three. The deterministic template ships in the meantime, so the doctor panel is never without a summary.*

### Phase 6 — doctor-web
Passcode gate, session handling, dashboard, detail page, label rendering from the versioned schema, decision capture, audit logging.
**Done when:** the doctor journey works end to end from a patient submission made in Hindi, displayed entirely in English.

### Phase 7 — Demo readiness
Disclaimers everywhere, empty and error states, seed 12 demo patients spanning all four categories (including one cauda equina and one vascular-mimic), root `README.md` covering all three projects, demo script.
**Done when:** the demo can be run cold from a fresh clone in under five minutes — three terminals, documented.

---

## 14. Questions for the doctor at the demo

Bring this list. Answers here are worth more than any feature you could add before the meeting.

**Clinical logic**
1. Is the red-flag set complete? Anything routinely asked that is missing?
2. Is 6 weeks the right conservative-care threshold before a spine consult?
3. For lumbar canal stenosis — is age ≥ 50 the right gate, or too restrictive?
4. Should cervical myelopathy screening trigger RED, or urgent AMBER?
5. Where should GREY patients actually be sent — named colleagues, or a generic specialty?
6. Is "previous spine surgery" always AMBER, or should it depend on symptoms?

**Workflow**
7. Who reads the dashboard — the doctor, or reception staff triaging on their behalf?
8. Should GREEN patients be told to see a physiotherapist automatically, or does the clinic want a human in that loop?
9. What happens to a RED patient today? Is a phone call needed, and who makes it?
10. Should the patient see anything at all about their own result, or only "we have received your answers"?

**Content**
11. Is the Hindi wording right for this patient population? Regional terms often beat textbook Hindi.
12. Any regional language beyond Hindi needed?
13. Is 30 questions acceptable, or should it be shorter even at the cost of accuracy?

---

## 15. Known limitations

| # | Limitation |
|---|---|
| 1 | Clinical logic is unreviewed. This is the primary risk and the reason for §14. |
| 2 | No imaging upload — the doctor sees that an MRI exists, not what it shows. |
| 3 | Passcode auth only. Not adequate for real patient data at any volume. |
| 4 | Self-reported symptoms, no examination. Patients under- and over-report; the tool prepares a consult, it does not replace one. |
| 5 | No mobile verification — junk submissions are possible. |
| 6 | Single doctor, no multi-tenancy. |
| 7 | Under India's DPDP Act 2023 this is sensitive personal data. Before any real patient uses it: retention policy, encryption at rest, a named data fiduciary, and a deletion mechanism. Out of scope for the POC, mandatory before launch. |
| 8 | The GREY bucket carries the highest clinical risk in the design — a wrongly-routed patient is worse than an unfiltered one. GREY rules are written conservatively (any radicular or neurological finding blocks GREY) and every GREY case still reaches the doctor's dashboard. Nobody is ever turned away by the software. |
