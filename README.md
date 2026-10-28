# Seeds — kho ứng dụng mini

Mỗi ứng dụng mini nằm trong một thư mục riêng, chạy độc lập, deploy chung
lên GitHub Pages tại `https://nguyenhuuhanhlam.github.io/seeds/<app>/`.

## Các app hiện có

| App | Thư mục | Mô tả |
|-----|---------|-------|
| Timekeeping | `timekeeping/` | Bảng công ca HC từ file log máy chấm công — React + Astryx, chạy hoàn toàn trên trình duyệt |

## Thêm app mới

1. Tạo thư mục mới, ví dụ `my-app/`, với `package.json` + `vite.config.js`
   (đặt `base: '/seeds/my-app/'`).
2. Thêm app vào workflow `.github/workflows/deploy-pages.yml`:
   `npm ci` + `npm run build -- --base=/seeds/my-app/` rồi copy `dist/`
   vào `_site/my-app/`.
3. Thêm một dòng vào bảng trên và một thẻ link trong `index.html`.

## Deploy

Push lên `main` là GitHub Actions tự build từng app rồi deploy Pages
(workflow đã bật Pages bằng `configure-pages` với `enablement: true`).
Không cần thao tác tay trên github.com.
