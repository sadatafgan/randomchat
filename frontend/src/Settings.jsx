import { useState } from "react";
import { requestPermission } from "./lib/notifications";

export default function Settings({ canInstall, onInstall }) {
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);

  const [notifStatus, setNotifStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported"
  );

  async function handleRequestNotif() {
    const granted = await requestPermission();
    setNotifStatus(granted ? "granted" : "denied");
  }

  return (
    <div className="settings-screen">

      {/* بخش اعلان‌ها */}
      <div className="settings-section">
        <h3 className="settings-section-title">اعلان‌ها</h3>
        {notifStatus === "granted" ? (
          <p className="hint">✅ اعلان‌های مرورگر فعال هستند</p>
        ) : notifStatus === "denied" ? (
          <div className="notification-permission-box">
            <p>اعلان‌های مرورگر غیرفعال هستند. برای فعال کردن، باید از تنظیمات مرورگرت (🔒 کنار آدرس) دسترسی اعلان را دستی بدهی.</p>
          </div>
        ) : notifStatus === "unsupported" ? (
          <p className="hint">مرورگر شما اعلان را پشتیبانی نمی‌کند</p>
        ) : (
          <div className="notification-permission-box">
            <p>با فعال کردن اعلان، وقتی تب دیگری بازه و دوستی تماس گرفت یا پیام فرستاد، خبردار می‌شی.</p>
            <button onClick={handleRequestNotif}>فعال کردن اعلان‌ها</button>
          </div>
        )}
      </div>

      {/* بخش نصب اپ */}
      <div className="settings-section">
        <h3 className="settings-section-title">نصب اپلیکیشن</h3>
        {isStandalone ? (
          <p className="hint">✅ این اپ به‌صورت نصب‌شده در حال اجراست</p>
        ) : canInstall ? (
          <div className="notification-permission-box">
            <p>می‌تونی این اپ رو مثل یک اپلیکیشن واقعی روی گوشیت نصب کنی — بدون نیاز به مرورگر باز شه.</p>
            <button onClick={onInstall}>نصب اپلیکیشن</button>
          </div>
        ) : (
          <div className="notification-permission-box">
            <p>
              اندروید (Chrome): منوی ⋮ بالای مرورگر ← «Add to Home screen»
              <br /><br />
              آیفون (Safari): دکمه Share (□↑) ← «Add to Home Screen»
            </p>
          </div>
        )}
      </div>

      <p className="settings-note" style={{ marginTop: 12 }}>
        بقیه‌ی تنظیمات (زبان، حریم خصوصی) به‌زودی اضافه می‌شود 🚧
      </p>
    </div>
  );
}
