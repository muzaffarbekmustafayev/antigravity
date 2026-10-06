# 🏗️ Antigravity Remote Terminal Bot — Arxitektura Qo'llanmasi

## 📌 Umumiy Ko'rinish

**Antigravity Remote Terminal Bot** — bu Telegram Bot API va mahalliy tizimingizdagi **Google Antigravity (`agy`)** CLI agenti o'rtasidagi xavfsiz ikki tomonlama ko'prikdir.

U dasturchilarga o'z kompyuteridagi terminal jarayonlarini, fayllarni va AGY AI agentini masofadan boshqarish imkonini beradi.

---

## 🏛️ Tizim Arxitekturasi

```
 ┌──────────────────────┐
 │     Telegram Foydalanuvchi   │ (Faqat ADMIN_CHAT_ID)
 └──────────┬───────────┘
            │  HTTPS / Telegram Bot API (Long Polling)
            ▼
 ┌────────────────────────────────────────────────────────┐
 │                 server.js (Node.js)                   │
 │                                                        │
 │  ┌───────────────────────┐  ┌────────────────────────┐ │
 │  │   Session Manager     │  │   5-Hour Limit Engine  │ │
 │  │  (Isolated CWD/State) │  │ (Rolling Window Quota) │ │
 │  └───────────┬───────────┘  └───────────┬────────────┘ │
 │              │                          │              │
 │  ┌───────────▼──────────────────────────▼────────────┐ │
 │  │       AGY CLI Process Spawner & Controller        │ │
 │  └───────────────────────┬───────────────────────────┘ │
 └──────────────────────────┼─────────────────────────────┘
                            │ Child Process (exec)
                            ▼
 ┌────────────────────────────────────────────────────────┐
 │       Google Antigravity CLI (agy.exe)                │
 │  - Model: gemini-3.8-flash, claude-sonnet-4-6, ...     │
 │  - Reasoning Effort: low | medium | high               │
 │  - Mode: accept-edits                                  │
 │  - Headless Permissions: auto-approved                 │
 └──────────┬─────────────────────────────────────────────┘
            │  Local Webhook (HTTP :7799)
            ▼
 ┌────────────────────────────────────────────────────────┐
 │     Local HTTP Server (http://127.0.0.1:7799)         │
 │  - /send-file?file=path -> Telegram SendDocument       │
 │  - /send-msg?text=msg   -> Telegram SendMessage        │
 └────────────────────────────────────────────────────────┘
```

---

## ⚙️ Asosiy Modullar

### 1. `server.js` Asosiy Dvigateli
- **Telegram Bot Klienti:** `node-telegram-bot-api` orqali xabarlarni qabul qiladi va HTML formatida xatosiz javoblarni qaytaradi.
- **Xavfsizlik qatlami:** Faqat `.env` dagi `ADMIN_CHAT_ID` bilan cheklangan. Begona foydalanuvchilar zudlik bilan rad etiladi.
- **AGY CLI Binarini Avtomatik Aniqlash:** `C:\Users\<user>\AppData\Local\agy\bin\agy.exe` yoki tizim `PATH`idan qidiradi.

### 2. Multi-Session Manager (Sessiyalar Boshqaruvi)
- Har bir sessiya o'z nomi, alohida ishchi jildi (`cwd`), tanlangan AI modeli, ishlash tezligi (`effort`) va buyruqlar tarixiga ega.
- Ma'lumotlar avtomatik tarzda `data/sessions.json` faylida saqlanadi. Bot o'chib-yonsa ham sessiyalar holati tiklanadi.

### 3. 5-Hour Rolling Limit Tracker
- Har bir yuborilgan buyruqni `data/limits.json` faylida vaqt tamg'asi (`timestamp`) bilan qayd qiladi.
- Oxirgi 5 soatlik oraliqdagi barcha so'rovlarni hisoblab chiqadi.
- Eng birinchi so'rov qachon oynadan chiqib ketishini va limit qachon bo'shashini soniyasigacha ko'rsatib turadi.

### 4. Mahalliy HTTP Webhook Server (`127.0.0.1:7799`)
- AGY agenti bajarilayotgan paytda `curl` orqali fayl yoki xabar yuborish imkoniyatiga ega.
- `/send-file`: Masalan agent skrinshot yoki tayyor fayl yaratganda Telegramga to'g'ridan-to'g'ri yuboradi.
- `/send-msg`: Katta loyihalarda oraliq holat xabarlarini yuborish uchun xizmat qiladi.

---

## 🔒 Xavfsizlik Tamoyillari
1. **Admin Autentifikatsiyasi:** Barcha xabarlar va callback query'lar `isAdmin(chatId)` orqali tekshiriladi.
2. **Sirli Ma'lumotlar:** `.env` va `data/*.json` fayllari `.gitignore` ga kiritilgan bo'lib, Git omboriga chiqib ketmaydi.
3. **Localhost Cheklovi:** Webhook server faqat `127.0.0.1` manziliga ulanadi, tashqi tarmoqdan kirish imkonsiz.
