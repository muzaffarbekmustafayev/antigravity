# 🤖 AI Modellari va Ishlash Tezligi (Reasoning Effort)

## 📌 Rasmiy Google Antigravity Modellari

Bot tizimingizdagi Google Antigravity (`agy`) CLI'ning eng so'nggi modellarini to'liq qo'llab-quvvatlaydi.

| Model ID | Nomi | Emoji | Xarakteristikasi | Tezlikni (Effort) qo'llashi | 5-Soatlik Limit |
| :--- | :--- | :---: | :--- | :---: | :---: |
| `gemini-3.8-flash` | **Gemini 3.8 Flash** | ⚡ | **Asosiy tavsiya etilgan model.** O'ta tezkor, kuchli mantiq va kodlash. | ✅ Ha | 250 ta |
| `gemini-3.7-flash` | **Gemini 3.7 Flash** | 🚀 | Tez va universal vazifalar uchun qulay model. | ✅ Ha | 250 ta |
| `gemini-3.6-flash` | **Gemini 3.6 Flash** | 🔥 | Oldingi avlod barqaror tezkor modeli. | ✅ Ha | 300 ta |
| `gemini-3.1-pro` | **Gemini 3.1 Pro** | 🧠 | Murakkab tizimlar, chuqur arxitektura va og'ir muhandislik. | ✅ Ha | 50 ta |
| `claude-sonnet-4-6` | **Claude Sonnet 4.6** | 🤖 | Anthropic Thinking modeli, nozik refaktoring va tahlil. | ⚠️ Standart | 50 ta |
| `claude-opus-4-6-thinking` | **Claude Opus 4.6** | 🦾 | Anthropic'ning eng yuqori darajadagi chuqur fikrlovchi modeli. | ⚠️ Standart | 25 ta |
| `gpt-oss-120b-medium` | **GPT-OSS 120B** | 🟢 | Ochiq manbali 120 milliard parametrli kuchli model. | ⚠️ Standart | 100 ta |

---

## ⚡ Ishlash Tezligi / Reasoning Effort

Google Gemini modellarida fikrlash chuqurligi (Reasoning Effort) ni tanlash imkoniyati mavjud:

### 1. ⚡ `low` — Tezkor Rejim
- **Qachon ishlatiladi:** Oddiy savollar, tezkor terminal buyruqlari, sintaksis tekshirish, fayl yaratish.
- **Xususiyatlari:** Javob berish vaqti minimal, juda kam token sarflaydi, kvotani tejaydi.
- **CLI parametri:** `--effort low`

### 2. ⚖️ `medium` — Balanslangan Rejim
- **Qachon ishlatiladi:** O'rtacha murakkablikdagi funksiyalar, standart dasturlash vazifalari.
- **Xususiyatlari:** Tezlik va fikrlash sifati o'rtasidagi optimal muvozanat.
- **CLI parametri:** `--effort medium`

### 3. 🧠 `high` — Chuqur Tahlil Rejimi (Tavsiya etiladi)
- **Qachon ishlatiladi:** Murakkab buglarni qidirish, arxitektura loyihalash, xavfsizlik tekshiruvlari.
- **Xususiyatlari:** Maksimal fikrlash chuqurligi, yuqori sifatli va xatosiz yechimlar.
- **CLI parametri:** `--effort high`

---

## 🎮 Telegram Orqali Boshqarish

### Modelni Tanlash:
- Klaviatura orqali: `🤖 Model` tugmasi
- Buyruq orqali: `/model`
- Sessiya kartasi orqali: `[🤖 Modelni o'zgartirish]`

### Tezlikni Tanlash:
- Klaviatura orqali: `⚡ Tezlik` tugmasi
- Buyruq orqali: `/effort` yoki `/speed`
- Inline tugmalar: `[⚡ Low]` | `[⚖️ Medium]` | `[🧠 High]`

Tanlangan model va tezlik darajasi har bir yangi yuborilgan buyruqda darhol qo'llaniladi.
