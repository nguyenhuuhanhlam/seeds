"""
Xử lý dữ liệu chấm công thô -> xuất Excel (1 sheet duy nhất cho tất cả user), hoặc JSON.

CÔNG THỨC (theo yêu cầu khách hàng, cập nhật mới nhất):
    Ca HC gồm 2 khung giờ chuẩn:
        - Sáng : 8:30  -> 12:00  (3.5h)
        - Chiều: 13:00 -> 17:30  (4.5h)
        - Tổng : 8h / ngày công đầy đủ

    Trễ (min) = Vào - 8:30 (phút), không âm
    Công Trễ  = Trễ (min) quy đổi theo 1 ngày công (8h = 480 phút = 1 công)
    TG (hours) = tổng số giờ làm việc THỰC TẾ nằm trong 2 khung giờ chuẩn trên
           (phần đi sớm trước 8:30 hoặc về sau 17:30 không tính vào TG)
    CôngTG = TG (hours) / 8 (ngày công chuẩn hóa, 8 tiếng = 1 công)
    LT (phút) = phần phút Ra vượt quá 17:30, không âm
    Công LT   = LT quy đổi theo 1 ngày công (8h = 480 phút = 1 công)
    Đã BỎ cột "Sớm" theo yêu cầu mới.

Cách dùng:
    python timekeeping.py raw_log.txt --month 2026-07
        -> xuất "2026-07.xlsx" (1 sheet duy nhất, tất cả user), tên file tự đặt theo tháng

    python timekeeping.py raw_log.txt --month 2026-07 --output bang_cong.xlsx
    python timekeeping.py raw_log.txt --month 2026-07 --format json --output data.json
    python timekeeping.py raw_log.txt --month 2026-07 --info employee_info.json

Định dạng dòng input (tab hoặc nhiều space đều được):
    <user_id>  <YYYY-MM-DD HH:MM:SS>  <status1> <status2> <status3> <status4>
Ví dụ:
    5    2026-07-11 16:20:28    1    0    0    0

employee_info.json (tùy chọn, truyền qua --info) có dạng:
    {"5": {"name": "Phương Minh Tú", "dept": "Kết cấu"}, ...}

users.json (tùy chọn, ĐẶT CÙNG THƯ MỤC với file script này, tự động nhận,
không cần truyền tham số) có dạng list các user:
    [
        {"member_id": 7, "department": "ABC"},
        {"member_id": 12, "department": "Kết cấu", "name": "Phương Minh Tú"}
    ]
    - Nếu user không có trong users.json (hoặc thiếu department/name) -> bỏ qua, để trống.
    - uid vẫn lấy như bình thường từ file log thô (không phụ thuộc users.json).
    - Nếu vừa có --info vừa có users.json, --info được ưu tiên.
"""

import os
import re
import sys
import json
import calendar
import argparse
from datetime import datetime, date, time
from collections import defaultdict

# ----------------------- CẤU HÌNH CA LÀM VIỆC (HC) -----------------------
HC_MORNING_START = time(8, 30)      # Sáng bắt đầu (cũng dùng tính Trễ)
HC_MORNING_END = time(12, 0)        # Sáng kết thúc (3.5h)
HC_AFTERNOON_START = time(13, 0)    # Chiều bắt đầu
HC_AFTERNOON_END = time(17, 30)     # Chiều kết thúc (4.5h) -> mốc tính Tps
NGAY_CONG_HOURS = 8.0                # 8 tiếng = 1 ngày công (NC) -> Công = TG / 8

THU_VN = {0: "T2", 1: "T3", 2: "T4", 3: "T5", 4: "T6", 5: "T7", 6: "CN"}

LINE_RE = re.compile(
    r"^\s*(?P<uid>\d+)\s+(?P<dt>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})"
)


def parse_raw_lines(f, month_filter=None):
    """
    Đọc file log theo từng dòng (streaming, không load hết file vào RAM).
    Với mỗi (user, ngày) chỉ giữ [vao, ra, count], cập nhật min/max ngay khi đọc.
    month_filter: tuple (year, month) hoặc None -> lọc ngay khi đọc.
    """
    punches = {}  # uid -> {day: [vao, ra, count]}
    for line in f:
        m = LINE_RE.match(line)
        if not m:
            continue
        dt = datetime.strptime(m.group("dt"), "%Y-%m-%d %H:%M:%S")
        if month_filter and (dt.year, dt.month) != month_filter:
            continue

        uid = m.group("uid")
        day = dt.date()
        day_map = punches.setdefault(uid, {})
        entry = day_map.get(day)
        if entry is None:
            day_map[day] = [dt, dt, 1]
        else:
            if dt < entry[0]:
                entry[0] = dt
            if dt > entry[1]:
                entry[1] = dt
            entry[2] += 1
    return punches


def calc_minutes_diff(t1: time, t2: time) -> int:
    """Số phút t2 - t1 (cùng trong 1 ngày)."""
    d1 = datetime.combine(date.today(), t1)
    d2 = datetime.combine(date.today(), t2)
    return int((d2 - d1).total_seconds() // 60)


def _overlap_minutes(vao: datetime, ra: datetime, start: time, end: time) -> int:
    """Số phút giao nhau giữa khoảng [vao, ra] và khung giờ chuẩn [start, end]. Bỏ qua phần giây."""
    day = vao.date()
    win_start = datetime.combine(day, start)
    win_end = datetime.combine(day, end)
    lo = max(vao, win_start).replace(second=0, microsecond=0)
    hi = min(ra, win_end).replace(second=0, microsecond=0)
    if hi <= lo:
        return 0
    return int((hi-lo).total_seconds() // 60)


def build_day_record(day: date, vao: datetime, ra: datetime):
    """Tính Trễ, Công Trễ, TG, CôngTG, LT, Công LT cho 1 ngày (Ca HC = 8:30-12:00 + 13:00-17:30)."""
    record = {
        "Ngày": day.strftime("%-m/%-d/%Y") if sys.platform != "win32" else day.strftime("%#m/%#d/%Y"),
        "Thứ": THU_VN[day.weekday()],
        "Ca": "HC",
        "Vào": vao.strftime("%H:%M") if vao else "",
        "Ra": ra.strftime("%H:%M") if ra else "",
        "Trễ (min)": 0,
        "Công Trễ": 0,
        "TG (hours)": "-",
        "CôngTG": "-",
        "LT": 0,   # LT = phút Ra vượt quá 17:30, không âm
        "Công LT": 0,
        "Kí hiệu": "",
    }

    # Trễ (min) = Vào - 8:30 (phút), không âm
    # Công Trễ = Trễ (min) quy đổi theo 1 ngày công (8h = 480 phút = 1 công)
    if vao:
        tre_min = max(int(calc_minutes_diff(HC_MORNING_START, vao.time())), 0)
        record["Trễ (min)"] = tre_min
        record["Công Trễ"] = round(tre_min / (NGAY_CONG_HOURS * 60), 4)

    # LT = phần PHÚT Ra vượt quá 17:30, không âm
    # Công LT = LT quy đổi theo 1 ngày công (8h = 480 phút = 1 công)
    if ra:
        diff_min = calc_minutes_diff(HC_AFTERNOON_END, ra.time())  # Ra - 17:30 (phút)
        lt_min = max(diff_min, 0)
        record["LT"] = lt_min
        record["Công LT"] = round(lt_min / (NGAY_CONG_HOURS * 60), 4)

    if vao and ra and ra > vao:
        # TG (hours) tính theo PHÚT để tránh sai số float
        morning_min = _overlap_minutes(vao, ra, HC_MORNING_START, HC_MORNING_END)
        afternoon_min = _overlap_minutes(vao, ra, HC_AFTERNOON_START, HC_AFTERNOON_END)
        tg_minutes = morning_min + afternoon_min
        record["TG (hours)"] = round(tg_minutes / 60.0, 2)
        record["CôngTG"] = round(tg_minutes / (NGAY_CONG_HOURS * 60), 4)
    elif not vao and not ra:
        # Không chấm công cả ngày: T7/CN -> 0 ; ngày thường (vắng) -> "-"
        if day.weekday() >= 5:
            record["TG (hours)"] = 0
            record["CôngTG"] = 0
    # else: chỉ có 1 trong 2 (Vào hoặc Ra) -> giữ "-" (thiếu dữ liệu, không đủ tính)

    return record


def build_blank_day_record(day: date):
    """Dòng trống cho ngày không có dữ liệu chấm công: chỉ giữ giá trị Ngày, Thứ."""
    return {
        "Ngày": day.strftime("%-m/%-d/%Y") if sys.platform != "win32" else day.strftime("%#m/%#d/%Y"),
        "Thứ": THU_VN[day.weekday()],
        "Ca": "",
        "Vào": "",
        "Ra": "",
        "Trễ (min)": "",
        "Công Trễ": "",
        "TG (hours)": "",
        "CôngTG": "",
        "LT": "",
        "Công LT": "",
        "Kí hiệu": "",
    }


def compute_summary(rows):
    """Các chỉ số tổng hợp đầu bảng:
    - Công làm: số ngày CÓ chấm Vào
    - Số lần trễ: số ngày có Trễ (min) > 0
    - Tổng Trễ (phút) / Tổng Công Trễ: tổng cộng cả tháng
    - Tổng TG (hours) / Tổng CôngTG: tổng cộng cả tháng
    - Tổng LT (phút) / Tổng Công LT: tổng cộng cả tháng
    """
    cong_lam = sum(1 for r in rows if r["Vào"])
    so_lan_tre = sum(1 for r in rows if isinstance(r["Trễ (min)"], (int, float)) and r["Trễ (min)"] > 0)
    tong_tre = sum(r["Trễ (min)"] for r in rows if isinstance(r["Trễ (min)"], (int, float)))
    tong_cong_tre = sum(r["Công Trễ"] for r in rows if isinstance(r["Công Trễ"], (int, float)))
    tong_tg = sum(r["TG (hours)"] for r in rows if isinstance(r["TG (hours)"], (int, float)))
    tong_cong = sum(r["CôngTG"] for r in rows if isinstance(r["CôngTG"], (int, float)))
    tong_lt = sum(r["LT"] for r in rows if isinstance(r["LT"], (int, float)))
    tong_cong_lt = sum(r["Công LT"] for r in rows if isinstance(r["Công LT"], (int, float)))

    return {
        "Công làm": cong_lam,
        "Số lần trễ": so_lan_tre,
        "Tổng Trễ (phút)": tong_tre,
        "Tổng Công Trễ": round(tong_cong_tre, 2),
        "Tổng TG (hours)": round(tong_tg, 2),
        "Tổng CôngTG": round(tong_cong, 2),
        "Tổng LT (phút)": tong_lt,
        "Tổng Công LT": round(tong_cong_lt, 2),
    }


def build_json(punches, month=None):
    """Chuyển punches -> dict {user_id: {"records": [...], "summary": {...}}}
    Nếu có month=(year, month), duyệt đủ TẤT CẢ ngày trong tháng đó; ngày nào
    không có dữ liệu chấm công sẽ là dòng trống (chỉ có Ngày, Thứ)."""
    result = {}
    if month:
        year, mo = month
        num_days = calendar.monthrange(year, mo)[1]
        all_days = [date(year, mo, d) for d in range(1, num_days + 1)]

    for uid, days in punches.items():
        rows = []
        day_list = all_days if month else sorted(days.keys())
        for day in day_list:
            if day in days:
                vao, ra, count = days[day]
                if count == 1:
                    ra = None  # chỉ có 1 lần chấm -> không xác định được giờ ra
                rows.append(build_day_record(day, vao, ra))
            else:
                rows.append(build_blank_day_record(day))
        result[uid] = {"records": rows, "summary": compute_summary(rows)}
    return result


def parse_month_arg(value: str):
    """Parse '--month YYYY-MM' -> (year, month). Raise nếu sai định dạng."""
    m = re.match(r"^(\d{4})-(\d{1,2})$", value)
    if not m:
        raise argparse.ArgumentTypeError("Định dạng phải là YYYY-MM, ví dụ 2026-07")
    year, month = int(m.group(1)), int(m.group(2))
    if not 1 <= month <= 12:
        raise argparse.ArgumentTypeError("Tháng phải từ 1-12")
    return year, month


# ============================================================================
#  XUẤT EXCEL — 1 SHEET DUY NHẤT, các user xếp nối tiếp nhau trong cùng sheet
# ============================================================================

def _build_xlsx(data, output_path, employee_info):
    from openpyxl import Workbook
    from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
    from openpyxl.utils import get_column_letter

    FONT_NAME = "Arial"
    HEADER_FONT = Font(name=FONT_NAME, size=10, bold=True)
    LABEL_FONT = Font(name=FONT_NAME, size=10, bold=True)
    VALUE_FONT = Font(name=FONT_NAME, size=10, italic=True)
    DATA_FONT = Font(name=FONT_NAME, size=10)
    TITLE_FONT = Font(name=FONT_NAME, size=10, bold=True, italic=True)

    CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
    LEFT = Alignment(horizontal="left", vertical="center")

    THIN = Side(style="thin", color="000000")
    BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)

    FILL_T7 = PatternFill("solid", fgColor="CCCCFF")
    FILL_CN = PatternFill("solid", fgColor="FF99CC")
    FILL_TITLE = PatternFill("solid", fgColor="FFFF00")

    N_COLS = 12  # Ngày,Thứ,Ca,Vào,Ra,Trễ (min),Công Trễ,TG (hours),CôngTG,LT,Công LT,Kí hiệu

    def merge_and_set(ws, cell_range, value, font=None, align=CENTER, border=True, fill=None):
        if ":" in cell_range:
            ws.merge_cells(cell_range)
            top_left = cell_range.split(":")[0]
            cells = [c for row in ws[cell_range] for c in row]
        else:
            top_left = cell_range
            cells = [ws[cell_range]]
        cell = ws[top_left]
        cell.value = value
        if font:
            cell.font = font
        cell.alignment = align
        for c in cells:
            if fill:
                c.fill = fill
            if border:
                c.border = BORDER

    def weekend_fill(thu):
        if thu == "T7":
            return FILL_T7
        if thu == "CN":
            return FILL_CN
        return None

    def write_user_block(ws, start_row, uid, user_data, info):
        records, summary = user_data["records"], user_data["summary"]
        name, dept = info.get("name", ""), info.get("dept", "")
        r = start_row

        merge_and_set(ws, f"A{r}:D{r}", f"Mã nhân viên: {uid}", LABEL_FONT, LEFT, fill=FILL_TITLE)
        merge_and_set(ws, f"E{r}:H{r}", f"Tên nhân viên: {name}", LABEL_FONT, LEFT, fill=FILL_TITLE)
        merge_and_set(ws, f"I{r}:L{r}", f"Bộ phận: {dept}", LABEL_FONT, LEFT, fill=FILL_TITLE)
        r += 1

        merge_and_set(ws, f"A{r}:B{r}", "Công làm", LABEL_FONT, LEFT)
        merge_and_set(ws, f"C{r}:D{r}", summary["Công làm"], VALUE_FONT)
        merge_and_set(ws, f"E{r}:F{r}", "Số lần trễ", LABEL_FONT, LEFT)
        merge_and_set(ws, f"G{r}:H{r}", summary["Số lần trễ"], VALUE_FONT)
        merge_and_set(ws, f"I{r}:J{r}", "Tổng Trễ (phút)", LABEL_FONT, LEFT)
        merge_and_set(ws, f"K{r}:L{r}", summary["Tổng Trễ (phút)"], VALUE_FONT)
        r += 1

        merge_and_set(ws, f"A{r}:B{r}", "Tổng Công Trễ", LABEL_FONT, LEFT)
        merge_and_set(ws, f"C{r}:D{r}", f'{summary["Tổng Công Trễ"]:.2f}', VALUE_FONT)
        merge_and_set(ws, f"E{r}:F{r}", "Tổng TG (hours)", LABEL_FONT, LEFT)
        merge_and_set(ws, f"G{r}:H{r}", f'{summary["Tổng TG (hours)"]:.2f}', VALUE_FONT)
        merge_and_set(ws, f"I{r}:J{r}", "Tổng CôngTG", LABEL_FONT, LEFT)
        merge_and_set(ws, f"K{r}:L{r}", f'{summary["Tổng CôngTG"]:.2f}', VALUE_FONT)
        r += 1

        merge_and_set(ws, f"A{r}:B{r}", "Tổng LT (phút)", LABEL_FONT, LEFT)
        merge_and_set(ws, f"C{r}:D{r}", summary["Tổng LT (phút)"], VALUE_FONT)
        merge_and_set(ws, f"E{r}:F{r}", "Tổng Công LT", LABEL_FONT, LEFT)
        merge_and_set(ws, f"G{r}:H{r}", f'{summary["Tổng Công LT"]:.2f}', VALUE_FONT)
        r += 1

        merge_and_set(ws, f"A{r}:L{r}", "Chi tiết", TITLE_FONT, LEFT, border=False)
        r += 1

        # Header bảng chi tiết - 2 tầng: dòng nhóm (Time line / Ngày làm / Đi muộn / Về muộn)
        # và dòng cột con (TG / Công lặp lại cho từng nhóm)
        group_row, sub_row = r, r + 1
        merge_and_set(ws, f"A{group_row}:E{group_row}", "Time line", HEADER_FONT)
        merge_and_set(ws, f"F{group_row}:G{group_row}", "Ngày làm (hour)", HEADER_FONT)
        merge_and_set(ws, f"H{group_row}:I{group_row}", "Đi muộn (min)", HEADER_FONT)
        merge_and_set(ws, f"J{group_row}:K{group_row}", "Về muộn (min)", HEADER_FONT)
        merge_and_set(ws, f"L{group_row}:L{sub_row}", "Kí hiệu", HEADER_FONT)

        sub_headers = ["Ngày", "Thứ", "Ca", "Vào", "Ra", "TG", "Công", "TG", "Công", "TG", "Công"]
        for col_idx, h in enumerate(sub_headers, start=1):
            cell = ws.cell(row=sub_row, column=col_idx, value=h)
            cell.font = HEADER_FONT
            cell.alignment = CENTER
            cell.border = BORDER
        r = sub_row + 1

        for rec in records:
            values = [
                rec.get("Ngày", ""), rec.get("Thứ", ""), rec.get("Ca", ""),
                rec.get("Vào", ""), rec.get("Ra", ""),
                rec.get("TG (hours)", ""), rec.get("CôngTG", ""),
                rec.get("Trễ (min)", ""), rec.get("Công Trễ", ""),
                rec.get("LT", ""), rec.get("Công LT", ""), rec.get("Kí hiệu", ""),
            ]
            fill = weekend_fill(rec.get("Thứ", ""))
            for col_idx, val in enumerate(values, start=1):
                cell = ws.cell(row=r, column=col_idx, value=val)
                cell.font = DATA_FONT
                cell.border = BORDER
                cell.alignment = CENTER if col_idx != len(values) else LEFT
                if fill:
                    cell.fill = fill
            r += 1

        # Dòng Tổng cộng
        merge_and_set(ws, f"A{r}:E{r}", "Tổng cộng :", LABEL_FONT, LEFT, border=False)
        ws.cell(row=r, column=6, value=summary["Tổng TG (hours)"])
        ws.cell(row=r, column=7, value=summary["Tổng CôngTG"])
        ws.cell(row=r, column=8, value=summary["Tổng Trễ (phút)"])
        ws.cell(row=r, column=9, value=summary["Tổng Công Trễ"])
        ws.cell(row=r, column=10, value=summary["Tổng LT (phút)"])
        ws.cell(row=r, column=11, value=summary["Tổng Công LT"])
        for col in (6, 7, 8, 9, 10, 11):
            c = ws.cell(row=r, column=col)
            c.font = LABEL_FONT
            c.alignment = CENTER
            c.number_format = "0.00"
        r += 1

        return r + 2  # chừa 2 dòng trống trước user tiếp theo

    wb = Workbook()
    ws = wb.active
    ws.title = "Bang cong"

    widths = {1: 12, 2: 6, 3: 6, 4: 8, 5: 8, 6: 8, 7: 8, 8: 8, 9: 8, 10: 8, 11: 8, 12: 22}
    for col_idx, w in widths.items():
        ws.column_dimensions[get_column_letter(col_idx)].width = w

    row = 1
    for uid, user_data in data.items():
        row = write_user_block(ws, row, uid, user_data, employee_info.get(uid, {}))

    wb.save(output_path)


# ============================================================================
#  XUẤT PDF — mỗi user 1 trang A4 (dọc), chừa khoảng trống footer rộng rãi để ký tên
# ============================================================================

def _build_pdf(data, output_path, employee_info):
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.units import mm
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak, KeepInFrame
    )
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    # ---- Đăng ký font Unicode (DejaVu Sans) để hiển thị đúng dấu tiếng Việt ----
    # Font Helvetica mặc định của reportlab KHÔNG có glyph tiếng Việt có dấu.
    # Cần thư mục "fonts/" (chứa DejaVuSans*.ttf) nằm CÙNG THƯ MỤC với script này.
    FONT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
    _VN_FONT_FILES = {
        "DejaVuSans": "DejaVuSans.ttf",
        "DejaVuSans-Bold": "DejaVuSans-Bold.ttf",
        "DejaVuSans-Oblique": "DejaVuSans-Oblique.ttf",
        "DejaVuSans-BoldOblique": "DejaVuSans-BoldOblique.ttf",
    }
    registered = pdfmetrics.getRegisteredFontNames()
    missing_files = []
    for font_name, filename in _VN_FONT_FILES.items():
        if font_name in registered:
            continue
        font_path = os.path.join(FONT_DIR, filename)
        if os.path.exists(font_path):
            pdfmetrics.registerFont(TTFont(font_name, font_path))
        else:
            missing_files.append(font_path)

    if missing_files:
        # KHÔNG âm thầm rơi về Helvetica nữa (Helvetica làm hỏng dấu tiếng Việt
        # mà không báo lỗi gì) -> báo lỗi rõ ràng để người dùng biết chỗ cần sửa.
        raise FileNotFoundError(
            "Thiếu font DejaVu Sans để xuất PDF tiếng Việt đúng dấu.\n"
            f"Không tìm thấy các file sau:\n  " + "\n  ".join(missing_files) +
            "\nHãy đảm bảo thư mục 'fonts/' (chứa DejaVuSans.ttf, DejaVuSans-Bold.ttf, "
            "DejaVuSans-Oblique.ttf, DejaVuSans-BoldOblique.ttf) nằm CÙNG THƯ MỤC với "
            f"file timekeeping_minutes.py (tức là tại: {FONT_DIR})."
        )

    FONT_REG, FONT_BOLD, FONT_ITALIC = "DejaVuSans", "DejaVuSans-Bold", "DejaVuSans-Oblique"

    PAGE_SIZE = A4  # A4 dọc (portrait) - chừa nhiều khoảng trống hơn ở footer để ký tên
    MARGIN = 12 * mm

    doc = SimpleDocTemplate(
        output_path, pagesize=PAGE_SIZE,
        leftMargin=MARGIN, rightMargin=MARGIN, topMargin=MARGIN, bottomMargin=MARGIN,
    )
    avail_w = PAGE_SIZE[0] - 2 * MARGIN
    avail_h = PAGE_SIZE[1] - 2 * MARGIN

    styles = getSampleStyleSheet()
    note_style = ParagraphStyle("note", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    FILL_TITLE = colors.HexColor("#FFFF66")
    FILL_T7 = colors.HexColor("#CCCCFF")
    FILL_CN = colors.HexColor("#FF99CC")
    FILL_HEAD = colors.HexColor("#EEEEEE")

    def weekend_fill(thu):
        if thu == "T7":
            return FILL_T7
        if thu == "CN":
            return FILL_CN
        return None

    story = []
    uids = list(data.keys())
    for i, uid in enumerate(uids):
        user_data = data[uid]
        records, summary = user_data["records"], user_data["summary"]
        info = employee_info.get(uid, {})
        name, dept = info.get("name", ""), info.get("dept", "")

        # ---- Header thông tin nhân viên ----
        header_tbl = Table(
            [[f"Mã nhân viên: {uid}", f"Tên nhân viên: {name}", f"Bộ phận: {dept}"]],
            colWidths=[avail_w * 0.3, avail_w * 0.4, avail_w * 0.3],
            rowHeights=[6 * mm],
        )
        header_tbl.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("BACKGROUND", (0, 0), (-1, -1), FILL_TITLE),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ]))

        # ---- Tóm tắt ----
        summary_rows = [
            ["Công làm", str(summary["Công làm"]),
             "Số lần trễ", str(summary["Số lần trễ"]),
             "Tổng Trễ (phút)", str(summary["Tổng Trễ (phút)"])],
            ["Tổng Công Trễ", f'{summary["Tổng Công Trễ"]:.2f}',
             "Tổng TG (hours)", f'{summary["Tổng TG (hours)"]:.2f}',
             "Tổng CôngTG", f'{summary["Tổng CôngTG"]:.2f}'],
            ["Tổng LT (phút)", str(summary["Tổng LT (phút)"]),
             "Tổng Công LT", f'{summary["Tổng Công LT"]:.2f}', "", ""],
        ]
        col_w6 = [avail_w * w for w in (0.14, 0.10, 0.14, 0.10, 0.14, 0.10)] * 1
        # normalize để đủ 6 cột chia theo tỉ lệ label/value lặp 3 lần
        col_w6 = [avail_w * f for f in (0.16, 0.10, 0.16, 0.10, 0.16, 0.10)]
        summary_tbl = Table(summary_rows, colWidths=col_w6, rowHeights=[5.5 * mm] * 3)
        summary_style = [
            ("FONTNAME", (0, 0), (-1, -1), FONT_REG),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.black),
            ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.black),
        ]
        for col in (0, 2, 4):
            summary_style.append(("FONTNAME", (col, 0), (col, -1), FONT_BOLD))
        summary_tbl.setStyle(TableStyle(summary_style))

        # ---- Bảng chi tiết: header 2 tầng + dữ liệu từng ngày ----
        group_header = ["Ngày", "Thứ", "Ca", "Vào", "Ra",
                        "Ngày làm (hour)", "", "Đi muộn (min)", "", "Về muộn (min)", "", "Kí hiệu"]
        sub_header = ["", "", "", "", "", "TG", "Công", "TG", "Công", "TG", "Công", ""]
        table_data = [group_header, sub_header]
        for rec in records:
            table_data.append([
                rec.get("Ngày", ""), rec.get("Thứ", ""), rec.get("Ca", ""),
                rec.get("Vào", ""), rec.get("Ra", ""),
                rec.get("TG (hours)", ""), rec.get("CôngTG", ""),
                rec.get("Trễ (min)", ""), rec.get("Công Trễ", ""),
                rec.get("LT", ""), rec.get("Công LT", ""), rec.get("Kí hiệu", ""),
            ])

        col_widths = [w * avail_w for w in (
            0.11, 0.06, 0.05, 0.075, 0.075, 0.075, 0.075, 0.075, 0.075, 0.075, 0.075, 0.145
        )]
        n_data_rows = len(records)
        row_heights = [5.5 * mm, 5.5 * mm] + [4.2 * mm] * n_data_rows
        detail_tbl = Table(table_data, colWidths=col_widths, rowHeights=row_heights, repeatRows=2)

        detail_style = [
            ("SPAN", (5, 0), (6, 0)), ("SPAN", (7, 0), (8, 0)), ("SPAN", (9, 0), (10, 0)),
            ("SPAN", (0, 0), (0, 1)), ("SPAN", (1, 0), (1, 1)), ("SPAN", (2, 0), (2, 1)),
            ("SPAN", (3, 0), (3, 1)), ("SPAN", (4, 0), (4, 1)), ("SPAN", (11, 0), (11, 1)),
            ("FONTNAME", (0, 0), (-1, 1), FONT_BOLD),
            ("FONTNAME", (0, 2), (-1, -1), FONT_REG),
            ("FONTSIZE", (0, 0), (-1, -1), 7),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("GRID", (0, 0), (-1, -1), 0.4, colors.black),
            ("BACKGROUND", (0, 0), (-1, 1), FILL_HEAD),
            ("TOPPADDING", (0, 0), (-1, -1), 1),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 1),
        ]
        for idx, rec in enumerate(records):
            r_idx = idx + 2
            fill = weekend_fill(rec.get("Thứ", ""))
            if fill:
                detail_style.append(("BACKGROUND", (0, r_idx), (-1, r_idx), fill))
        detail_tbl.setStyle(TableStyle(detail_style))

        # ---- Footer: khoảng trống để ký tên ----
        sign_labels = Table(
            [["Người lập bảng", "Trưởng bộ phận", "Người lao động"]],
            colWidths=[avail_w / 3] * 3, rowHeights=[5.5 * mm],
        )
        sign_labels.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        sign_note = Table(
            [["(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)", "(Ký, ghi rõ họ tên)"]],
            colWidths=[avail_w / 3] * 3, rowHeights=[4 * mm],
        )
        sign_note.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), FONT_ITALIC),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 0), (-1, -1), colors.grey),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))

        page_content = [
            header_tbl, Spacer(1, 3 * mm),
            summary_tbl, Spacer(1, 4 * mm),
            detail_tbl, Spacer(1, 52.5 * mm),  # khoảng trống trước nhãn ký tên (đẩy xuống thêm)
            sign_labels, Spacer(1, 32.5 * mm),  # khoảng trống thực để ký
            sign_note,
        ]
        # Bọc KeepInFrame với mode='shrink' để đảm bảo LUÔN gói gọn trong 1 trang A4
        story.append(KeepInFrame(avail_w, avail_h, page_content, mode="shrink"))

        if i < len(uids) - 1:
            story.append(PageBreak())

    doc.build(story)


def load_users_json(path):
    """Đọc users.json dạng list [{"member_id": 7, "department": "ABC", "name": ...}, ...]
    -> dict {uid_str: {"name": ..., "dept": ...}} để dùng chung với employee_info.
    Thiếu name/department thì bỏ qua field đó (để trống)."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    info = {}
    for item in raw:
        uid = str(item.get("member_id", "")).strip()
        if not uid:
            continue
        entry = {}
        if item.get("name"):
            entry["name"] = item["name"]
        if item.get("department"):
            entry["dept"] = item["department"]
        info[uid] = entry
    return info


def main():
    parser = argparse.ArgumentParser(description="Xử lý dữ liệu chấm công thô -> Excel (1 sheet) / JSON")
    parser.add_argument("input", help="File dữ liệu chấm công thô")
    parser.add_argument(
        "--month", type=parse_month_arg, default=None,
        help="Chỉ lấy dữ liệu của 1 tháng, định dạng YYYY-MM (vd: 2026-07)"
    )
    parser.add_argument("--output", default=None, help="Tên file output (mặc định tự đặt theo --month)")
    parser.add_argument("--format", choices=["xlsx", "json", "pdf"], default="xlsx", help="Định dạng output (mặc định: xlsx)")
    parser.add_argument("--info", default=None, help="File JSON map user_id -> {name, dept}")
    args = parser.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        punches = parse_raw_lines(f, month_filter=args.month)

    data = build_json(punches, month=args.month)

    if args.output:
        output_path = args.output
    elif args.month:
        year, month = args.month
        output_path = f"{year:04d}-{month:02d}.{args.format}"
    else:
        output_path = f"timekeeping.{args.format}"

    employee_info = {}
    if args.info:
        with open(args.info, "r", encoding="utf-8") as f:
            employee_info = json.load(f)
    else:
        default_users_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "users.json")
        if os.path.exists(default_users_path):
            employee_info = load_users_json(default_users_path)

    if args.format == "json":
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    elif args.format == "pdf":
        _build_pdf(data, output_path, employee_info)
    else:
        _build_xlsx(data, output_path, employee_info)

    print(f"Đã xuất {output_path} cho {len(data)} user.")


if __name__ == "__main__":
    main()
