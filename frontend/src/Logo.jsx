// لوگوی رسمی اپ - یک حباب چت با گرادیان بنفش به فیروزه‌ای و نقطه‌ی سیگنال وسطش.
// به‌صورت SVG است تا در هر اندازه‌ای (هدر کوچک، اسپلش بزرگ) کاملاً تیز بماند.
export default function Logo({ size = 32, rounded = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#2dd4bf" />
        </linearGradient>
      </defs>
      {rounded && <rect x="0" y="0" width="100" height="100" rx="24" fill="url(#logoGrad)" />}
      <rect x="21" y="18" width="58" height="53" rx="17" fill="white" />
      <polygon points="27,71 41,71 25,86" fill="white" />
      <circle cx="50" cy="44.5" r="8" fill="#8b5cf6" />
    </svg>
  );
}
