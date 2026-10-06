Menga Node.js va `node-telegram-bot-api` kutubxonasi yordamida shaxsiy kompyuterim terminalini Telegram bot orqali masofadan boshqarish uchun loyiha kodi kerak.

### 🌟 Asosiy talablar:

1. **Xavfsizlik va Boshqaruv (Admin Authentication):**
   - Bot faqat bitta belgilangan `ADMIN_CHAT_ID` bilan ishlasin.
   - Boshqa foydalanuvchilar xabar yuborsa, ularga rad javobi qaytarilsin.

2. **Accept / Reject (Tasdiqlash tizimi):**
   - Telegram'dan matn (buyruq) kelganda, bot uni DARHOL terminalda bajarmasin.
   - Avval bot foydalanuvchiga kiritilgan buyruqni ko'rsatib, ostida 2 ta inline tugma ko'rsatsin: 
     - `✅ Accept (Bajarish)`
     - `❌ Reject (Bekor qilish)`
   - Agar "Accept" bosilsa — buyruq `child_process.exec` yordamida terminalda bajarilsin va natija (stdout/stderr) Telegram'ga yuborilsin.
   - Agar "Reject" bosilsa — buyruq bekor qilinsin.

3. **Buyruq Natijasini Qaytarish (Execution Output):**
   - Buyruq natijasi Telegram'ga Markdown formatida va code-block (```) ichida chiroyli formatlanib yuborilsin.
   - Telegram'ning 4096 belgilik xabar limitidan oshib ketmasligi uchun natija max 3500 belgi bilan qirqib olingan holda (truncated) ko'rsatilsin.
   - Uzoq vaqt oladigan yoki xatolik bergan buyruqlar uchun unhandled crash bo'lmasligi uchun try/catch va error handling mukammal bo'lsin.

4. **Koding va Strukturasi:**
   - Kod toza, tushunarli va bitta `server.js` faylida tayyor ishlatishga qulay bo'lsin.
   - Loyihani sozlash va ishga tushirish uchun qisqa ko'rsatma (npm init, kutubxonalar, .env ishlatish bo'yicha maslahatlar) berilsin.