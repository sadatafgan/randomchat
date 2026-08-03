export default function Settings({ canInstall, onInstall }) {
  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone);

  return (
    <div className="settings-screen">
      {isStandalone ? (
        <p className="hint">✅ این اپ به‌صورت نصب‌شده در حال اجراست</p>
      ) : canInstall ? (
        <div className="install-box">
          <p className="hint">می‌تونی این اپ رو مثل یک اپلیکیشن واقعی روی گوشیت نصب کنی</p>
          <button className="auth-submit" onClick={onInstall}>
            نصب اپلیکیشن
          </button>
        </div>
      ) : (
        <div className="install-box">
          <p className="hint">برای نصب روی گوشی:</p>
          <p className="settings-note">
            اندروید (Chrome): منوی سه‌نقطه بالای مرورگر → «Add to Home screen» یا «Install app»
            <br />
            آیفون (Safari): دکمه‌ی Share (□↑) → «Add to Home Screen»
          </p>
        </div>
      )}

      <p className="settings-note" style={{ marginTop: 24 }}>
        بقیه‌ی تنظیمات (زبان، اعلان‌ها، حریم خصوصی) به‌زودی اضافه می‌شود 🚧
      </p>
    </div>
  );
}
