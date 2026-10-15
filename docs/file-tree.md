# 📁 Antigravity Bypass Loyihasi Fayllar Daraxti

```
antigravity/
├── .env.example                  # Namuna konfiguratsiya fayli
├── .gitignore                    # Git e'tiborsiz qoldiradigan fayllar
├── README.md                     # To'liq ko'p tilli qo'llanma (UZ, EN, RU)
├── package.json                  # Loyiha ma'lumotlari va skriptlar
├── metadata.json                 # Loyiha tavsifi
├── cli.js                        # Asosiy interaktiv CLI vositasi (npm start)
├── patcher.js                    # Tezkor binar va IDE patcher skripti
├── clean.js                      # Kesh va vaqtinchalik fayllarni tozalovchi
├── clean-hosts.bat               # Windows NRPT va hosts faylini tozalash skripti
├── start.js                      # Ishga tushiruvchi yordamchi skript
├── docs/                         # Qo'shimcha hujjatlar
│   ├── architecture.md           # Tizim arxitekturasi va ishlash prinsipi
│   └── file-tree.md              # Ushbu fayllar tuzilmasi qo'llanmasi
└── src/
    ├── config.js                 # Asosiy konfiguratsiya parametrlari
    ├── network.js                # IP va VPN holatini avtomatik tekshiruvchi
    ├── utils.js                  # Umumiy yordamchi funksiyalar
    └── bypass/
        ├── index.js              # Bypass moduli umumiy interfeysi
        ├── patch.js              # Binar, IDE va o'rnatilmalarni aniqlash drayveri
        ├── dns-bypass.js         # SmartDNS va Windows NRPT marshrutlash moduli
        └── watchdog.js           # Fon rejimida yangilanishlarni kuzatuvchi
```
