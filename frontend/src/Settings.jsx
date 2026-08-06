import { useState } from "react";
import { requestPermission } from "./lib/notifications";
import Logo from "./Logo";

function AboutApp({ onBack }) {
  return (
    <div className="legal-screen">
      <div className="legal-header">
        <button onClick={onBack} className="back-btn">←</button>
        <span>درباره‌ی اپ</span>
      </div>
      <div className="legal-body">
        <div className="legal-logo">
          <Logo size={56} />
        </div>
        <h2 className="legal-title">RandomChat</h2>
        <p>
          RandomChat یک اپلیکیشن چت متنی و ویدیویی است که دو کار را با هم انجام می‌دهد:
          وصل شدن تصادفی به یک نفر ناشناس برای گفتگو، و ساختن یک لیست دوستان واقعی برای
          چت و تماس‌های بعدی.
        </p>
        <p>
          این اپ در حال توسعه‌ی مداوم است و مرتب فیچرهای جدید بهش اضافه می‌شود. اگر پیشنهاد
          یا مشکلی داشتی، از طریق گزینه‌ی گزارش در چت به ما اطلاع بده.
        </p>
        <p className="legal-version">نسخه‌ی اپ: 1.0.0</p>
      </div>
    </div>
  );
}

function TermsOfUse({ onBack }) {
  return (
    <div className="legal-screen">
      <div className="legal-header">
        <button onClick={onBack} className="back-btn">←</button>
        <span>قوانین استفاده</span>
      </div>
      <div className="legal-body">
        <h3>حداقل سن استفاده</h3>
        <p>استفاده از این اپ فقط برای افراد بالای ۱۸ سال مجاز است.</p>

        <h3>رفتار قابل‌قبول</h3>
        <ul>
          <li>هرگونه محتوای برهنه، جنسی، یا نامناسب در ویدیو یا چت ممنوع است.</li>
          <li>توهین، تهدید، آزار، یا رفتار تبعیض‌آمیز نسبت به دیگران مجاز نیست.</li>
          <li>تبلیغ خشونت، افراط‌گرایی، یا فعالیت‌های غیرقانونی ممنوع است.</li>
          <li>بدون رضایت، اطلاعات شخصی دیگران (شماره، آدرس و...) را منتشر نکن.</li>
        </ul>

        <h3>گزارش و مسدودسازی</h3>
        <p>
          اگر کاربری این قوانین را رعایت نکرد، از دکمه‌ی «گزارش تخلف» استفاده کن. بعد از
          دریافت چند گزارش، دسترسی آن اکانت به‌طور خودکار و موقت محدود می‌شود.
        </p>

        <h3>حریم خصوصی</h3>
        <p>
          تماس‌های ویدیویی مستقیم بین دو مرورگر برقرار می‌شوند (Peer-to-Peer) و روی سرور
          ذخیره نمی‌شوند. پیام‌های متنی چت دوستان برای نمایش تاریخچه ذخیره می‌شوند؛
          پیام‌های چت رندوم ذخیره نمی‌شوند.
        </p>

        <h3>مسئولیت محتوا</h3>
        <p>
          هر کاربر مسئول محتوایی است که در طول چت یا تماس به اشتراک می‌گذارد. استفاده از
          این اپ به معنای پذیرفتن این قوانین است.
        </p>
      </div>
    </div>
  );
}

export default function Settings({ canInstall, onInstall }) {
  const [legalView, setLegalView] = useState(null); // null | "about" | "terms"

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

  if (legalView === "about") return <AboutApp onBack={() => setLegalView(null)} />;
  if (legalView === "terms") return <TermsOfUse onBack={() => setLegalView(null)} />;

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

      {/* بخش اطلاعات و قوانین */}
      <div className="settings-section">
        <h3 className="settings-section-title">اطلاعات</h3>
        <div className="settings-link-list">
          <button className="settings-link-row" onClick={() => setLegalView("about")}>
            <span>درباره‌ی اپ</span>
            <span className="chevron">‹</span>
          </button>
          <button className="settings-link-row" onClick={() => setLegalView("terms")}>
            <span>قوانین استفاده</span>
            <span className="chevron">‹</span>
          </button>
        </div>
      </div>

      <p className="settings-note" style={{ marginTop: 4 }}>
        بقیه‌ی تنظیمات (زبان، حریم خصوصی پیشرفته) به‌زودی اضافه می‌شود 🚧
      </p>
    </div>
  );
}
