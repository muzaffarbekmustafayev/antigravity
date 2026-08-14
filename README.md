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
**Antigravity Remote Terminal Bot** is a secure, multi-session Telegram bridge that connects your Telegram chat directly to your local computer's terminal and Google Antigravity (AGY) coding agent. It allows developers to supervise coding tasks, execute commands, switch AI reasoning models, monitor API usage limits, and send/receive files remotely.

### ✨ Key Features
- **🤖 Multi-Model AI Switching:** Switch seamlessly between top-tier models (`Gemini 3.7 Flash`, `Gemini 3.7 Pro`, `Gemini 3.6 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet 4.6`, `Claude Opus 4.6`, `GPT-OSS 120B`) with custom reasoning effort flags.
- **📂 Multi-Session Management:** Run multiple independent terminal/AGY sessions concurrently with isolated working directories and histories.
- **📊 Usage & Limit Tracker (`/limit`):** Visual progress bar and rate limit stats (RPM, RPD, TPM) for Google & Anthropic models.
- **📤 Telegram File Bridge (`/get` & Local API):** Download files from your machine directly to Telegram, or let AGY send generated files via local HTTP webhook.
- **🔒 Admin-Only Security:** Access restricted strictly to your `ADMIN_CHAT_ID`. All unauthorized users are immediately rejected.
- **🛑 Real-time Process Control:** Kill long-running or stuck processes anytime with inline buttons.

---

### 🚀 Quick Start & Installation

#### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or newer)
- [Antigravity CLI](https://antigravity.google) (`agy`) installed and configured in your PATH

#### 2. Setup Bot
1. Open [@BotFather](https://t.me/BotFather) in Telegram and create a new bot to get your `BOT_TOKEN`.
2. Get your numeric Telegram user ID from [@userinfobot](https://t.me/userinfobot) for `ADMIN_CHAT_ID`.

#### 3. Clone & Configure
```bash
# Clone the repository
git clone https://github.com/your-username/antigravity-remote-terminal.git
cd antigravity-remote-terminal

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
```

Edit `.env` with your actual credentials:
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
ADMIN_CHAT_ID=123456789
DEFAULT_CWD=C:\Users\username\Desktop\my-project
DEFAULT_MODEL=gemini-3.7-flash
LOCAL_API_PORT=7799
```

#### 4. Run the Bot
```bash
# Development with auto-reload
npm start

# Or directly with node
npm run dev
```

---

### 🎮 Available Commands

| Command | Description |
| :--- | :--- |
| `/start` | Launch bot, display system status, and show the main persistent menu |
| `/sessions` | View and manage active sessions (create new, switch, or close) |
| `/model` | Open the interactive AI Model selection keyboard |
| `/limit` | View estimated daily token limits, request usage, and session stats |
| `/setcwd <path>` | View or update default project root path |
| `/get <filepath>`| Download a file from the host machine to Telegram (up to 50MB) |
| `/pwd` | Print current working directory of active session |
| `/ls` | List directory contents of active session |
| `/history` | View the last 20 commands executed in the active session |
| `/kill` | Terminate the active child process in current session |
| `/sys` | Display host CPU, RAM, and OS diagnostics |
| `/help` | Show command cheat sheet |

---

<br/>

<a name="ozbekcha"></a>
## 🇺🇿 O'zbekcha

### 🌟 Umumiy Ma'lumot
**Antigravity Remote Terminal Bot** — bu Telegram orqali shaxsiy kompyuteringiz terminali va Google Antigravity (AGY) agentini masofadan xavfsiz boshqarish imkonini beruvchi tizimdir. Loyihalaringizni istalgan joydan turib nazorat qiling, buyruqlar bering, AI modellarini almashtiring va fayllarni qabul qiling.

### ✨ Asosiy Imkoniyatlar
- **🤖 Yangi AI Modellari:** `Gemini 3.7 Flash`, `Gemini 3.7 Pro`, `Gemini 3.6 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet 4.6`, `Claude Opus 4.6`, `GPT-OSS 120B` modellarini bitta tugma orqali almashtirish.
- **📂 Ko'p Sessiyali Boshqaruv:** Bir vaqtning o'zida bir nechta mustaqil sessiyalarni ochish, ularning papkalari va tarixlari alohida saqlanadi.
- **📊 Limit va Statistika (`/limit`):** Kunlik so'rovlar, taxminiy token sarfi va vizual progress bar (`[██████░░░░] 60%`).
- **📤 Fayl almashinuvi (`/get`):** Kompyuterdagi fayllarni Telegram orqali yuklab olish va AGY yaratgan fayllarni avtomatik qabul qilish.
- **🔒 Xavfsizlik:** Faqat `.env` da ko'rsatilgan `ADMIN_CHAT_ID` egasigina botdan foydalana oladi.
- **🛑 Jarayonlarni to'xtatish:** Jarayonni to'xtatish uchun inline tugma va `/kill` buyrug'i.

---

### 🚀 O'rnatish va Ishga Tushirish

#### 1. Talablar
- [Node.js](https://nodejs.org/) (v18 yoki undan yuqori)
- [Antigravity CLI](https://antigravity.google) (`agy`) kompyuterga o'rnatilgan bo'lishi kerak

#### 2. Telegram Bot Tayyorlash
1. [@BotFather](https://t.me/BotFather) orqali yangi bot yarating va `BOT_TOKEN` oling.
2. [@userinfobot](https://t.me/userinfobot) orqali o'zingizning Telegram ID raqamingizni (`ADMIN_CHAT_ID`) oling.

#### 3. O'rnatish
```bash
# Loyihani klonlash
git clone https://github.com/your-username/antigravity-remote-terminal.git
cd antigravity-remote-terminal

# Kerakli kutubxonalarni o'rnatish
npm install

# .env faylini yaratish
cp .env.example .env
```

`.env` faylini o'z ma'lumotlaringiz bilan to'ldiring:
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
ADMIN_CHAT_ID=123456789
DEFAULT_CWD=C:\Users\username\Desktop\loyiha
DEFAULT_MODEL=gemini-3.7-flash
LOCAL_API_PORT=7799
```

#### 4. Ishga Tushirish
```bash
# Nodemon bilan avtomatik qayta yuklanish rejimida:
npm start
```

---

### 🎮 Bot Buyruqlari

| Buyruq | Tavsif |
| :--- | :--- |
| `/start` | Botni ishga tushirish, tizim holati va asosiy menyu |
| `/sessions` | Mavjud sessiyalar ro'yxati (yangi ochish / almashtirish / yopish) |
| `/model` | AI modelini tanlash oynasi |
| `/limit` | Limitlar, tokenlar sarfi va statistika |
| `/setcwd <yo'l>` | Ishchi papka yo'lini ko'rish yoki yangilash |
| `/get <fayl>` | Kompyuterdan faylni Telegramga yuklab olish (50MB gacha) |
| `/pwd` | Faol sessiyaning joriy papkasi |
| `/ls` | Faol sessiya papkasidagi fayllar |
| `/history` | Sessiyada bajarilgan so'nggi 20 ta buyruq |
| `/kill` | Ishlayotgan jarayonni majburiy to'xtatish |
| `/sys` | Kompyuterning CPU, RAM va OS holati |
| `/help` | Qo'llanma |

---

<br/>

<a name="русский"></a>
## 🇷🇺 Русский

### 🌟 Описание
**Antigravity Remote Terminal Bot** — это надежный мост для удаленного управления локальным терминалом и AI-агентом Google Antigravity (AGY) через Telegram. Выполняйте задачи, переключайте модели рассуждений, следите за лимитами токенов и скачивайте файлы прямо из чата.

### ✨ Основные Возможности
- **🤖 Выбор AI Моделей:** Мгновенное переключение между `Gemini 3.7 Flash/Pro`, `Gemini 3.6 Flash`, `Gemini 3.1 Pro`, `Claude Sonnet/Opus 4.6`, `GPT-OSS 120B` с автоматической поддержкой параметра `--effort`.
- **📂 Мультисессионность:** Создание нескольких изолированных терминальных сессий с собственными рабочими каталогами и историей.
- **📊 Лимиты и Статистика (`/limit`):** Отслеживание дневных запросов (RPM, RPD, TPM) с визуальным индикатором прогресса.
- **📤 Передача файлов (`/get` & Local API):** Отправка файлов с компьютера в Telegram и автоматическая доставка артефактов через локальный вебхук.
- **🔒 Полная Безопасность:** Доступ строго ограничен вашим `ADMIN_CHAT_ID`. Запросы от других пользователей игнорируются.
- **🛑 Остановка процессов:** Моментальное завершение зависших процессов кнопкой или командой `/kill`.

---

### 🚀 Установка и Запуск

#### 1. Требования
- [Node.js](https://nodejs.org/) (v18 или новее)
- [Antigravity CLI](https://antigravity.google) (`agy`), настроенный в системном PATH

#### 2. Создание бота
1. В [@BotFather](https://t.me/BotFather) создайте нового бота и скопируйте `BOT_TOKEN`.
2. Узнайте свой Telegram ID в [@userinfobot](https://t.me/userinfobot) для параметра `ADMIN_CHAT_ID`.

#### 3. Клонирование и настройка
```bash
# Клонируйте репозиторий
git clone https://github.com/your-username/antigravity-remote-terminal.git
cd antigravity-remote-terminal

# Установите зависимости
npm install

# Создайте файл конфигурации
cp .env.example .env
```

Заполните `.env`:
```env
BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz123456789
ADMIN_CHAT_ID=123456789
DEFAULT_CWD=C:\Users\username\Desktop\my-project
DEFAULT_MODEL=gemini-3.7-flash
LOCAL_API_PORT=7799
```

#### 4. Запуск
```bash
# Запуск с авто-перезагрузкой при изменениях
npm start
```

---

### 🎮 Список Команд

| Команда | Описание |
| :--- | :--- |
| `/start` | Запуск, диагностика хоста и главное меню |
| `/sessions` | Список и переключение сессий |
| `/model` | Интерактивное меню выбора AI-модели |
| `/limit` | Статистика токенов и суточные лимиты |
| `/setcwd <путь>` | Просмотр или изменение рабочей директории |
| `/get <файл>` | Отправка файла с ПК в Telegram (до 50MB) |
| `/pwd` | Текущий каталог активной сессии |
| `/ls` | Содержимое текущей папки |
| `/history` | История последних 20 выполненных команд |
| `/kill` | Принудительная остановка активного процесса |
| `/sys` | Диагностика CPU, RAM и ОС |
| `/help` | Справка по всем командам |

---

<div align="center">

Made with ❤️ for effortless remote AI programming.

</div>
