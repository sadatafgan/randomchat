import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./App.css";

// اگر کاربر از طریق لینک دعوت وارد شده (?ref=USERNAME)، کد رو موقتاً ذخیره کن
// تا موقع ثبت‌نام بتونیم بفهمیم چه کسی این کاربر رو دعوت کرده
const params = new URLSearchParams(window.location.search);
const refCode = params.get("ref");
if (refCode) {
  sessionStorage.setItem("referral_code", refCode);
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ثبت سرویس‌ورکر - فقط برای فعال شدن قابلیت "نصب اپلیکیشن" روی موبایل
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.warn("Service worker registration failed:", err);
    });
  });
}
