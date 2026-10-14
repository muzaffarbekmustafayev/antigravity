# 📂 Loyiha Fayllar Tuzilishi (File Tree)

Ushbu hujjat **Antigravity Remote Terminal Bot** loyihasining barcha jildlari, fayllari va ularning vazifalarini to'liq tavsiflaydi.

---

## 🌳 Daraxt Ko'rinishi (Project Tree)

```text
antigravity/
├── .env                              # Maxfiy muhit o'zgaruvchilari (Token, Admin ID va h.k.)
├── .env.example                      # Muhit o'zgaruvchilari uchun namuna shablon
├── .gitignore                        # Git e'tiborga olmasligi kerak bo'lgan fayllar ro'yxati
├── README.md                         # Loyiha haqida umumiy qo'llanma va o'rnatish yo'riqnomasi
├── cli.js                            # Interaktiv terminal boshqaruv paneli (npm start)
├── nodemon.json                      # Rivojlantirishda fayllar o'zgarishini kuzatish konfiguratsiyasi
├── package.json                      # Node.js loyiha metadata va bog'liqliklar ro'yxati
├── package-lock.json                 # Qat'iy o'rnatilgan paketlar versiyalari kesh fayli
├── run-background.vbs                # Botni Windows orqa fonida yashirin (silent) ishga tushiruvchi VBS skript
├── server.js                         # Botning asosiy kirish nuqtasi (Entry Point)
├── stop-bot.bat                      # Fondagi barcha bot jarayonlarini to'xtatuvchi skript
│
├── data/                             # Ma'lumotlar saqlanadigan jild (avtomatik yaratiladi)
│   ├── limits.json                   # 5-soatlik limit hisoblagichining so'rovlar jurnali
│   └── sessions.json                 # Saqlangan ishchi sessiyalar va ularning holatlari
│
├── docs/                             # Loyiha hujjatlari va texnik qo'llanmalar
│   ├── api-and-security.md           # Mahalliy Webhook API va xavfsizlik arxitekturasi
│   ├── architecture.md               # Tizimning umumiy ishlash arxitekturasi va sxemalari
│   ├── file-tree.md                  # Loyihaning to'liq fayllar strukturasi (ushbu fayl)
│   ├── models-and-speed.md           # Qo'llab-quvvatlanadigan AI modellari va tafakkur tezliklari
│   ├── rate-limits.md                # 5-soatlik rolling window limit mexanizmi tafsilotlari
│   └── sessions-guide.md             # Sessiyalar boshqaruvi va izolyatsiyalangan ish jildlari
│
└── src/                              # Botning asosiy dasturiy kodlari
    ├── bot.js                        # Telegram bot instansiyasini sozlash va hodisalarni ulash
    ├── config.js                     # Markazlashtirilgan sozlamalar va doimiylar
    ├── git-saver.js                  # O'zgarishlarni Git orqali avtomatik commit va push qiluvchi modul
    ├── limits.js                     # 5-soatlik dinamik cheklov algoritmi moduli
    ├── models.js                     # LLM modellari ro'yxati va ularning xususiyatlari
    ├── runner.js                     # Google Antigravity CLI (agy) jarayonini boshqaruvchi modul
    ├── sessions.js                   # Ko'p sessiyali tizim holatini boshqarish va saqlash
    ├── tunnel.js                     # Masofaviy ulanish (HTTPS tunnel) moduli
    ├── ui.js                         # Telegram Inline klaviaturalar va xabar shablonlari
    ├── utils.js                      # HTML formatlash, xabarlarni qisqartirish va yordamchi funksiyalar
    ├── webhook.js                    # Mahalliy HTTP server (127.0.0.1:7799) va veb boshqaruv
    │
    ├── bypass/                       # Geo-cheklovlarni aylanib o'tish (Bypass) tizimi
    │   ├── dns-bypass.js             # Mahalliy DNS proksi va yo'naltiruvchi mexanizm
    │   ├── index.js                  # Bypass moduli asosiy interfeysi
    │   ├── patch.js                  # Mijoz dasturini patch qilish va sozlash
    │   └── watchdog.js               # Tarmoq ulanishini doimiy nazorat qiluvchi kuzatuvchi
    │
    └── handlers/                     # Telegram hodisalarini qabul qiluvchi boshqaruvchilar
        ├── callbacks.js              # Inline tugmalar (Accept/Reject, modellar, sessiyalar) handleri
        ├── commands.js               # Bot buyruqlari (/start, /model, /session, /limit va h.k.)
        └── messages.js               # Foydalanuvchi matnli xabarlarini qayta ishlash
```

---

## 📋 Fayllar va Jildlar Bo'yicha Tafsilotlar

### 1. Ildiz Fayllar (Root Files)
| Fayl | Tavsif |
| :--- | :--- |
| `server.js` | Botni to'liq ishga tushiruvchi asosiy modul. Telegram bot, webhook server va xavfsizlik parametrlarini faollashtiradi. |
| `cli.js` | Interaktiv konsol paneli. `npm start` orqali ochiladi; botni ishga tushirish, to'xtatish, holatini ko'rish va bypassni yoqish imkonini beradi. |
| `run-background.vbs` | Windows tizimida qora konsol oynasisiz orqa fonda yashirin (silent) ishga tushirish uchun VBScript. |
| `stop-bot.bat` | Fondagi barcha faol `server.js` va bot jarayonlarini port `:7799` bo'yicha topib to'xtatadi. |
| `nodemon.json` | Dasturlash paytida `data/` jildidagi JSON fayllar o'zgarganda bot qayta ishga tushmasligi uchun ignore sozlamalari. |
| `package.json` | Node.js bog'liqliklari (`node-telegram-bot-api`, `dotenv`, `nodemon` va h.k.) hamda `npm` buyruqlari. |

### 2. `src/` — Asosiy Mantiqiy Qatlam
| Fayl | Tavsif |
| :--- | :--- |
| `src/bot.js` | Bot instansiyasini initsializatsiya qiladi, buyruqlar menyusini o'rnatadi va handlerlarni bog'laydi. |
| `src/config.js` | `.env` ma'lumotlarini o'qiydi, admin autentifikatsiyasini tekshiradi va global konfiguratsiyani saqlaydi. |
| `src/runner.js` | Google Antigravity (`agy.exe`) bilan `child_process` orqali aloqa qiladi, natijalarni oladi va xatoliklarni qayta ishlaydi. |
| `src/sessions.js` | Foydalanuvchi sessiyalarini boshqaradi: alohida jildlar (`cwd`), joriy model, tezlik va buyruqlar tarixi. |
| `src/limits.js` | So'nggi 5 soatlik oraliqdagi (Rolling Window) so'rovlar limitini doimiy hisoblab boradi. |
| `src/models.js` | Gemini 3.8 Flash/Pro va boshqa sun'iy intellekt modellarining texnik parametrlarini belgilaydi. |
| `src/git-saver.js` | Bot interfeysidagi "O'zgarishlarni Git'ga saqlash" tugmasi bosilganda avtomatik `git add`, `commit` va `push` bajaradi. |
| `src/ui.js` | Telegramdagi barcha zamonaviy inline tugmalar, menyular va holat kartalarini chiroyli formatda shakllantiradi. |
| `src/utils.js` | HTML belgilarini ekranlash (`escapeHtml`), matnni Telegram xabar hajmiga moslab qisqartirish yordamchilari. |
| `src/webhook.js` | `http://127.0.0.1:7799` manzilida mahalliy API serverini (ichki xabar/fayl uzatish) ishga tushiradi. |

### 3. `src/handlers/` — Hodisalar Boshqaruvi
| Fayl | Tavsif |
| :--- | :--- |
| `commands.js` | `/start`, `/help`, `/session`, `/model`, `/effort`, `/limit`, `/cwd`, `/status` buyruqlarini boshqaradi. |
| `callbacks.js` | Telegramdagi barcha inline tugmalar bosilganda qaytariladigan harakatlarni (Accept, Reject, Model tanlash) qayta ishlaydi. |
| `messages.js` | Botga yozilgan har qanday terminal buyrug'i yoki savolni qabul qilib, uni tasdiqlash (Accept/Reject) kartasiga aylantiradi. |

### 4. `src/bypass/` — DNS va Geo-Check Bypass
| Fayl | Tavsif |
| :--- | :--- |
| `dns-bypass.js` | Antigravity uchun mintaqaviy cheklovlarni aylanib o'tuvchi mahalliy DNS yo'naltiruvchi server. |
| `patch.js` | Mijoz konfiguratsiyasi va kerakli tarmoq yo'nalishlarini avtomatik sozlaydi. |
| `watchdog.js` | Tarmoq holatini va DNS serverining barqaror ishlashini doimiy nazorat qiladi. |
| `index.js` | Bypass tizimini bitta buyruq bilan yoqish va o'chirish interfeysi. |

### 5. `data/` — Saqlanadigan Ma'lumotlar
| Fayl | Tavsif |
| :--- | :--- |
| `limits.json` | Har bir yuborilgan buyruqning vaqt tamg'alari (`timestamps`). |
| `sessions.json` | Barcha yaratilgan sessiyalar, ularning faol holati va konfiguratsiyalari. |

### 6. `docs/` — Texnik Hujjatlar
| Fayl | Tavsif |
| :--- | :--- |
| `architecture.md` | Tizim arxitekturasi va komponentlararo ma'lumotlar oqimi. |
| `api-and-security.md` | Mahalliy HTTP Webhook API endpointlari va xavfsizlik qoidalari. |
| `models-and-speed.md` | Sun'iy intellekt modellari va fikrlash tezliklari haqida yo'riqnoma. |
| `rate-limits.md` | 5-soatlik kvota mexanizmi va uning qanday ishlashi. |
| `sessions-guide.md` | Izolyatsiyalangan sessiyalar bilan ishlash bo'yicha batafsil qo'llanma. |
| `file-tree.md` | Ushbu hujjat — loyihaning to'liq tuzilmasi xaritasi. |
