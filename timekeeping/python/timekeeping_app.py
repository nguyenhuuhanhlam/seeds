"""
Streamlit UI for timekeeping_minutes.py - runs on macOS/Windows/Linux,
no tkinter dependency.

Two-column layout:
    - Left  : processing parameters (upload raw log, month, format) + Run + download
    - Right : user list table, reads/writes users.json directly (add/edit/delete rows inline)

Requirements:
    pip install streamlit pandas openpyxl reportlab
    (timekeeping_minutes.py must be in the SAME FOLDER as this file)

Run:
    streamlit run timekeeping_app.py
"""

import io
import os
import sys
import json
import tempfile
from datetime import date, timedelta

import pandas as pd
import streamlit as st

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)
import timekeeping_minutes as core  # noqa: E402

USERS_JSON_PATH = os.path.join(SCRIPT_DIR, "users.json")
USER_COLUMNS = ["member_id", "department", "name"]


# ============================================================================
# HELPERS - users.json <-> DataFrame
# ============================================================================
def _load_users_df() -> pd.DataFrame:
    raw = []
    if os.path.exists(USERS_JSON_PATH):
        try:
            with open(USERS_JSON_PATH, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except Exception as e:
            st.warning(f"Could not read users.json: {e}")

    df = pd.DataFrame(raw)
    for col in USER_COLUMNS:
        if col not in df.columns:
            df[col] = None
    return df[USER_COLUMNS]


def _save_users_df(df: pd.DataFrame):
    records = []
    for _, row in df.iterrows():
        mid = row.get("member_id")
        if mid is None or (isinstance(mid, float) and pd.isna(mid)) or str(mid).strip() == "":
            continue
        try:
            mid_val = int(mid)
        except (ValueError, TypeError):
            mid_val = str(mid).strip()

        entry = {"member_id": mid_val}
        dept = row.get("department")
        if dept and str(dept).strip():
            entry["department"] = str(dept).strip()
        name = row.get("name")
        if name and str(name).strip():
            entry["name"] = str(name).strip()
        records.append(entry)

    with open(USERS_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False, indent=2)


def _default_month_str() -> str:
    """Previous month relative to today, formatted YYYY-MM."""
    today = date.today()
    last_day_prev_month = today.replace(day=1) - timedelta(days=1)
    return f"{last_day_prev_month.year:04d}-{last_day_prev_month.month:02d}"


# ============================================================================
# PAGE / STYLE - minimal, modern, small headings
# ============================================================================
st.set_page_config(page_title="Timekeeping", page_icon="🕒", layout="wide")

st.markdown(
    """
    <style>
        #MainMenu, footer, header {visibility: hidden;}
        .block-container {padding-top: 2.5rem; padding-bottom: 3rem; max-width: 1180px;}
        h1, h2, h3, h4, h5 {font-weight: 600; letter-spacing: -0.01em;}
        h1 {font-size: 1.35rem !important;}
        h2 {font-size: 1.15rem !important;}
        h3 {font-size: 1.0rem !important;}
        h4 {font-size: 0.92rem !important; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(49,51,63,0.75);}
        .stButton>button, .stDownloadButton>button {
            border-radius: 8px;
            border: 1px solid rgba(49,51,63,0.15);
            font-weight: 500;
            padding: 0.5rem 1rem;
            transition: all .15s ease;
        }
        .stButton>button:hover, .stDownloadButton>button:hover {
            border-color: rgba(49,51,63,0.4);
        }
        div[data-testid="stFileUploaderDropzone"] {border-radius: 10px;}
        .caption-muted {color: rgba(49,51,63,0.6); font-size: 0.82rem; margin-top: -0.6rem;}
        hr {margin: 1.2rem 0; opacity: 0.25;}
    </style>
    """,
    unsafe_allow_html=True,
)

st.markdown("#### 🕒 Timekeeping")
st.markdown(
    '<p class="caption-muted">Process raw timekeeping data &rarr; Excel / JSON / PDF</p>',
    unsafe_allow_html=True,
)
st.markdown("<hr/>", unsafe_allow_html=True)

col_left, col_right = st.columns([1, 1.4], gap="large")

# ============================================================================
# LEFT COLUMN - PROCESSING PARAMETERS
# ============================================================================
with col_left:
    st.markdown("##### Parameters")

    uploaded_file = st.file_uploader("Raw log file (.txt or .dat)", type=["txt", "dat"])
    month_str = st.text_input(
        "Month (YYYY-MM, leave blank = all)",
        value=_default_month_str(),
    )
    fmt = st.radio("Output format", ["xlsx", "json", "pdf"], horizontal=True)

    run = st.button("▶  Run", type="primary", use_container_width=True)

    if run:
        if not uploaded_file:
            st.error("Please upload an input file.")
        else:
            try:
                month = core.parse_month_arg(month_str.strip()) if month_str.strip() else None

                text = uploaded_file.getvalue().decode("utf-8")
                punches = core.parse_raw_lines(io.StringIO(text), month_filter=month)
                data = core.build_json(punches, month=month)

                employee_info = {}
                if os.path.exists(USERS_JSON_PATH):
                    employee_info = core.load_users_json(USERS_JSON_PATH)

                if month:
                    y, m = month
                    base_name = f"{y:04d}-{m:02d}"
                else:
                    base_name = "timekeeping"

                if fmt == "json":
                    out_bytes = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
                    out_name = f"{base_name}.json"
                else:
                    suffix = ".xlsx" if fmt == "xlsx" else ".pdf"
                    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                        tmp_path = tmp.name
                    if fmt == "xlsx":
                        core._build_xlsx(data, tmp_path, employee_info)
                    else:
                        core._build_pdf(data, tmp_path, employee_info)
                    with open(tmp_path, "rb") as f:
                        out_bytes = f.read()
                    os.remove(tmp_path)
                    out_name = f"{base_name}{suffix}"

                st.session_state["result_bytes"] = out_bytes
                st.session_state["result_name"] = out_name
                st.success(f"Processed {len(data)} user(s) successfully.")
            except Exception as e:
                st.error(f"Error: {e}")

    if "result_bytes" in st.session_state:
        st.download_button(
            "⬇  Download result",
            data=st.session_state["result_bytes"],
            file_name=st.session_state["result_name"],
            use_container_width=True,
        )

# ============================================================================
# RIGHT COLUMN - USER LIST (users.json)
# ============================================================================
with col_right:
    st.markdown("##### User list")
    st.markdown(
        '<p class="caption-muted">Edit directly in the table — add a row at the bottom, delete via the 🗑 icon</p>',
        unsafe_allow_html=True,
    )

    if "users_df" not in st.session_state:
        st.session_state.users_df = _load_users_df()

    edited_df = st.data_editor(
        st.session_state.users_df,
        num_rows="dynamic",
        use_container_width=True,
        height=420,
        column_config={
            "member_id": st.column_config.NumberColumn("User ID", required=True, step=1),
            "department": st.column_config.TextColumn("Department"),
            "name": st.column_config.TextColumn("Name"),
        },
        key="users_editor",
    )

    c1, c2 = st.columns(2)
    with c1:
        if st.button("↻  Reload", use_container_width=True):
            st.session_state.users_df = _load_users_df()
            st.rerun()
    with c2:
        if st.button("💾  Save users.json", type="primary", use_container_width=True):
            _save_users_df(edited_df)
            st.session_state.users_df = edited_df
            st.success("Saved users.json")
