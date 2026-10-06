# 🔒 API va Xavfsizlik Qo'llanmasi

## 📌 Xavfsizlik Arxitekturasi

Masofaviy terminal botlari yuqori darajadagi xavfsizlikni talab qiladi, chunki ular orqali kompyuteringizda buyruqlar bajariladi.

Ushbu loyihada quyidagi xavfsizlik mexanizmlari joriy etilgan:

---

## 1. 🔑 Admin Autentifikatsiyasi (Strict Whitelist)

- Barcha Telegram xabarlari va inline callback query'lar `isAdmin(chatId)` orqali tekshiriladi:
  ```javascript
  const isAdmin = (id) => id.toString() === ADMIN_ID.toString();
  ```
- Agar xabar `.env` dagi `ADMIN_CHAT_ID` ga tegishli bo'lmasa, darhol rad javobi beriladi va hech qanday buyruq bajarilmaydi.
- Ruxsat etilmagan foydalanuvchilar buyruqlar menyusini ham, tizim ma'lumotlarini ham ko'ra olmaydi.

---

## 2. 🔌 Mahalliy HTTP Webhook Server (`http://127.0.0.1:7799`)

Bot ichida faqat kompyuterning o'zida (`localhost` / `127.0.0.1`) ishlaydigan xavfsiz HTTP server mavjud.

Tashqi internet foydalanuvchilari ushbu portga to'g'ridan-to'g'ri ulana olmaydi.

### Endpoints:

#### A. `/send-file` — Fayllarni Telegramga Yuborish
- **Metod:** `GET`
- **Parametrlar:**
  - `file`: Kompyuterdagi faylning to'liq yoki nisbiy yo'li
  - `caption` (ixtiyoriy): Fayl sarlavhasi
- **Misol:**
  ```bash
  curl.exe -s "http://127.0.0.1:7799/send-file" -G --data-urlencode "file=report.pdf" --data-urlencode "caption=Kunlik hisobot"
  ```

#### B. `/send-msg` — Telegramga Xabar Yuborish
- **Metod:** `GET`
- **Parametrlar:**
  - `text`: Yuboriladigan xabar matni
- **Misol:**
  ```bash
  curl.exe -s "http://127.0.0.1:7799/send-msg" -G --data-urlencode "text=Loyiha muvaffaqiyatli build qilindi!"
  ```

---

## 3. 🛡️ Maxfiy Ma'lumotlar Xavfsizligi

Loyihada maxfiy kalitlar Git omboriga chiqib ketmasligi uchun `.gitignore` quyidagi qoidalarni o'z ichiga oladi:
```gitignore
# Maxfiy fayllar
.env
.env.local
*.env

# Ma'lumotlar bazasi va loglar
data/
logs/
*.log
```

---

## 4. 🛑 Jarayonlarni Majburiy To'xtatish (Process Kill)

- Har bir buyruq 15 daqiqalik qattiq timeout (`timeout: 900000 ms`) bilan cheklangan.
- Agar buyruq cheksiz siklga kirib qolsa yoki uzoq vaqt olsa:
  - Telegram xabaridagi **`🛑 To'xtatish`** tugmasi
  - Yoki `/kill` buyrug'i orqali jarayon xavfsiz to'xtatiladi.
