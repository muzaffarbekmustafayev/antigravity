<div align="center">

# 🚀 Antigravity Remote Terminal Bot

**Manage your computer's terminal & Google Antigravity (AGY) sessions remotely and securely via Telegram.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Telegram Bot API](https://img.shields.io/badge/Telegram-Bot%20API-blue.svg)](https://core.telegram.org/bots/api)
[![Google Antigravity](https://img.shields.io/badge/AGY-CLI%20Enabled-orange.svg)](https://antigravity.google)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

### 🌐 Select Language / Tilni tanlang / Выберите язык
[**🇺🇸 English**](#-english) | [**🇺🇿 O'zbekcha**](#-ozbekcha) | [**🇷🇺 Русский**](#-русский)

---

</div>

<a name="english"></a>
## 🇺🇸 English

### 🌟 Overview
**Antigravity Remote Terminal Bot** is a secure, multi-session Telegram bridge that connects your Telegram chat directly to your local computer's terminal and Google Antigravity (AGY) coding agent. It allows developers to supervise coding tasks, execute commands, switch AI reasoning models and speeds, monitor 5-hour rolling API usage limits, and send/receive files remotely.

### ✨ Key Features
- **🤖 Official Antigravity AI Models:** Switch seamlessly between latest models (`Gemini 3.8 Flash`, `Gemini 3.7 Flash`, `Gemini 3.6 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet 4.6`, `Claude Opus 4.6`, `GPT-OSS 120B`).
- **⚡ Reasoning Effort & Speed Control:** Toggle between `Low (Fast / Low compute)`, `Medium (Balanced)`, and `High (Deep reasoning / Highest quality)`.
- **⏱️ 5-Hour Rolling Limit Tracker (`/limit`):** Real-time monitoring of your 5-hour quota window, countdown timer until the earliest slot recovers, and breakdown per model and effort tier.
- **📂 Interactive Session Management (`/sessions`):** Interactive session cards with directory controls, model/effort switcher, conversation reset, rename, and process kill.
- **📤 Telegram File Bridge (`/get` & Local API):** Download files from your machine directly to Telegram, or let AGY send generated files via local HTTP webhook.
- **🔒 Admin-Only Security:** Access restricted strictly to your `ADMIN_CHAT_ID`. All unauthorized users are immediately rejected.
- **🛑 Real-time Process Control:** Kill long-running or stuck processes anytime with inline buttons.

---

### 🚀 Quick Start & Installation

#### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Antigravity CLI](https://antigravity.google) (`agy`) installed on your system (auto-detected)

#### 2. Setup Bot
1. Open [@BotFather](https://t.me/BotFather) in Telegram and create a new bot to get your `BOT_TOKEN`.
2. Get your numeric Telegram user ID from [@userinfobot](https://t.me/userinfobot) for `ADMIN_CHAT_ID`.

#### 3. Clone & Configure
```bash
git clone https://github.com/your-username/antigravity-remote-terminal.git
cd antigravity-remote-terminal
npm install
cp .env.example .env
```

Configure `.env`:
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
ADMIN_CHAT_ID=123456789
DEFAULT_CWD=C:\Users\username\Desktop\my-project
DEFAULT_MODEL=gemini-3.8-flash
DEFAULT_EFFORT=high
FIVE_HOUR_LIMIT=250
LOCAL_API_PORT=7799
```

#### 4. Run the Bot
```bash
npm start
```

---

### 🎮 Available Commands

| Command | Description |
| :--- | :--- |
| `/start` | Launch bot, display system status, and show persistent keyboard |
| `/sessions` | View and manage interactive session cards |
| `/model` | Open AI Model selection keyboard |
| `/effort` or `/speed` | Select model reasoning speed (Low, Medium, High) |
| `/limit` | View 5-hour rolling limit progress, next reset timer, and statistics |
| `/newsess <name>` | Create and activate a new session |
| `/switch <id>` | Switch to a specific session by ID |
| `/setcwd <path>` | View or update working directory |
| `/get <filepath>`| Download a file from host machine to Telegram |
| `/pwd` | Print working directory of active session |
| `/ls` | List directory contents of active session |
| `/history` | View the last 20 commands executed in active session |
| `/kill` | Terminate active child process in current session |
| `/sys` | Display host CPU, RAM, OS, and AGY binary diagnostics |
| `/help` | Show command cheat sheet |

---

<br/>

<a name="ozbekcha"></a>
## 🇺🇿 O'zbekcha

### 🌟 Umumiy Ma'lumot
**Antigravity Remote Terminal Bot** — bu Telegram orqali shaxsiy kompyuteringiz terminali va eng yangi Google Antigravity (AGY) agentini masofadan to'liq xavfsiz boshqarish imkonini beruvchi tizimdir. Loyihalaringizni istalgan joydan turib boshqaring, model va tezlikni tanlang, 5 soatlik limitni kuzatib boring.

### ✨ Asosiy Imkoniyatlar
- **🤖 Yangilangan Google Antigravity Modellari:**
  - `Gemini 3.8 Flash` — Eng yangi, o'ta tezkor va aqlli (Asosiy / Tavsiya etiladi)
  - `Gemini 3.7 Flash` — Tez va ko'p qirrali
  - `Gemini 3.6 Flash` — Oldingi avlod, yengil skriptlar
  - `Gemini 3.1 Pro` — Murakkab arxitektura va kodlash
  - `Claude Sonnet 4.6` — Anthropic Thinking, chuqur tahlil
  - `Claude Opus 4.6` — Eng kuchli Anthropic modeli
  - `GPT-OSS 120B` — Ochiq manbali model
- **⚡ Ishlash Tezligini Tanlash (Reasoning Effort):**
  - ⚡ `Low (Tezkor)` — Minimal fikrlash, tezkor javob, kam token sarfi
  - ⚖️ `Medium (O'rtacha)` — Standart muvozanatli tezlik
  - 🧠 `High (Chuqur)` — Maksimal tahlil va yuqori sifatli kodlash
- **⏱️ Aniq 5-Soatlik Limit Tizimi (`/limit`):**
  - 5 soatlik sirg'aluvchi (rolling window) limit statusi
  - Ishlatilgan va qolgan so'rovlar soni (`X / 250 ta`)
  - Vizual yuklanish progress-bari (`[████░░░░░░] 35%`)
  - Keyingi so'rov tiklanish vaqti taymeri (masalan: `42 daqiqadan so'ng 22:15 da`)
  - Modellar va tezlik darajalari bo'yicha sarf statistikasi
- **📂 Kuchaytirilgan Interaktiv Sessiyalar (`/sessions`):**
  - Har bir sessiya uchun alohida karta: model, tezlik, papka, buyruqlar soni
  - Bitta tugma bilan sessiyaga o'tish, nomini o'zgartirish, suhbatni tozalash (`reset`), papkani sozlash
- **📤 Fayl Yuklab Olish (`/get`):** Kompyuterdagi fayllarni to'g'ridan-to'g'ri Telegramga yuklab olish.
- **🔒 100% Xavfsiz:** Faqat `.env` dagi `ADMIN_CHAT_ID` foydalanuvchisi boshqara oladi.

---

### 🚀 O'rnatish va Ishga Tushirish

#### 1. Talablar
- Node.js (v18+)
- Google Antigravity CLI (`agy`)

#### 2. Sozlash
```bash
git clone https://github.com/your-username/antigravity-remote-terminal.git
cd antigravity-remote-terminal
npm install
cp .env.example .env
```

`.env` fayli namunasi:
```env
BOT_TOKEN=8752300123:AAF1F9Q1cedDyhEj4k0lWXsKhx9wIX5Hvx4
ADMIN_CHAT_ID=112436605
DEFAULT_CWD=C:\Users\muzaf\Desktop\mzfck\projects
DEFAULT_MODEL=gemini-3.8-flash
DEFAULT_EFFORT=high
FIVE_HOUR_LIMIT=250
LOCAL_API_PORT=7799
```

#### 3. Ishga Tushirish
```bash
npm start
```

---

### 🎮 Bot Buyruqlari

| Buyruq | Tavsif |
| :--- | :--- |
| `/start` | Botni ishga tushirish, holat va doimiy qulay menyu |
| `/sessions` | Interaktiv sessiyalar ro'yxati va boshqaruv paneli |
| `/model` | AI modelini tanlash oynasi |
| `/effort` yoki `/speed` | Model ishlash tezligini tanlash (Low, Medium, High) |
| `/limit` | Aniq 5-soatlik limit va tiklanish taymeri |
| `/newsess <nom>` | Yangi sessiya ochish |
| `/switch <id>` | Belgilangan sessiyaga o'tish |
| `/setcwd <yo'l>` | Ishchi papkani ko'rish yoki yangilash |
| `/get <fayl>` | Kompyuterdan faylni Telegramga yuklab olish |
| `/pwd` | Faol sessiyaning joriy papkasi |
| `/ls` | Faol sessiya papkasidagi fayllar |
| `/history` | So'nggi 20 ta buyruq |
| `/kill` | Ishlayotgan jarayonni to'xtatish |
| `/sys` | Server tizim parametrlari (CPU, RAM, OS, AGY) |
| `/help` | Bot qo'llanmasi |

---

<br/>

<a name="русский"></a>
## 🇷🇺 Русский

### 🌟 Описание
**Antigravity Remote Terminal Bot** — мощный Telegram-мост для управления терминалом и новейшим AI-агентом Google Antigravity (AGY).

### ✨ Возможности
- **🤖 Актуальные модели Google Antigravity:** `Gemini 3.8 Flash (High/Med/Low)`, `Gemini 3.7 Flash`, `Gemini 3.6 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet 4.6`, `Claude Opus 4.6`, `GPT-OSS 120B`.
- **⚡ Скорость рассуждений (Effort):** Выбор между `Low` (быстро/экономно), `Medium` (баланс) и `High` (глубокий анализ).
- **⏱️ Точный 5-часовой лимит (`/limit`):** Плавающее 5-часовое окно запросов, таймер восстановления слотов и подробная статистика.
- **📂 Интерактивные мультисессии (`/sessions`):** Детальные карточки управления каждой сессией.
- **📤 Передача файлов (`/get`):** Выгрузка файлов прямо в Telegram.

---

<div align="center">

Made with ❤️ for effortless remote AI programming with Google Antigravity.

</div>
