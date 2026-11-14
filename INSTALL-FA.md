# راه‌اندازی README پروفایل TECHCODE

این بسته برای مخزن پروفایل `techcodeco/techcodeco` آماده شده است.

## محتویات

- `README.md`: نسخه‌ی به‌روزشده‌ی پروفایل؛ بدون بخش معرفی Golden Duel.
- `scripts/generate-language-stats.mjs`: دریافت زبان‌های مخزن‌های عمومی و ساخت نمودار SVG.
- `.github/workflows/update-language-stats.yml`: اجرای خودکار و به‌روزرسانی نمودار.
- `assets/language-stats.svg`: تصویر اولیه؛ بعد از اجرای Workflow با آمار واقعی جایگزین می‌شود.

## نصب

1. مخزن `https://github.com/techcodeco/techcodeco` را باز کن.
2. فایل `README.md` را با فایل همین بسته جایگزین کن.
3. پوشه‌ها و فایل‌های `.github/workflows`، `scripts` و `assets` را نیز با همین ساختار در ریشه‌ی مخزن بارگذاری کن.
4. تغییرات را روی شاخه‌ی پیش‌فرض مخزن Commit کن.
5. در GitHub به مسیر **Actions → Update GitHub language statistics** برو و در صورت نیاز **Run workflow** را اجرا کن.
6. بعد از اجرای موفق، فایل `assets/language-stats.svg` با آمار واقعی جایگزین می‌شود. سپس README همان تصویر محلی را نمایش می‌دهد.

## مجوز نوشتن GitHub Actions

در مخزن به مسیر **Settings → Actions → General → Workflow permissions** برو و مطمئن شو گزینه‌ی **Read and write permissions** فعال است. Workflow برای به‌روزرسانی SVG باید بتواند در مخزن Commit کند.

آمار به‌صورت خودکار روزانه به‌روزرسانی می‌شود. این تنظیم به Personal Access Token جداگانه نیاز ندارد و از `GITHUB_TOKEN` خود GitHub Actions استفاده می‌کند.

**محدوده‌ی آمار:** مخزن‌های عمومی‌ای که مالکشان `techcodeco` است؛ مخزن‌های Fork شده حذف می‌شوند. مخزن‌های خصوصی در این نسخه لحاظ نمی‌شوند.
