# Timekeeping — bản Python gốc (Streamlit)

Đây là **toàn bộ code gốc** của ứng dụng chấm công, copy nguyên vẹn từ
thư mục trên máy dev (2026-10-28, hash khớp bản gốc). Bản React + Astryx
chạy trên trình duyệt nằm ở thư mục cha (`../`) — logic tính công của nó
(`../src/lib/timekeeping.ts`) được port chính xác từ `timekeeping_minutes.py`
ở đây.

## File trong thư mục này

| File | Nội dung |
|------|----------|
| `timekeeping_minutes.py` | Lõi tính công (CLI): parse log thô, tính Trễ/TG/LT, xuất Excel/JSON/PDF |
| `timekeeping_app.py` | Giao diện Streamlit (upload log, chọn tháng, bảng `users.json`) |
| `config.toml` | Theme Streamlit (sáng, chữ đen) |
| `requirements.txt` | `streamlit`, `pandas`, `openpyxl`, `reportlab` |
| `fonts/` | Font DejaVu Sans (4 file, ~2,7 MB) — để xuất PDF tiếng Việt đúng dấu |
| `users.json` | Danh sách nhân viên **mẫu, ẩn danh** (3 người giả, mã 101–103) |
| `sample-attlog.txt` | Log chấm công **mẫu, ẩn danh** tháng 07-2026 (141 dòng) |

## Chạy

```sh
pip install -r requirements.txt
streamlit run timekeeping_app.py
# hoặc CLI:
python timekeeping_minutes.py sample-attlog.txt --month 2026-07
python timekeeping_minutes.py sample-attlog.txt --month 2026-07 --format json
python timekeeping_minutes.py sample-attlog.txt --month 2026-07 --format pdf
```

## Công thức (ca HC)

Sáng 08:30–12:00, chiều 13:00–17:30; 8 giờ = 1 công (480 phút).
Trễ = max(Vào − 08:30, 0); TG = giờ thực tế trong 2 khung chuẩn;
LT = max(Ra − 17:30, 0). Chi tiết xem README ở thư mục cha.

## Dữ liệu thật — không có trong repo

`users.json` và file log thật (`*.dat` / `*.txt` từ máy chấm công) chứa
tên và giờ giấc thật của nhân viên nên **không bao giờ được commit lên
repo public này** — chúng đã được loại ra khi copy (xem `.gitignore` ở
root repo: `*.dat`, `timekeeping/python/users.json`). Muốn chạy bản
Python với dữ liệu thật, copy `users.json` và file log thật của bạn vào
thư mục này trên máy local rồi chạy như trên; git sẽ tự bỏ qua chúng.
