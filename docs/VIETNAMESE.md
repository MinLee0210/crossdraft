# Vietnamese review

A terminology pass over every Vietnamese string in `lib/i18n.ts`, `lib/content.ts` and `lib/landing.ts`, done on 2026-11-24 by reading how Vietnamese sources phrase these ideas. It is a desk check against published usage, **not** a native-speaker proofread: tone, rhythm and register still need a person who writes Vietnamese every day (see "Still open").

## What the sources say

| Concept | Usage found | Where | Decision |
|---|---|---|---|
| Cross ventilation | "thông gió xuyên phòng" is the everyday term in property and design press; "hai mặt thoáng" describes a room with two exposed sides | [CafeLand](https://cafeland.vn/xu-huong/nha-ong-3-tang-hoa-giai-su-ngot-ngat-nho-loi-thong-tang-va-thong-gio-xuyen-phong-152930.html), [VnExpress](https://vnexpress.net/nhung-cach-thong-gio-cho-nha-mat-pho-4469885.html) | Kept "thông gió xuyên phòng" |
| Light well, tube house | "giếng trời", "nhà ống", "thông tầng" (a different feature: links floors for convection) | [VnExpress](https://vnexpress.net/gieng-troi-trong-nha-pho-2823422.html), [CafeF](https://cafef.vn/gieng-troi-va-thong-tang-khac-nhau-the-nao-188260902071541249.chn) | Kept |
| Draught | "gió lùa" | same | Kept |
| Air changes per hour (ACH) | The draft national indoor-air standard defines the quantity as the volume of ventilation air per hour divided by the room volume and calls it "số lần thay đổi không khí"; the ventilation design standard TCVN 5687:2024 has a section titled "Tổ chức thông gió và trao đổi không khí" (only the table of contents was visible, not the definitions) | [MOC draft TCVN](https://dns1.moc.gov.vn/Images/editor/files/Duthao/2021/TCVN_2020%20CLKKTN%2011-2021.docx), [TCVN 5687:2024](https://caselaw.vn/van-ban-phap-luat/462580-tieu-chuan-quoc-gia-tcvn-5687-2024-ve-thong-gio-dieu-hoa-khong-khi-yeu-cau-thiet-ke-nam-2024) | Changed the ad-hoc "số lần thay khí" to **"số lần trao đổi không khí"**, with "ACH" kept as the label. The draft standard says "thay đổi", the design standard says "trao đổi"; either is defensible and the choice is a judgement call |
| Feng shui remedies | "bình phong", "huyền quan", rèm, kệ, chậu cây; the front-door-aligned-with-back-door fault is "cửa chính thẳng cửa sau" | [CafeLand](https://cafeland.vn/xu-huong/hoa-giai-nha-bi-duong-cai-dam-vao-cua-chinh-51144.html), [Báo Văn hóa](https://baovanhoa.vn/doi-song/5-sai-lam-phong-thuy-can-tranh-de-giu-tai-loc-va-suc-khoe-195942.html) | Kept. The sources describe the same fix list the app uses |
| CFD in Vietnamese architecture research | "mô phỏng CFD", "vùng quẩn gió" for recirculation zones | [VJOL](https://vjol.info.vn/amc/article/download/87113/74062), [VJOL](https://vjol.vista.gov.vn/amc/vi/article/download/181017/156857/305262) | Kept "CFD"; "xoáy" in prose is fine for a student audience |

## Changes made

1. **Compass letters.** The wind dial, sweep rose, openings table and A/B summary showed English letters (N, NE, E…). In Vietnamese, **N is Nam (south)**, the opposite of English N, so a Vietnamese reader would have misread the wind direction. `compass()` now takes the language and returns Bắc, Đông Bắc, Đông, Đông Nam, Nam, Tây Nam, Tây, Tây Bắc (B, ĐB, Đ, ĐN, N, TN, T, TB on the narrow rose). It rounds to the eight main points; the exact bearing in degrees is still shown. The feng shui sentences use the same names.
2. **"ô mở" became "ô cửa".** "Ô mở" is a coinage with no use in the sources. "Ô cửa" reads as a door or window opening and matches "cửa đi", "cửa sổ" nearby.
3. **"Test" became "Thử".** "Test vào A", "Thời gian test" and similar mixed an English verb into a Vietnamese sentence. Now "Thử vào A", "Thời gian thử", "Thử → A".
4. **Dead zone vs stale air.** The app measures two different things: still air (low speed) and stale air (old air). The Vietnamese used "khí tù" for both. Still air is now **"lặng gió"** (matching the FAQ), stale air stays "khí tù".
5. **Wind presets.** "Gió mùa đông bắc mùa đông" said "winter" twice. Now "Gió mùa Đông Bắc (miền Bắc, tháng 10-3)", "Gió Đông Nam mùa hè", "Gió mùa Tây Nam", "Gió Đông mùa khô". Compass names are capitalised (Đông Bắc) as a style choice; I did not verify this against a style guide.
6. **"Bấm vào" and "Nhấn vào"** were both used for "click". Standardised on "Nhấn".
7. **Dial and map letters.** The wind dial's N/E/S/W and the north marker on the canvas ('N ↑') are now B/Đ/N/T and 'B ↑' in Vietnamese, for the same reason as the compass names.
8. **Default board names.** The first board was created as "Board 1" before the language was known. Boards still carrying a default name now follow the language ("Bảng 1"); names you typed are left alone.
9. **Multiplication sign.** The score formula used the letter x; now ×.

## Not found, so not verified

- **"tuổi không khí"** (air age). No Vietnamese source uses the idea, so there is no established term. It is kept, and the first place it appears explains it in words ("thời gian không khí đã ở trong nhà"). A Vietnamese ventilation engineer may have a better phrase.
- **"Bội số trao đổi không khí"** also appears in engineering texts for ACH. The app uses the plainer "số lần trao đổi không khí".
- **"tàng phong tụ khí"** was not found as an exact phrase in the searches; the idea (keep the wind out, gather the qi) matches the sources. It is labelled tradition, as before.

## Still open

- A native speaker should read the whole interface and the six guide pages for tone and naturalness. The FAQ answer "What languages does it support?" still says the Vietnamese awaits a native-speaker review, and that stays true until someone does it.
- English UI strings that only exist in English (error messages from the browser) are not translated.
