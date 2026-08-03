// textFilter.js
// یک فیلتر ساده‌ی کلمات نامناسب (فارسی/دری + انگلیسی).
// این یک لیست پایه است - می‌شود بعداً کلمات بیشتری اضافه کرد.
// رویکرد: به‌جای رد کردن کامل پیام، کلمه‌ی نامناسب را با ستاره جایگزین می‌کنیم
// تا هم امنیت رعایت شود و هم کاربر بی‌دلیل بلاک نشود.

const BAD_WORDS = [
  // فارسی/دری - نمونه‌های پایه (لیست کامل نیست، قابل گسترش است)
  "کیر",
  "کص",
  "کس",
  "جنده",
  "کونی",
  "لعنتی",
  "حرومزاده",
  "عوضی",
  // انگلیسی - نمونه‌های پایه
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
];

// ساخت یک regex واحد از همه‌ی کلمات (بدون حساسیت به بزرگ/کوچک بودن حروف انگلیسی)
const pattern = new RegExp(BAD_WORDS.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "gi");

export function censorText(text) {
  if (!text) return text;
  return text.replace(pattern, (match) => "*".repeat(match.length));
}

export function containsBadWord(text) {
  if (!text) return false;
  pattern.lastIndex = 0; // چون regex ما global است، باید قبل از هر test ریست شود
  return pattern.test(text);
}
