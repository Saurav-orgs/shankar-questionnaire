#!/usr/bin/env python3
"""Seed demo patients for the doctor-panel demo.

Drives assessments through the real API (branching, validation, triage all run
exactly as they would for a real patient), producing patients across all five
appointment categories (RED / A / B / C / D). Safe to re-run — it deletes
previous DEMO patients first, matched by their reserved mobile numbers.

Usage:  npm --prefix api run seed:demo
    or  python3 api/scripts/seed-demo-patients.py

Requires the API running on http://localhost:4000 and psql access to the
database named in api/.env.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request

BASE = "http://localhost:4000/api"

# Reserved mobiles so re-running clears exactly the demo rows and nothing else.
DEMO_MOBILES = [
    "9000000001", "9000000002", "9000000003", "9000000004",
    "9000000005", "9000000006", "9000000007", "9000000008",
]


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or "{}")


def db_config():
    """DATABASE_* from api/.env, so this script targets the API's own database."""
    cfg = {"DATABASE_HOST": "localhost", "DATABASE_PORT": "5432"}
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    try:
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith("DATABASE_") and "=" in line:
                    k, v = line.split("=", 1)
                    cfg[k] = v.strip().strip('"').strip("'")
    except FileNotFoundError:
        pass
    return cfg


def clear_previous():
    mobiles = "','".join(DEMO_MOBILES)
    sql = (
        f"DELETE FROM assessments WHERE patient_mobile IN ('{mobiles}');"
    )
    cfg = db_config()
    env = dict(os.environ, PGPASSWORD=cfg.get("DATABASE_PASSWORD", ""))
    subprocess.run(
        ["psql", "-h", cfg["DATABASE_HOST"], "-p", cfg["DATABASE_PORT"],
         "-U", cfg.get("DATABASE_USER", os.environ.get("USER", "")),
         "-d", cfg.get("DATABASE_NAME", "spine"), "-tAc", sql],
        env=env, check=True, capture_output=True,
    )


def submit(answers, language="en"):
    _, s = call("POST", "/assessments", {"language": language, "consent": True})
    token = s["token"]
    for _ in range(90):
        _, st = call("GET", f"/assessments/{token}")
        key = st["nextQuestionKey"]
        if key is None or key not in answers:
            remaining = [k for k in st["missingRequiredKeys"] if k in answers]
            if not remaining:
                # Nothing left we can answer. If required questions are still
                # outstanding, the scenario is under-specified — surface it
                # loudly rather than leaving a half-filled in_progress patient.
                unfillable = [
                    k for k in st["missingRequiredKeys"] if k not in answers
                ]
                if unfillable:
                    raise SystemExit(
                        f"{answers['name']}: scenario is missing answers for "
                        f"required questions {unfillable}"
                    )
                break
            key = remaining[0]
        _, r = call("PATCH", f"/assessments/{token}/answers",
                    {"answers": {key: answers[key]}, "currentQuestionKey": key})
        if r.get("emergency"):
            return "emergency"
    _, r = call("POST", f"/assessments/{token}/submit")
    if r.get("problems"):
        raise SystemExit(f"{answers['name']}: submit rejected — {r['problems']}")
    return "submitted"


CLEAN = {"city": "Delhi", "previous_patient": "no",
         "weakness": "no", "walking_balance": "no",
         "has_imaging": "no", "diagnosis": ["dont_know"],
         "surgery_advised": "no"}


PATIENTS = [
    # 1. RED — weakness and walking both progressively worse.
    ("hi", {
        "name": "Ramesh Yadav", "age": 52, "gender": "male",
        "mobile": "9000000001",
        **CLEAN,
        "main_problem": ["back_pain", "leg_pain", "weakness"],
        "weakness": "progressive", "walking_balance": "progressive",
        "duration": "6w_3m", "treatment": ["medicines"],
        "treatment_response": "worse", "consult_reason": "evaluate_surgery",
    }),
    # 2. RED — spine injury with numbness.
    ("en", {
        "name": "Iqbal Khan", "age": 64, "gender": "male",
        "mobile": "9000000002",
        **CLEAN,
        "main_problem": ["back_pain", "injury", "numbness_tingling"],
        "duration": "lt_6w", "treatment": ["none"],
        "has_imaging": "yes", "diagnosis": ["fracture"],
        "consult_reason": "evaluate_surgery",
    }),
    # 3. A — the SOP's own example: surgery advised (TLIF), progressive leg
    #    weakness, walking difficulty, >6 months, physio/medicines failed, MRI.
    ("en", {
        "name": "Rahul Sharma", "age": 54, "gender": "male",
        "mobile": "9000000003",
        **CLEAN,
        "main_problem": ["back_pain", "leg_pain"],
        "weakness": "progressive", "walking_balance": "yes",
        "duration": "gt_6m", "treatment": ["medicines", "physio"],
        "treatment_response": "no_improvement",
        "has_imaging": "yes", "diagnosis": ["spondylolisthesis"],
        "surgery_advised": "yes", "surgery_advised_detail": "TLIF",
        "consult_reason": "surgery_advised",
    }),
    # 4. A — second opinion AFTER surgery was advised: the SOP's carve-out.
    ("en", {
        "name": "Anjali Menon", "age": 60, "gender": "female",
        "mobile": "9000000004",
        **CLEAN,
        "main_problem": ["neck_pain", "arm_pain"],
        "weakness": "stable",
        "duration": "3_6m", "treatment": ["medicines", "physio"],
        "treatment_response": "partial",
        "has_imaging": "yes", "diagnosis": ["cervical_myelopathy"],
        "surgery_advised": "yes", "surgery_advised_detail": "ACDF C5-C6",
        "consult_reason": "second_opinion",
    }),
    # 5. B — persistent sciatica with an MRI showing a disc: score 6.
    ("hi", {
        "name": "Sunita Devi", "age": 66, "gender": "female",
        "mobile": "9000000005", "city": "Ghaziabad",
        **{k: v for k, v in CLEAN.items() if k != "city"},
        "main_problem": ["back_pain", "leg_pain"],
        "duration": "gt_6m", "treatment": ["medicines", "other"],
        "treatment_response": "partial",
        "has_imaging": "yes", "diagnosis": ["disc_prolapse"],
        "consult_reason": "evaluate_surgery",
    }),
    # 6. C — the SOP's routine example: three weeks of back pain, nothing else.
    ("en", {
        "name": "Priya Nair", "age": 38, "gender": "female",
        "mobile": "9000000006",
        **CLEAN,
        "main_problem": ["back_pain"],
        "duration": "lt_6w", "treatment": ["none"],
        "consult_reason": "routine_advice",
    }),
    # 7. D — only wants the MRI looked at.
    ("hi", {
        "name": "Mohan Lal", "age": 47, "gender": "male",
        "mobile": "9000000007", "city": "Meerut",
        **{k: v for k, v in CLEAN.items() if k != "city"},
        "main_problem": ["back_pain"],
        "duration": "3_6m", "treatment": ["medicines"],
        "treatment_response": "partial",
        "has_imaging": "yes", "diagnosis": ["disc_prolapse"],
        "consult_reason": "report_review",
    }),
    # 8. D — second opinion regarding surgery, but nobody has advised surgery.
    ("en", {
        "name": "Kavita Joshi", "age": 41, "gender": "female",
        "mobile": "9000000008",
        **CLEAN,
        "main_problem": ["neck_pain"],
        "duration": "6w_3m", "treatment": ["physio"],
        "treatment_response": "partial",
        "consult_reason": "second_opinion",
    }),
]


def main():
    # Fail fast if the API isn't up.
    try:
        s, _ = call("GET", "/health")
        if s != 200:
            print("API health check failed. Start the API first.", file=sys.stderr)
            sys.exit(1)
    except urllib.error.URLError:
        print("Cannot reach the API on :4000. Start it first.", file=sys.stderr)
        sys.exit(1)

    clear_previous()
    print("Cleared previous demo patients.\n")

    for lang, answers in PATIENTS:
        outcome = submit(answers, language=lang)
        print(f"  {answers['name']:16s} [{lang}] -> {outcome}")

    print("\nDone. Open the doctor panel to review.")


if __name__ == "__main__":
    main()
