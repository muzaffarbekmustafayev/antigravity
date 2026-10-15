# 🏗️ Antigravity Bypass & Regional Unlocker — Arxitektura Qo'llanmasi

## 📌 Umumiy Ko'rinish

**Antigravity Bypass & Regional Unlocker** — bu Google Antigravity (AGY), Antigravity 2.0 va Antigravity IDE vositalarini geo-cheklovlardan to'liq ozod qiluvchi tizimdir.

Tizim Windows NRPT, SmartDNS va Binar bayt patchlash orqali mintaqaviy cheklovlarni aylanib o'tadi va SOTA VPN (yoki boshqa VPN) ulanishlari bilan parallel, to'qnashuvlarsiz ishlaydi.

---

## 🏛️ Tizim Arxitekturasi

```
 ┌────────────────────────────────────────────────────────┐
 │            Antigravity Bypass CLI (cli.js)             │
 └──────────────────────────┬─────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
 ┌──────────────────────┐        ┌──────────────────────┐
 │   Detector & Patch   │        │     Network & DNS    │
 │ (src/bypass/patch.js)│        │(src/bypass/dns-bypass)
 └──────────┬───────────┘        └──────────┬───────────┘
            │                               │
            ├─ ANTIGRAVITY IDE              ├─ VPN Auto-detection
            ├─ ANTIGRAVITY 2.0              ├─ Native VPN Tunnel Route
            ├─ ANTIGRAVITY CLI              └─ SmartDNS (VPN o'chiq bo'lsa)
            ├─ AGY BIN (.gemini)
            └─ VS Code Extensions
```

---

## ⚙️ Asosiy Modullar

### 1. `cli.js` (Interaktiv Boshqaruv Markazi)
- Kompyuterdagi barcha Antigravity o'rnatilmalarini aniqlaydi.
- "Sizda borlari" ro'yxatini 1 dan boshlab tartib bilan ko'rsatadi.
- Tanlangan raqam bo'yicha alohida yoki barchasini birvarakayiga patch qiladi.

### 2. `src/bypass/patch.js` (Binar va JS Patch Engine)
- Binar bayt darajasidagi moslashtirish: `ineligible` → `inexigible` va `https_proxy` → `AG_LS_PROXY`.
- IDE `main.js` geo-check funksiyalarini zararsizlantirish.
- Har bir fayl uchun xavfsiz atomik yozish va zaxira (`.ag_backup`) yaratish.

### 3. `src/bypass/dns-bypass.js` (SmartDNS & VPN Moslashtiruvchisi)
- **VPN Faol bo'lsa:** Hech qanday NRPT qoidalarini kiritmaydi va mahalliy adapterga bog'lanmaydi; trafikni VPN orqali to'g'ri o'tishini ta'minlaydi.
- **VPN Nofaol bo'lsa:** Mahalliy provayder blokirovkasini aylanib o'tish uchun SmartDNS va NRPT qoidalarini faollashtiradi.

### 4. `src/bypass/watchdog.js` (Avto-nazoratchi)
- Antigravity yangilanganida binar fayllarni kuzatadi va ularni avtomatik qayta patch qiladi.
