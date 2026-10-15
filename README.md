<div align="center">

# 🚀 Antigravity Bypass & Regional Unlocker

**Google Antigravity (AGY), Antigravity 2.0 va Antigravity IDE uchun mintaqaviy cheklovlarni olib tashlash, binar patch va aqlli tarmoq moslashtiruvchisi.**

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Google Antigravity](https://img.shields.io/badge/Antigravity-Unlocked-orange.svg)](https://antigravity.google)
[![VPN Friendly](https://img.shields.io/badge/VPN-SOTA%20Compatible-blue.svg)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

### 🌐 Select Language / Tilni tanlang / Выберите язык
[**🇺🇿 O'zbekcha**](#-ozbekcha) | [**🇺🇸 English**](#-english) | [**🇷🇺 Русский**](#-русский)

---

</div>

<a name="ozbekcha"></a>
## 🇺🇿 O'zbekcha

### 🌟 Umumiy Ma'lumot
**Antigravity Bypass & Regional Unlocker** — bu Google Antigravity (AGY), Antigravity 2.0 va Antigravity IDE vositalarini mintaqaviy cheklovlar (`User location is not supported`, `ineligible`, `geo-block`) bo'lgan hududlarda to'siqsiz ishlatish uchun yaratilgan kuchli yechimdir.

Dastur kompyuterdagi barcha mavjud o'rnatilmalarni avtomatik qidirib topadi, **"Sizda borlari"** ro'yxatini chiqaradi va xohlagan o'rnatilmani raqami bo'yicha alohida yoki barchasini birvarakayiga patch qilish imkonini beradi.

### ✨ Asosiy Imkoniyatlar
- **🔍 Avtomatik O'rnatilmalarni Qidirish (Discovery):**
  - `ANTIGRAVITY IDE` (`main.js` + `language_server_windows_x64.exe`)
  - `ANTIGRAVITY 2.0` (`language_server.exe`)
  - `ANTIGRAVITY CLI` (`agy.exe`)
  - `AGY BIN (.gemini)` (`agy.exe`)
  - `ANTIGRAVITY VS CODE EXTENSION` (kengaytmalar)
- **🔢 1 dan Boshlanuvchi "Sizda borlari" Ro'yxati:**
  - Kompyuterda topilgan har bir o'rnatilma raqamlanadi (1, 2, 3...)
  - Aniq holat: Target fayl yo'li, patch holati (`[PATCHED ✓]` / `[NOT PATCHED ✗]`), fayl hajmi va versiyasi ko'rsatiladi.
- **⚡ Tanlov Asosida Patch Qilish:**
  - Istalgan o'rnatilma raqamini kiritib, faqat shuning o'zini patch qilish.
  - Yoki `[A]` bosib barchasini birdaniga patch qilish.
- **🛡️ VPN Bilan Mukammal Hamohanglik (SOTA VPN va boshqalar):**
  - VPN yoqilgan bo'lsa, tarmoq avtomatik aniqlanadi va provayderga majburiy bog'lanishlar olib tashlanadi.
  - VPN o'chiq bo'lsa, xavfsiz SmartDNS bypass marshruti ishga tushadi.
- **↩️ Asl Holatiga Qaytarish (Restore / Unpatch):**
  - Barcha o'zgartirishlarni istalgan paytda bir tugma bilan bekor qilish va zaxira nusxalarini tiklash.
- **🛡️ Watchdog (Avto-nazorat):**
  - Google Antigravity avtomatik yangilanganida, fon rejimida uni darhol qayta patch qilish.

---

### 🚀 O'rnatish va Ishga Tushirish

#### 1. Talablar
- [Node.js](https://nodejs.org/) (v18 yoki undan yuqori)
- Windows 10 / 11

#### 2. O'rnatish
```bash
git clone https://github.com/muzaffarbekmustafayev/antigravity.git
cd antigravity
npm install
```

#### 3. Ishga Tushirish
```bash
npm start
```
Ishga tushirilganda tizim avtomatik skanerlash o'tkazadi va quyidagi qulay menyuni ko'rsatadi:

```text
] Searching for installations...
  ─ ANTIGRAVITY IDE ───────────────────────────────
      Target:  C:\Users\...\Antigravity IDE\resources\app\out\main.js
      Status:  found
      Patch:   already patched
      Version: 2.5.5
      Size:    14.3 MB

  ─ ANTIGRAVITY 2.0 ───────────────────────────────
      Target:  C:\Users\...\antigravity\resources\bin\language_server.exe
      Status:  found
      Patch:   already patched
      Version: 2.23.1
      Size:    161.3 MB

  ─ ANTIGRAVITY CLI ───────────────────────────────
      Target:  C:\Users\...\AppData\Local\agy\bin\agy.exe
      Status:  found
      Patch:   already patched
      Version: 1.3.5
      Size:    184.9 MB

  ─ AGY BIN (.gemini) ─────────────────────────────
      Target:  C:\Users\...\.gemini\bin\agy.exe
      Status:  found
      Patch:   already patched
      Version: 1.3.3
      Size:    184.2 MB

  ─ ANTIGRAVITY VS CODE EXTENSION ─────────────────
      Target:  Not found
      Status:  not found

════════════════════════════════════════════════════════════
📦 SIZDA BORLARI (Mavjud o'rnatilmalar):
════════════════════════════════════════════════════════════

  [1] ANTIGRAVITY IDE  [PATCHED ✓]
  [2] ANTIGRAVITY 2.0  [PATCHED ✓]
  [3] ANTIGRAVITY CLI  [PATCHED ✓]
  [4] AGY BIN (.gemini)  [PATCHED ✓]

────────────────────────────────────────────────────────────
⚡ Buyruqlar:
  [1 - 4]  Tanlangan o'rnatilmani patch qilish
  [A]      BARCHASINI birvarakayiga patch qilish (Tavsiya etiladi)
  [R]      Asliga qaytarish (Restore / Unpatch)
  [S]      Status & Diagnostika (Tarmoq, DNS, NRPT)
  [W]      Watchdog avto-patch (fon rejimida)
  [Q]      Chiqish
────────────────────────────────────────────────────────────
Tanlovingizni kiriting [1-4, A, R, S, W, Q]: 
```

---

### 🛠️ Qo'shimcha Buyruqlar

| Buyruq | Vazifasi |
| :--- | :--- |
| `npm start` | Interaktiv boshqaruv menyusini ochish |
| `npm run patch` | Barcha o'rnatilmalarni to'g'ridan-to'g'ri patch qilish |
| `npm run status` | Tarmoq, VPN va fayllar holatini tekshirish |
| `npm run restore` | Barcha patchlarni bekor qilish va asl nusxani tiklash |
| `npm run clean:hosts` | Windows NRPT va hosts qoidalarini tozalash |

---

<a name="english"></a>
## 🇺🇸 English

### 🌟 Overview
**Antigravity Bypass & Regional Unlocker** is a dedicated tool for bypassing geographic restrictions (`User location is not supported`, `ineligible`) across Google Antigravity (AGY), Antigravity 2.0, and Antigravity IDE.

It automatically discovers all installations on your system, displays a clean numbered list starting from 1 ("Available on your machine"), and allows you to selectively patch individual targets or unlock all of them at once.

### ✨ Features
- **Automatic Target Discovery:** Detects IDE, Antigravity 2.0, CLI, and extensions.
- **Numbered Selection (1 to N):** Choose any specific installation to patch or revert.
- **VPN Compatible (SOTA VPN):** Automatically respects VPN routes without interfering or leaking physical ISP traffic.
- **Instant Restore:** Easily revert any or all binaries to original backups.
- **Watchdog Mode:** Keeps binaries patched even across background Google updates.

---

<a name="русский"></a>
## 🇷🇺 Русский

### 🌟 Описание
**Antigravity Bypass & Regional Unlocker** — инструмент для обхода региональных ограничений (`User location is not supported`, `ineligible`) для Google Antigravity (AGY), Antigravity 2.0 и Antigravity IDE.

Автоматически находит все установленные версии на компьютере, выводит пронумерованный список от 1 («То, что у вас есть») и позволяет пропатчить как конкретную установку, так и все сразу.

### ✨ Возможности
- **Автоматический поиск:** Сканирует Antigravity IDE, Antigravity 2.0, CLI (`agy.exe`) и плагины.
- **Выбор по номеру [1 - N]:** Патчинг выбранного компонента или всех сразу `[A]`.
- **Полная совместимость с VPN (SOTA VPN):** Автоматически использует туннель VPN без конфликтов NRPT.
- **Откат к оригиналу [R]:** Восстановление оригинальных файлов из резервных копий в один клик.

---

<div align="center">
Antigravity Bypass & Unlocker • Built for uninterrupted AI developer workflows.
</div>
