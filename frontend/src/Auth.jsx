import { useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { containsBadWord } from "./lib/textFilter";

function translateAuthError(msg) {
  if (!msg) return "خطایی رخ داد";
  if (msg.includes("Invalid login credentials")) return "ایمیل یا رمز عبور اشتباه است";
  if (msg.includes("already registered") || msg.includes("already exists"))
    return "این ایمیل قبلاً ثبت شده";
  if (msg.includes("duplicate key")) return "این نام کاربری قبلاً گرفته شده";
  if (msg.includes("Password should be")) return "رمز عبور باید حداقل ۶ کاراکتر باشد";
  return msg;
}

export default function Auth() {
  const [mode, setMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    try {
      if (mode === "signup") {
        if (!username.trim()) {
          setError("یک نام کاربری انتخاب کن");
          setLoading(false);
          return;
        }
        if (containsBadWord(username)) {
          setError("این نام کاربری مناسب نیست، یک نام دیگر انتخاب کن");
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });
        if (signUpError) throw signUpError;

        const userId = data.user?.id;
        if (userId) {
          const { error: profileError } = await supabase
            .from("profiles")
            .insert({ id: userId, username: username.trim() });
          if (profileError) throw profileError;
        }

        if (!data.session) {
          setInfo("ثبت‌نام موفق بود. اگر تایید ایمیل فعال باشد، اول ایمیلت را تایید کن، بعد وارد شو.");
          setMode("login");
        }
      } else {
        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (loginError) throw loginError;
      }
    } catch (err) {
      setError(translateAuthError(err.message));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand auth-brand">
          <span className="brand-dot" />
          <span className="brand-name">RandomChat</span>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError("");
              setInfo("");
            }}
          >
            ورود
          </button>
          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setError("");
              setInfo("");
            }}
          >
            ثبت‌نام
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "signup" && (
            <input
              type="text"
              placeholder="نام کاربری (برای پیدا شدن توسط دوستان)"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="ایمیل"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="رمز عبور (حداقل ۶ کاراکتر)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />

          {error && <p className="auth-error">{error}</p>}
          {info && <p className="auth-info">{info}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "..." : mode === "login" ? "ورود" : "ساخت اکانت"}
          </button>
        </form>
      </div>
    </div>
  );
}
