// notifications.js
// مدیریت اعلان‌های مرورگر (Web Notifications API)
// رایگان، بدون هیچ سرویس خارجی — فقط از API خود مرورگر استفاده می‌کند.
// اعلان فقط وقتی تب مرورگر پنهان باشد نشان داده می‌شود تا تجربه‌ی کاربر در تب
// فعال خراب نشود.

export async function requestPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

// فقط وقتی صفحه پنهان است اعلان می‌فرستد
export function notify(title, options = {}) {
  if (!canNotify()) return null;
  if (document.visibilityState !== "hidden") return null;

  const n = new Notification(title, {
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    ...options,
  });

  // بعد از ۶ ثانیه خودکار بسته می‌شود
  setTimeout(() => n.close(), 6000);

  // با کلیک روی اعلان، تب مرورگر فعال می‌شود
  n.onclick = () => {
    window.focus();
    n.close();
  };

  return n;
}
