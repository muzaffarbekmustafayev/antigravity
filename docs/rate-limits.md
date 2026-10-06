# 📊 5-Soatlik Limit va Kvota Tizimi

## 📌 5-Soatlik Sirg'aluvchi Oyna (Rolling Window) Qanday Ishlaydi?

Google Antigravity va Vertex AI modellari uchun kvotalar kalendar sutkasi bo'yicha emas, balki **5 soatlik sirg'aluvchi vaqt oralig'i (5-hour rolling window)** bo'yicha hisoblanadi.

Bu tizimda:
- Har bir so'rov yuborilgan aniq vaqti (`timestamp`) bilan xotirada saqlanadi.
- Hozirgi vaqtdan boshlab orqaga 5 soat hisoblanadi: `[Hozirgi_Vaqt - 5 soat, Hozirgi_Vaqt]`.
- Agar 5 soat oldin yuborilgan so'rov bo'lsa, u oynadan chiqib ketadi va limitingiz avtomatik ravishda 1 taga tiklanadi!

---

## ⏳ Limit Tiklanish Taymeri (Next Slot Recovery)

Bot nafaqat ishlatilgan so'rovlarni, balki **birinchi bo'shash vaqtini** ham hisoblab chiqadi:

```
Eng birinchi so'rov 32 daqiqadan so'ng (soat 21:15 da) oynadan chiqib, limit bo'shaydi.
```

Bu foydalanuvchiga qachon yangi so'rov yuborishi mumkinligini aniq bilish imkonini beradi.

---

## 📈 Ko'rsatkichlar Paneli (`/limit`)

`/limit` buyrug'i yoki `📊 5-Soatlik Limit` tugmasi bosilganda quyidagi interaktiv ma'lumotlar beriladi:

1. **Aktiv model va tezlik:** `Gemini 3.8 Flash [High]`
2. **Holat belgisi:**
   - 🟢 **Yaxshi** — Yuklanish 70% dan past
   - 🟡 **O'rtacha** — Yuklanish 70% - 90%
   - 🔴 **Limitga yaqin** — Yuklanish 90% dan yuqori
3. **Ishlatilgan va qolgan so'rovlar:** `35 / 250 ta` (qolgan: `215 ta`)
4. **Vizual progress bar:** `[███░░░░░░░░░] 14%`
5. **Modellar bo'yicha taqsimot:**
   - `⚡ Gemini 3.8 Flash: 25 ta`
   - `🤖 Claude Sonnet 4.6: 10 ta`
6. **Tezlik bo'yicha taqsimot:** `High: 28` | `Medium: 5` | `Low: 2`
7. **24 soatlik kunlik umumiy so'rovlar soni**

---

## ⚙️ Limitlarni Sozlash

1. **`.env` orqali belgilash:**
   ```env
   FIVE_HOUR_LIMIT=250
   ```
2. **Telegram orqali tezkor o'zgartirish:**
   ```
   /setlimit 300
   ```
   Bu buyruq umumiy limit chegarasini bir zumda yangilaydi.
