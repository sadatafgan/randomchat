// این سرویس‌ورکر عمداً هیچ‌چیزی را کش نمی‌کند.
// تنها دلیل وجودش این است که مرورگرها (به‌خصوص کروم روی اندروید) برای نمایش
// گزینه‌ی "نصب اپلیکیشن"، وجود یک سرویس‌ورکر با رویداد fetch را الزامی می‌دانند.
// اگر بعداً بخواهیم حالت آفلاین واقعی اضافه کنیم، اینجا باید Cache API اضافه شود.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // همیشه مستقیم از شبکه بگیر - هیچ کشی در کار نیست
  event.respondWith(fetch(event.request));
});
