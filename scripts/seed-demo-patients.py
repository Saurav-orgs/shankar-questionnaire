#!/usr/bin/env python3
"""Seed demo patients for the doctor-panel demo.

Drives assessments through the real API (branching, validation, triage all run
exactly as they would for a real patient), producing one patient per triage
bucket plus an emergency. Safe to re-run — it deletes previous DEMO patients
first, matched by their reserved mobile numbers.

Usage:  python3 scripts/seed-demo-patients.py
Requires the API running on http://localhost:4000 and psql access to `spine`.
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
    "9000000001", "9000000002", "9000000003",
    "9000000004", "9000000005", "9000000006",
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


def clear_previous():
    mobiles = "','".join(DEMO_MOBILES)
    sql = (
        f"DELETE FROM assessments WHERE patient_mobile IN ('{mobiles}');"
    )
    env = dict(os.environ, PGPASSWORD="11223344")
    subprocess.run(
        ["psql", "-h", "localhost", "-U", "rohitsingh", "-d", "spine",
         "-tAc", sql],
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


NO_RF = {"rf_bladder": "no", "rf_bowel": "no", "rf_saddle": "no",
         "rf_progressive_weakness": "no", "rf_trauma": "no", "rf_fever": "no",
         "rf_cancer": "no", "rf_weight_loss": "no", "rf_night_pain": "no",
         "rf_immuno": "no"}


PATIENTS = [
    # 1. RED — cauda equina, triggers the emergency interrupt.
    ("hi", {
        "name": "Ramesh Yadav", "age": 52, "gender": "male",
        "mobile": "9000000001", "city": "Nagpur", "occupation": "farm_labour",
        "chief_complaint": ["low_back_pain", "leg_pain"],
        "primary_complaint": "low_back_pain",
        **NO_RF, "rf_saddle": "yes",
    }),
    # 2. AMBER — classic lumbar radiculopathy, failed conservative care.
    ("en", {
        "name": "Rahul Sharma", "age": 43, "gender": "male",
        "mobile": "9000000002", "city": "Pune", "occupation": "driver",
        **NO_RF,
        "chief_complaint": ["low_back_pain", "leg_pain", "numbness"],
        "primary_complaint": "low_back_pain",
        "lbp_duration": "3_12m", "lbp_onset": "gradual", "lbp_severity": 8,
        "lbp_radiate": "below_knee", "lbp_side": "right", "lbp_cough": "yes",
        "lbp_sitting": "yes", "lbp_walking": "no", "lbp_walk_distance": "gt_500m",
        "lbp_bend_relief": "no", "lbp_numbness": "yes", "lbp_weakness": "no",
        "lbp_rest_relief": "yes", "hip_groin": "no", "vasc_claudication": "sit_bend",
        "inflam_morning_stiffness": "no", "inflam_exercise_better": "no",
        "widespread_pain": "no", "func_work": "difficulty", "func_sleep": "sometimes",
        "func_daily": "independent", "func_worsening": "same",
        "tx_tried": ["painkillers", "physio"], "tx_physio_duration": "gt_6w",
        "tx_response": "not_at_all", "img_done": ["mri"], "img_when": "lt_3m",
        "comorbidities": ["none"],
        "free_text": "Pain is much worse after long driving shifts.",
    }),
    # 3. AMBER — cervical myelopathy screen positive -> RED actually.
    ("en", {
        "name": "Anjali Menon", "age": 60, "gender": "female",
        "mobile": "9000000003", "city": "Kochi", "occupation": "teacher",
        **NO_RF,
        "chief_complaint": ["neck_pain", "arm_pain", "numbness"],
        "primary_complaint": "neck_pain",
        "neck_duration": "3_12m", "neck_severity": 6, "neck_radiate": "below_elbow",
        "neck_side": "both", "neck_numbness_hand": "yes", "neck_grip": "yes",
        "myelo_buttons": "yes", "myelo_gait": "yes", "myelo_both_hands": "yes",
        "myelo_urinary": "yes", "neck_headache": "no",
        "shoulder_overhead": "no", "widespread_pain": "no",
        "func_work": "difficulty", "func_sleep": "sometimes",
        "func_daily": "some_help", "func_worsening": "worse",
        "tx_tried": ["painkillers"], "tx_response": "not_at_all",
        "img_done": ["none"], "comorbidities": ["thyroid"],
        "is_pregnant": "no",
    }),
    # 4. GREY — hip, not spine. The "unwanted" patient the clinic wants filtered.
    ("hi", {
        "name": "Sunita Devi", "age": 66, "gender": "female",
        "mobile": "9000000004", "city": "Jaipur", "occupation": "homemaker",
        **NO_RF,
        "chief_complaint": ["low_back_pain"], "primary_complaint": "low_back_pain",
        "lbp_duration": "gt_1y", "lbp_onset": "gradual", "lbp_severity": 6,
        "lbp_radiate": "buttock", "lbp_side": "left", "lbp_cough": "no",
        "lbp_sitting": "no", "lbp_walking": "yes", "lbp_walk_distance": "gt_500m",
        "lbp_bend_relief": "no", "lbp_numbness": "no", "lbp_weakness": "no",
        "lbp_rest_relief": "yes",
        "hip_groin": "yes", "hip_socks": "yes", "vasc_claudication": "neither",
        "inflam_morning_stiffness": "no", "inflam_exercise_better": "no",
        "widespread_pain": "no", "func_work": "difficulty", "func_sleep": "sometimes",
        "func_daily": "independent", "func_worsening": "same",
        "tx_tried": ["painkillers"], "tx_response": "partly",
        "img_done": ["xray"], "img_when": "gt_1y", "comorbidities": ["hypertension"],
        "is_pregnant": "no",
    }),
    # 5. GREY — vascular claudication mimic.
    ("en", {
        "name": "Iqbal Khan", "age": 64, "gender": "male",
        "mobile": "9000000005", "city": "Lucknow", "occupation": "shop_business",
        **NO_RF,
        "chief_complaint": ["leg_pain", "walking_difficulty"],
        "primary_complaint": "leg_pain",
        "lbp_duration": "3_12m", "lbp_onset": "gradual", "lbp_severity": 5,
        "lbp_radiate": "buttock", "lbp_side": "both", "lbp_cough": "no",
        "lbp_sitting": "no", "lbp_walking": "yes", "lbp_walk_distance": "100_500m",
        "lbp_bend_relief": "no", "lbp_numbness": "no", "lbp_weakness": "no",
        "lbp_rest_relief": "yes", "hip_groin": "no",
        "vasc_claudication": "stand_still",
        "inflam_morning_stiffness": "no", "inflam_exercise_better": "no",
        "widespread_pain": "no", "func_work": "difficulty", "func_sleep": "never",
        "func_daily": "independent", "func_worsening": "same",
        "tx_tried": ["nothing"], "img_done": ["none"],
        "comorbidities": ["diabetes", "smoking"],
    }),
    # 6. GREEN — chronic mechanical, conservative care never tried.
    ("en", {
        "name": "Priya Nair", "age": 34, "gender": "female",
        "mobile": "9000000006", "city": "Pune", "occupation": "desk_job",
        **NO_RF,
        "chief_complaint": ["low_back_pain"], "primary_complaint": "low_back_pain",
        "lbp_duration": "6w_3m", "lbp_onset": "gradual", "lbp_severity": 4,
        "lbp_radiate": "none", "lbp_sitting": "yes", "lbp_walking": "no",
        "lbp_walk_distance": "unlimited", "lbp_numbness": "no", "lbp_weakness": "no",
        "lbp_rest_relief": "yes", "hip_groin": "no",
        "inflam_morning_stiffness": "no", "inflam_exercise_better": "no",
        "widespread_pain": "no", "func_work": "difficulty", "func_sleep": "never",
        "func_daily": "independent", "func_worsening": "same",
        "tx_tried": ["rest"], "tx_response": "partly",
        "img_done": ["none"], "comorbidities": ["none"], "is_pregnant": "no",
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
