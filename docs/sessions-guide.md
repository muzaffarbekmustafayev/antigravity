# 📂 Multi-Session (Ko'p Sessiyali Boshqaruv) Qo'llanmasi

## 📌 Nima uchun Multi-Session?

Bitta loyihada ishlayotganda ko'pincha:
- Bir tomonda backend API ustida ishlash;
- Ikkinchi tomonda frontend yoki mobil ilova kodini o'zgartirish;
- Uchinchi tomonda esa server jurnallari yoki testlarni kuzatish talab etiladi.

**Antigravity Remote Terminal Bot** har bir vazifa uchun alohida, bir-biriga xalaqit bermaydigan mustaqil sessiyalarni taqdim etadi.

---

## 🗂️ Sessiyaning Tarkibi

Har bir sessiya quyidagi parametrlarga ega:
- **`id`**: Noyob sessiya identifikatori (masalan: `s1`, `s2`)
- **`name`**: Foydalanuvchi tomonidan berilgan nom (masalan: `Backend API`, `Telegram Bot`)
- **`cwd`**: Sessiyaning alohida ishchi jildi (har bir sessiya har xil papkada ishlashi mumkin)
- **`model`**: Sessiya uchun tanlangan AI model (masalan: `Gemini 3.8 Flash` yoki `Claude Sonnet`)
- **`effort`**: Sessiya ishlash tezligi (`low`, `medium`, `high`)
- **`history`**: Sessiyada bajarilgan so'nggi 50 ta buyruq tarixi
- **`proc`**: Agar ayni paytda terminal jarayoni ishlayotgan bo'lsa, uning child_process obyekti
- **`isNewConv`**: AGY suhbat konteksti (tozalash yoki davom ettirish)

---

## 📱 Interaktiv Sessiya Kartasi (Session Card)

`/sessions` buyrug'i orqali sessiyalar ro'yxatini ochib, istalgan sessiyani tanlasangiz, interaktiv boshqaruv kartasi ochiladi:

```
📌 Sessiya Tafsilotlari: Backend API
━━━━━━━━━━━━━━━━━━━━━━━━━━
🆔 ID: s1
📊 Holat: ⭐ Faol sessiya
📁 Ishchi jild: ~/projects/backend
🤖 Model: ⚡ Gemini 3.8 Flash
⚡ Tezlik (Effort): 🧠 High (Chuqur tahlil)
📝 Jami buyruqlar: 14 ta
⏱️ Yaratilgan: 20:30:15
━━━━━━━━━━━━━━━━━━━━━━━━━━
[⭐ Shu sessiyaga o'tish]
[🤖 Modelni o'zgartirish]  [⚡ Tezlikni o'zgartirish]
[📁 Papkani o'zgartirish]  [🔄 Suhbatni tozalash]
[✏️ Nomini o'zgartirish]   [📜 So'nggi buyruqlar]
[💾 O'zgarishlarni saqlash]
[❌ Sessiyani yopish]      [🔙 Barcha sessiyalar]
```

---

## ⌨️ Tezkor Buyruqlar

| Buyruq | Tavsif | Misol |
| :--- | :--- | :--- |
| `/sessions` | Barcha sessiyalar ro'yxati va markazi | `/sessions` |
| `/newsess <nom>` | Tezkor yangi sessiya ochish | `/newsess Mobil Ilova` |
| `/switch <id>` | Sessiyaga ID bo'yicha darhol o'tish | `/switch s2` |
| `/renamesess <nom>`| Faol sessiya nomini o'zgartirish | `/renamesess Yangi Nom` |
| `/resetsess` | Sessiya AI kontekstini tozalash (yangi suhbat) | `/resetsess` |
| `/save` | Sessiyadagi barcha o'zgarishlarni saqlash (Git commit) | `/save` |
| `/pwd` | Faol sessiyaning joriy papkasi | `/pwd` |
| `/ls` | Faol sessiya papkasidagi fayllar | `/ls` |
| `/history` | Sessiyadagi so'nggi 20 ta buyruq | `/history` |
| `/kill` | Shu sessiyada ishlayotgan jarayonni to'xtatish | `/kill` |

---

## 💾 O'zgarishlarni Doimiy Saqlash
Barcha sessiyalar avtomatik ravishda `data/sessions.json` faylida saqlanadi. Kompyuter yoki bot qayta ishga tushganda, barcha sessiyalar, ularning papkalari va sozlamalari tiklanadi.
