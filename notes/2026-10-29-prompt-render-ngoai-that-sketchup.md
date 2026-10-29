# Prompt render ngoại thất kiến trúc từ file SketchUp

Ngày nói chuyện: 29-10-2026

## Câu hỏi

> tìm kiếm 1 vài prompt tốt cho việc render ngoại thất kiến trúc từ file sketchup

## Trả lời

Chia theo bối cảnh để chỉ cần thay phần trong ngoặc. Câu khóa quan trọng nhất
khi render từ ảnh SketchUp là **giữ nguyên hình khối, tỉ lệ và góc máy**,
nếu không AI rất dễ tự thêm tầng, đổi cửa sổ, đổi mặt đứng.

### Trước khi xuất ảnh

Nên để style **Shaded hoặc Shaded with Textures**, tắt Profiles, ẩn
guides/section plane, dùng Two-Point Perspective và FOV khoảng 35–60° cho đỡ
méo hình.

Nguồn tham khảo: Cad2Real — SketchUp to Photorealistic Render
(https://www.cad2real.com/sketchup-guide.html)

### 1. Mẫu khung dùng chung, dùng được cho hầu hết công trình

```
Keep exact geometry, proportions and camera angle of this SketchUp model. Photorealistic architectural exterior, [modern villa], white plaster and warm wood slat facade, floor-to-ceiling glass, flat roof, landscaped garden, paved driveway, clear blue sky, soft daylight, realistic shadows, architectural photography, ultra detailed
```

Thay `[modern villa]` bằng: townhouse, resort villa, office building,
factory, school...

### 2. Ban ngày, nắng đẹp, trình bày khách hàng

```
Transform this SketchUp model into a photorealistic exterior render, keeping the exact massing and camera view. Modern tropical house with white walls, natural stone cladding and timber screens, large glass doors opening to a terrace, lush garden with palm trees, stone pathway, bright midday sunlight, blue sky with light clouds, crisp shadows, professional architectural photography
```

Bản gốc của dạng này gợi ý: giữ hình khối và camera, chỉ nâng vật liệu,
ánh sáng và bối cảnh xung quanh.

### 3. Golden hour, ấm và sang nhất

```
Photorealistic exterior of a contemporary villa from this SketchUp model, do not change geometry or camera. Warm golden hour light, long soft shadows, white facade with wood accents, floor-to-ceiling glass glowing from inside, infinity pool reflection, olive trees and landscaped garden, cinematic warm tones, high detail, architectural magazine photography
```

### 4. Blue hour, buổi tối lên đèn

```
Keep exact geometry and perspective of this SketchUp model. Ultra-modern house at blue hour twilight, sleek dark steel and glass facade, warm interior lighting contrasting with deep blue sky, landscape lights along pathway, calm water reflection, cinematic lighting, photorealistic, shot like professional architectural photography
```

### 5. Phong cách tối giản, bê tông + kính

```
Photorealistic minimalist architectural exterior, preserve the SketchUp model's exact shape and viewpoint. Raw concrete and black steel frame, large sliding glass doors, shaded terrace, minimal landscaping with gravel and sculptural trees, overcast soft daylight, subtle textures, clean composition, ultra realistic
```

### 6. Nhà phố / công trình đô thị, trời mưa nhẹ cho có chiều sâu

```
Photorealistic exterior of a modern townhouse from this SketchUp model, keep geometry unchanged. Dark brick facade, wide steel-framed windows, small front garden with lush greenery, wet pavement after light rain, glossy reflections on brick and glass, soft overcast light, street context, ultra detailed
```

### Lưu ý riêng nếu dùng SketchUp AI Render

Prompt nên dưới 500 ký tự, viết như nói chuyện bình thường, nêu rõ vật liệu,
ánh sáng, cảnh quan và phong cách. Đồng thời tránh các ký tự như `$`, `...`,
`+`, `=` vì AI Render của SketchUp không hỗ trợ các ký hiệu đó.

### Negative prompt (nếu tool có ô negative prompt)

```
distorted geometry, extra floors, changed windows, warped perspective, cartoon, low detail, blurry, extra buildings
```

## Nguồn tham khảo thêm

- Rendair — 5 AI prompts to render one 3D model five ways:
  https://rendair.ai/blog/5-prompts-for-one-3d-model
- SketchUp Help — Best Practices for Custom Prompts:
  https://prod-aws-help.sketchup.com/pl/node/3952
