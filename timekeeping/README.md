# Timekeeping — Bảng công ca HC

Viết lại bản Python gốc (`timekeeping_app.py` + `timekeeping_minutes.py`,
giao diện Streamlit) thành ứng dụng web **React + Astryx, chạy hoàn toàn
trên trình duyệt** — không server, không gửi dữ liệu đi đâu. Mọi tính toán
chạy trong `src/lib/timekeeping.ts`, port chính xác từ bản Python.

## Chạy

```sh
npm ci
npm run dev      # http://localhost:5173
npm run build    # build cho GitHub Pages, base /seeds/timekeeping/
```

Live: https://nguyenhuuhanhlam.github.io/seeds/timekeeping/

## Cách dùng

1. **Bảng công tháng**: chọn file log thô (`.txt` / `.dat`) của máy chấm
   công, nhập tháng `YYYY-MM` (mặc định tháng trước), bấm **Tính công**.
   Có thể bấm **Nạp dữ liệu mẫu** để xem ngay kết quả tháng 07-2026.
2. **Danh sách nhân viên**: thêm/sửa nhân viên (mã, bộ phận, tên), lưu vào
   localStorage của trình duyệt; nhập/xuất `users.json`. Nhân viên không có
   trong danh sách vẫn được tính công, chỉ để trống tên và bộ phận.
3. **Tải kết quả**: chọn định dạng Excel (`.xlsx`), JSON, hoặc PDF (bản in).
4. **Bản in / PDF**: mở trang in, bấm **In / Lưu PDF** rồi chọn máy in
   "Lưu thành PDF" trong hộp thoại trình duyệt — mỗi nhân viên 1 trang A4,
   có chỗ ký tên (Người lập bảng / Trưởng bộ phận / Người lao động).

## Công thức (ca HC, giữ nguyên bản Python)

- Sáng 08:30–12:00, chiều 13:00–17:30; 8 giờ = 1 công (480 phút).
- **Trễ (min)** = max(Vào − 08:30, 0); Công Trễ = Trễ / 480.
- **TG (giờ)** = số giờ thực tế nằm trong 2 khung chuẩn — đi sớm trước
  08:30 / về sau 17:30 không tính vào TG; CôngTG = TG / 8.
- **LT (phút)** = max(Ra − 17:30, 0); Công LT = LT / 480.
- Mỗi (user, ngày) chỉ giữ giờ Vào sớm nhất và Ra muộn nhất. Chỉ có 1 lần
  chấm trong ngày thì Ra không xác định, TG hiện "-", phút Trễ vẫn tính.

## Dữ liệu mẫu

`public/sample/` chứa dữ liệu **ẩn danh, tổng hợp** (3 nhân viên giả +
log tháng 07-2026) để demo và kiểm chứng, bao gồm: đúng giờ, đi trễ,
làm thêm, chỉ 1 lần chấm, chỉ làm buổi chiều, đi sớm/về muộn, 1 ngày
thứ 7. **Dữ liệu thật (users.json / file log thật) không bao giờ được
commit lên repo public này** — xem `.gitignore` ở root repo.

## Kiểm chứng Python ↔ TypeScript

`scripts/verify.mjs` chạy logic TS bằng node trên cùng file log + tháng
và in tổng từng user; `scripts/test-xlsx.mjs` kiểm tra xuất Excel.

Ngày 28-10-2026, full JSON (từng ngày, từng user) của bản TS **giống hệt**
bản Python trên cả 3 bộ dữ liệu:

| Bộ dữ liệu | Kết quả |
|------------|---------|
| Mẫu 07-2026 (`public/sample/`) | giống hệt |
| Log thật 07-2026 (8 user, đến 13-07) | giống hệt |
| Log thật 06-2026 (9 user, đã kiểm chứng tay trước đó) | giống hệt |

Tổng tháng mẫu 07-2026: user 101 — Công làm 23, TG 166,92h, CôngTG
20,86, Trễ 110 phút, LT 235 phút; user 102 — TG 166,34h, Trễ 654 phút;
user 103 — TG 187,50h, không trễ, LT 40 phút.

Lưu ý kỹ thuật: Python `round()` làm tròn half-even trên giá trị nhị
phân chính xác của số double — `pyRound` trong `timekeeping.ts` mô phỏng
đúng hành vi này (làm tròn trên chuỗi thập phân 17 chữ số), nên các giá
trị như 441/480 = 0,91875 ra 0,9187 như Python, không phải 0,9188.

## UI

Phong cách NSDT NextGen / AHRI: Astryx `@astryxdesign/core` 0.7, theme
Neutral, font Cascadia Mono, khung AppShell + TopNav + SideNav (TreeList)
+ CommandPalette (Ctrl+K), heading level 4 (14px) theo quy ước dự án.
Bảng chi tiết dùng `<table>` thuần để giữ đúng màu nền cuối tuần như
bản Python (T7 `#CCCCFF`, CN `#FF99CC`) — Astryx Table không có API tô
màu theo dòng.

## PDF

PDF được tạo bằng cách in từ trình duyệt (không dùng jsPDF) để tiếng
Việt luôn đúng dấu với font hệ thống — nhúng font DejaVu vào jsPDF sẽ
tốn ~3 MB base64 cho một tính năng in. Trang in (`#/print`) đứng ngoài
AppShell để `window.print()` chỉ in bảng công.
