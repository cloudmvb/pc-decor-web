# BƯỚC 4: TỔNG KẾT NHỮNG THAY ĐỔI LỚN & BÀI HỌC KINH NGHIỆM KỸ THUẬT (PC DECOR 3D SHOWCASE)

Tài liệu này ghi chép toàn diện **những thay đổi kiến trúc lớn** và **các bài học kinh nghiệm thực chiến** rút ra trong quá trình nâng cấp trang web trưng bày [index.html](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/index.html) từ mô hình **WebGL `.glb` thời gian thực** sang kiến trúc **Frame-by-Frame 60FPS Scrollytelling + GPU `ImageBitmap` 360° Turntable**.

---

## PHẦN I. BẢNG ĐỐI CHIẾU NHỮNG THAY ĐỔI KIẾN TRÚC LỚN

| Hạng mục | Bản Gốc (Real-Time WebGL `.glb`) | Bản Hoàn Thiện (Frame-Video 60FPS + GPU `ImageBitmap` Turntable) | Hiệu quả đạt được |
| :--- | :--- | :--- | :--- |
| **1. Tải trang ban đầu (First Contentful Paint)** | Phải tải trọn bộ file 3D [pc_master_production.glb](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/pc_master_production.glb) (**28.05 MB**) + thư viện `Three.js` (~650 KB) trước khi hiển thị được khung hình đầu tiên. | Chỉ tải `frame_000.webp` (**69.1 KB**) + `M0_FullPC_sheet_0.webp` (**1.54 MB**) + [frames_coords.json](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/frames_coords.json) (**204 KB**); các khung hình tiếp theo nạp nền theo lô ưu tiên. | Dung lượng cần cho First Paint **giảm ~94%**, hiển thị tức thì (`< 100ms`) và xoay 360° ngay khi vào trang. |
| **2. Quỹ đạo tháo rời linh kiện (Explosion Logic)** | Các linh kiện tịnh tiến thẳng theo vector 3D đồng loạt cùng lúc $\rightarrow$ **bay xuyên qua lớp kính cường lực, nóc và vách thép lưng vỏ Case**, đè chồng chéo lên nhau. | **Quy trình tháo 2 giai đoạn qua 2 ô cửa mở (`Two-Stage Doorway Bezier Extraction`)** chia làm **6 đợt tách biệt hoàn toàn (1–2 món/đợt)** trong [build_render_studio.mjs](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/build_render_studio.mjs): Kính trượt ra trước $\rightarrow$ Rút cáp $\rightarrow$ Tháo GPU & RAM $\rightarrow$ Nhấc AIO (+ 3 quạt hướng về người dùng) & SSD $\rightarrow$ Nhấc CPU & hạ PSU $\rightarrow$ Rút Mainboard Z790 cuối cùng. | **0% xuyên vỏ Case, 0% va chạm linh kiện**, đúng thứ tự tháo lắp phần cứng PC ngoài đời thực. |
| **3. Nhịp cuộn chuột & Các mốc dừng (Scroll Stops)** | Cuộn tự do dễ dừng ở khoảng lơ lửng; các đợt chuyển động bị gối đầu (`overlap`) khiến dừng ở mốc 1 mà vật phẩm mốc 2 đã nhấp nhổm bay ra. | Chia chính xác **6 mốc cuộn chuột (`SCROLL_STOPS = [0.00, 0.16, 0.33, 0.50, 0.67, 0.84, 1.00]`)** với **vùng đệm nghỉ tĩnh (`1%–2%` static buffer)** ở hai đầu mỗi mốc. | Dừng ở bất kỳ mốc nào (`1..5`), các linh kiện của mốc sau **đứng yên 100% trong Case**, tuyệt đối không bị lệch frame. |
| **4. Tương tác ở Mốc 0 (`p = 0%`) & Khớp góc khi bắt đầu cuộn** | Mốc 0 đứng tĩnh hoặc chỉ lắc nhẹ; nếu xoay tự do rồi cuộn chuột ngay sẽ bị giật hình do lệch góc với `frame_000.webp`. | - **Xoay 360° siêu mượt (432 khung hình rời rạc, `0.833°/frame`, `7.2s/vòng`)** + hỗ trợ **kéo chuột trái/phải** để xem mọi góc.<br>- **Cơ chế `isAligningM0ToFront`**: Khi bắt đầu cuộn từ Mốc 0, nếu Case đang ở góc khác `0°`, hệ thống tự động quay mượt Case theo đường ngắn nhất về hướng người dùng (`0°`) rồi mới phát chuỗi frame cuộn. | Chuyển giao giữa **Xoay 360° ở Mốc 0** và **Bay lên ở Mốc 1** liền mạch 100%, không bao giờ bị nhảy góc đột ngột. |
| **5. Khóa/Mở khóa Click & Xoay 360° từng linh kiện ở Mốc 6 (`100%`)** | Cho phép bấm khi linh kiện còn đang bay hoặc chỉ phóng to tĩnh một góc. | - **Khóa chặt Click & Nhãn (`isAllFullyDetached`)** suốt quá trình tách (`Mốc 0 → Mốc 5`).<br>- Khi đạt **Mốc 6 (`100%`)**: Mở khóa toàn bộ 10 nhãn; **trỏ chuột (`hover`) vào linh kiện nào thì linh kiện đó tự xoay 360° tại chỗ ở chuẩn 60 FPS** (`72 frames`, `5°/frame`), bấm vào sẽ Zoom 2D + mở Drawer 4 góc ảnh 4K. | Người dùng quan sát trọn vẹn 360° của từng linh kiện (mặt quạt GPU, mặt cổng PSU, lưng IHS của CPU, bộ 3 quạt AIO hướng trực diện) ngay trên bố cục Knolling. |
| **6. Hiệu ứng Nền Bay Lên (Levitation Stage) & Bàn Setup biến mất** | Khi PC bay lên, bàn biến mất đột ngột hoặc nền đứng yên không tạo cảm giác độ cao. | - **Bàn Setup hạ xuống và tan biến dần (`opacity: 1 → 0`)** mượt mà từ `p = 0% → 38%`.<br>- **Vòng năng lượng phản trọng lực 3D dưới đáy Case** + **Lưới không gian & Vệt gió trôi ngược chiều đi xuống + Thước đo độ cao (`+0.0m → +12.0m`)** trên lớp ThreeUI Canvas. | Làm nổi bật cảm giác toàn bộ cỗ máy PC đang bay vút lên không trung khi lăn chuột. |
| **7. Chất lượng Vật liệu PBR, Ánh sáng Vỏ Case & Quạt Nguồn PSU** | - Khung vỏ Case trắng bị bóng đổ gắt tạo vệt xám loang lổ và hở khe sáng xuyên qua khoang sau.<br>- Quạt bộ nguồn PSU bị mặt lưới đặc che khuất. | - Tắt bóng đổ gắt trên `keyLight`, tính lại `computeVertexNormals()`, lắp vách chắn sáng khoang sau (`Case_RearChamber_LightBlock`) và kéo kín trụ trước phải.<br>- Mở thông mặt trên hộp nguồn PSU, dựng **quạt tản nhiệt 9 cánh trắng + vòng LED Cyan + lưới bảo vệ bát giác** đặt sát mặt trên và nghiêng `explodeRot.x = +0.34`. | Khung Case trắng sứ đồng nhất, sang trọng; quạt nguồn PSU và bộ 3 quạt AIO đều lộ diện rõ nét hướng về người dùng. |

---

## PHẦN II. 8 BÀI HỌC KINH NGHIỆM KỸ THUẬT ĐẮT GIÁ ĐÃ HỌC ĐƯỢC

### Bài học 1: Vì sao Mốc 0 (`0%`) từng bị khựng và nhòe bóng ma — Giới hạn `4096×4096` của GPU & `ImageBitmap`
* **Vấn đề gặp phải:**
  1. Ở phiên bản thử nghiệm đầu tiên của Mốc 0, việc ghép `144 khung hình` (`726 × 832 px`) vào một tấm ảnh WebP duy nhất (`12 × 12` ô) tạo ra bức ảnh khổng lồ **`8712 × 9984 px` (`348 MB` dữ liệu RGBA khi giải nén)**. Kích thước này vượt xa giới hạn kết cấu phần cứng `4096 × 4096` của WebGL/Canvas2D và vượt ngưỡng bộ nhớ đệm `kMaxSingleImageDecodeBytes` (`128 MB`) của nhân Chromium. Hệ quả là trình duyệt liên tục giải phóng bức ảnh khỏi VRAM và phải giải mã lại file WebP trên CPU, gây ra các nhịp khựng **52 ms – 68.9 ms/frame**.
  2. Ngoài ra, việc dùng phép trộn mờ 2D (`globalCompositeOperation = 'lighter'`) giữa 2 khung hình lệch nhau `2.5°` ($\approx 16\text{px}$) làm các chi tiết tương phản cao (mắt gấu Chibi, ống nước AIO, cạnh vỏ Case) bị **tách thành 2 hình bóng ma (double-vision ghosting)** nhấp nháy theo chu kỳ.
* **Bài học & Giải pháp chuẩn:**
  - **Không bao giờ dùng tấm Sprite Sheet vượt quá `4096 × 4096 px`:** Chia nhỏ thành **12 tấm `3264 × 3744 px` (`6 × 6 = 36 frames/tấm`)**.
  - **Giải mã trước thành `ImageBitmap` thường trú trên GPU (`createImageBitmap(blob)`):** Khóa chặt kết cấu đã giải mã trong VRAM (`SkImage_Gpu`), đưa thời gian vẽ `ctx.drawImage` từ `68.9 ms` về **`0.018 ms` (nhanh hơn 340 lần)**.
  - **Thay thế trộn mờ 2D bằng mật độ khung hình 3D thực (`432 frames`, `0.833°/frame`):** Hiển thị đúng 1 khung hình 3D rời rạc mới trên mỗi nhịp 60Hz (`1.0 frame/tick`), vừa mượt tuyệt đối vừa giữ độ sắc nét 100% ở mọi góc dừng.

### Bài học 2: Loại bỏ hoàn toàn hàm theo đồng hồ thực (`performance.now()`) khi kết xuất chuỗi Frame Offline
* **Vấn đề gặp phải:** Trong cảnh WebGL ban đầu, chuyển động bồng bềnh của PC dùng `Math.sin(performance.now() * 0.002)`. Khi chụp từng frame bằng Headless Chromium, thời gian chụp mỗi frame dao động từ `40ms – 120ms` làm pha của hàm `sin` nhảy hỗn loạn, khiến các linh kiện trong video bị **nhấp nhô lên xuống liên hồi**.
* **Bài học & Giải pháp chuẩn:** Khi kết xuất chuỗi khung hình (`Frame Sequence`), mọi vị trí và góc xoay trong cảnh 3D bắt buộc phải là **hàm toán học tất định thuần túy (`pure deterministic function`) theo duy nhất biến tiến trình `p ∈ [0, 1]`**, kết hợp đa thức bậc 5 **Quintic Smootherstep** $S(t) = 6t^5 - 15t^4 + 10t^3$ (có đạo hàm bậc nhất và bậc hai bằng `0` tại hai đầu mút) để vận tốc và gia tốc biến thiên êm ái tuyệt đối.

### Bài học 3: Giải bài toán "Không Xuyên Vỏ Case" trong góc nhìn 3/4 bằng Quỹ đạo Bezier 2 Giai đoạn (`Two-Stage Doorway Extraction`)
* **Vấn đề gặp phải:** Trong góc nhìn phối cảnh 3/4 (`camRight = (+0.82, 0, -0.57)`), nếu cho linh kiện trượt thẳng theo hướng màn hình sang phải (`+camRight` như RAM, Dây cáp, AIO) hoặc sang trái (`-camRight` như GPU, SSD, CPU, Mainboard), vector di chuyển sẽ cắt xuyên qua vách thép sau (`X = -0.68`), trụ góc hoặc sàn Case.
* **Bài học & Giải pháp chuẩn:**
  - **Bước mở đường (`p = 0.01 → 0.14`):** Trượt 3 tấm kính cường lực Panoramic (`Case_Glass_Side`, `Case_Glass_Corner45`, `Case_Glass_Front`) ra xa để mở toang 2 ô cửa vật lý (`+Z` cửa hông và `+X` cửa trước).
  - **Giai đoạn 1 (`subT = 0.0 → 0.45` — Rút qua cửa kính):** Mọi linh kiện bên trong đều phải đi qua điểm trung chuyển (`Waypoint`) nằm hẳn bên ngoài ô cửa kính (`doorZ = +0.88 .. +1.55`, kết hợp trì hoãn trục dọc `yDelay` và trục ngang `xDelay`).
  - **Giai đoạn 2 (`subT = 0.45 → 1.0` — Bay về vị trí trưng bày Knolling):** Sau khi đã thoát hoàn toàn khỏi lòng thùng máy, linh kiện mới rẽ sang vị trí trưng bày đối xứng hai bên.

### Bài học 4: Chống "Lệch Frame" giữa các mốc cuộn bằng Vùng Đệm Nghỉ Tĩnh (`Static Rest Buffers`)
* **Vấn đề gặp phải:** Nếu Đợt 1 kết thúc ở `p = 0.16` và Đợt 2 bắt đầu ngay ở `p = 0.15` hoặc `0.16`, thì khi người dùng dừng ở Mốc 1 (`p = 0.16`), linh kiện của Đợt 2 đã bắt đầu nhúc nhích bay ra.
* **Bài học & Giải pháp chuẩn:** Giữa mọi điểm dừng `SCROLL_STOPS = [0.00, 0.16, 0.33, 0.50, 0.67, 0.84, 1.00]`, các khoảng `[pStart, pEnd]` của từng đợt tách phải nằm gọn **bên trong** khoảng giữa hai mốc và chừa **vùng đệm tĩnh `±1%..2%`** (ví dụ Mốc 1 dừng ở `0.16`, thì Đợt 1 kết thúc hoàn toàn ở `0.15` và Đợt 2 chỉ bắt đầu ở `0.17`).

### Bài học 5: Xoay đồng bộ cụm nhiều Mesh con (Bộ 3 Quạt Tản Nhiệt) quanh một Tâm Chung (`Shared Pivot Quaternion`)
* **Vấn đề gặp phải:** Bộ 3 quạt đáy (`Case_BottomFan_1`, `Case_BottomFan_2`, `Case_BottomFan_3`) gồm hàng chục mesh con (khung quạt, 9 cánh quạt, tâm quạt, vòng LED) có tâm cục bộ (`local origin`) khác nhau. Nếu chỉ cộng góc xoay vào từng mesh con, 3 chiếc quạt sẽ bị xé lẻ và lệch khỏi hàng ngang.
* **Bài học & Giải pháp chuẩn:** Tính toán một điểm neo chung `bottomFanPivot = (-0.06, 0.185, 0.130)` cho cả băng 3 quạt, sau đó áp dụng phép biến đổi cứng quanh tâm chung cho mọi mesh con:
  $$\vec{p}_{\text{new}} = \vec{p}_{\text{pivot}} + \mathbf{R}(\theta)\cdot(\vec{p}_{\text{init}} - \vec{p}_{\text{pivot}}) + \Delta\vec{p}_{\text{explode}}$$
  Nhờ đó cả 3 quạt cùng dựng đứng một góc `+86.4°` như một khối 360mm thống nhất, hướng thẳng mặt cánh quạt và vòng LED ARGB về phía người dùng.

### Bài học 6: Tránh "Cộng Đúp Nội Suy" (`Double Easing`) khi phát chuỗi Frame Video trên Web
* **Vấn đề gặp phải:** Vì đường cong `Smootherstep` đã được nướng sẵn (`baked`) vào quỹ đạo 3D của từng đợt tách trong 300 frames, nếu khi cuộn trang trên web lại áp thêm một hàm easing quá gắt lên biến `scrollProgress`, tốc độ di chuyển ở giữa đợt sẽ bị vọt nhanh gấp 4.7 lần rồi khựng lại.
* **Bài học & Giải pháp chuẩn:** Bộ điều khiển Tween trên web (`startScrollTweenNow`) cần đẩy biến `scrollProgress` theo nhịp gần tuyến tính (`72% linear + 28% cosine`), đồng thời cung cấp thêm tùy chọn **"Chậm Mượt Nội Suy (`0.92s` + Sub-frame Optical Blend)"** cho người dùng thích ngắm chuyển động chậm rãi.

### Bài học 7: Chiếu sẵn Tọa độ 3D sang 2D (`frames_coords.json`) để giữ nguyên 100% tính năng tương tác mà không cần Three.js
* **Bài học & Giải pháp chuẩn:** Trong lúc kết xuất từng frame ở Bước 2, việc dùng `worldCenter.project(camera)` để xuất tọa độ chuẩn hóa `[nx, ny]` của cả 10 nhóm linh kiện ra file [frames_coords.json](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/frames_coords.json) (`204 KB`) cho phép trang web 2D thực hiện:
  1. Gắn thẻ nhãn (`Callout Badges`) bám dính mượt mà theo từng frame.
  2. Nhận diện vùng rê chuột / bấm chuột (`findNearestGroupAtPoint`) trực tiếp trên `<canvas>`.
  3. Ghép chuẩn xác từng ô xoay 360° (`cropX, cropY, cropW, cropH` trong [turntables_meta.json](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/turntables/turntables_meta.json)) đè khít lên vị trí của linh kiện ở Mốc 0 và Mốc 6.

### Bài học 8: Tối ưu Canvas 2D Phụ trợ bằng Gộp Lệnh Vẽ (`Path Batching`)
* **Vấn đề gặp phải:** Lớp phủ hạt nền và thước đo độ cao (`#threeuiConstellationCanvas`) nếu gọi `cCtx.beginPath()` + `cCtx.stroke()` riêng lẻ cho từng đoạn nối giữa 56 hạt (~150–200 lệnh `stroke()` mỗi nhịp 60Hz) sẽ tiêu tốn `3ms – 5ms` thời gian CPU mỗi frame.
* **Bài học & Giải pháp chuẩn:** Gộp toàn bộ các đoạn nối vào **1 lệnh `cCtx.beginPath()` + `cCtx.stroke()` duy nhất** và toàn bộ các hạt vào **1 lệnh `cCtx.fill()` duy nhất**, kết hợp bỏ `Math.hypot` (thay bằng so sánh bình phương khoảng cách `dx*dx + dy*dy < linkDistSq`), giảm chi phí vẽ lớp nền xuống `< 0.15 ms/frame`.

### Bài học 9: Khắc phục hiện tượng mờ khi Zoom In linh kiện bằng `4K Master Frame` + `5K–6K Super-Sampled Turntable Sheets`
* **Vấn đề gặp phải:** Khi bấm vào một linh kiện ở Mốc 6 (`p = 100%`) để Zoom In (`camZoom = 1.8x .. 2.5x`), nếu khung hình nền `frame_299.webp` và các ô xoay `Group_*` chỉ được kết xuất ở độ phân giải tổng thể `1920 × 1080` (`1x`), các linh kiện nhỏ như CPU (`120 × 128 px`), RAM (`138 × 116 px`), SSD (`130 × 152 px`), PSU (`156 × 140 px`) sẽ bị phóng đại quá độ phân giải gốc gây vỡ hạt, đồng thời phần nền `bgImg` chụp ở `1x` tạo viền ô vuông lệch độ nét với lưới 3D xung quanh.
* **Bài học & Giải pháp chuẩn:**
  1. Kết xuất riêng **`frame_299.webp` ở độ phân giải `4K UHD (3840 × 2160 px)`** (`ssScale = 2.0`, chất lượng WebP `0.96`), mang lại mật độ điểm ảnh gấp 4 lần cho toàn bộ khung cảnh khi Zoom In.
  2. Kết xuất cả **10 cụm linh kiện xoay 360° ở độ phân giải WebGL `5K–6K` (`ssScale` lên tới `3.0x` = `5760 × 3240 px`)**, chia mỗi linh kiện `72 frames` thành **2 tấm `ImageBitmap` `6 × 6 = 36 frames` (`Group_*_sheet_0.webp` và `sheet_1.webp`, mỗi ô lên tới `672 × 672 px`, kích thước tấm $\le 4032 \times 4032 \le 4096$)** — giúp mật độ điểm ảnh của từng linh kiện tăng từ **5 lần đến 9 lần**, đọc rõ từng chữ khắc `INTEL i9-14900K` trên nắp CPU và từng cánh quạt/lá tản nhiệt khi phóng to.

---

## PHẦN III. DANH MỤC TỆP TIN TRONG KIẾN TRÚC MỚI

1. **[index.html](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/index.html):** Trang web chính sử dụng kiến trúc **300-Frame WebP Scrollytelling + 12 tấm `ImageBitmap` GPU ở Mốc 0 (`432 frames`) + 10 tấm `ImageBitmap` xoay 360° linh kiện ở Mốc 6 + 6 Mốc Cuộn Chuột + Lớp phủ ThreeUI**.
2. **[build_render_studio.mjs](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/build_render_studio.mjs):** Trình biên dịch tạo `render_studio.html` chứa toàn bộ nâng cấp PBR (Case Panoramic trắng sứ không lỗi bóng, quạt nguồn PSU 9 cánh lộ diện, bộ 3 quạt AIO xoay hướng về người dùng, quỹ đạo 6 đợt tách không xuyên vỏ Case, và hàm kết xuất tấm xoay 360° trên WebGL `window.buildTurntableSheetDataUrl`).
3. **[render_video_sequence.mjs](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/render_video_sequence.mjs):** Script tự động kết xuất 300 khung hình `frames/frame_000.webp .. frame_299.webp`, xuất bảng tọa độ [frames_coords.json](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/frames_coords.json) và đóng gói video MP4 60FPS.
4. **[render_turntables.mjs](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/render_turntables.mjs):** Script tự động kết xuất 12 tấm `M0_FullPC_sheet_0..11.webp` (`432 frames`) và 10 tấm `Group_*_360.webp` (`72 frames/nhóm`) cùng [turntables_meta.json](file:///C:/Users/maibi/.gemini/antigravity/scratch/pc-decor-web/turntables/turntables_meta.json).
