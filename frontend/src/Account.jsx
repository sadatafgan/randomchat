import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const GENDER_OPTIONS = [
  { id: "unspecified", label: "نامشخص" },
  { id: "male", label: "مرد" },
  { id: "female", label: "زن" },
];

const COUNTRY_OPTIONS = [
  { id: "AF", label: "افغانستان" },
  { id: "IR", label: "ایران" },
  { id: "other", label: "سایر کشورها" },
];

const AGE_OPTIONS = [
  { id: "18-24", label: "۱۸-۲۴" },
  { id: "25-34", label: "۲۵-۳۴" },
  { id: "35-44", label: "۳۵-۴۴" },
  { id: "45+", label: "۴۵+" },
];

export default function Account({ session }) {
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("unspecified");
  const [country, setCountry] = useState(null);
  const [ageRange, setAgeRange] = useState(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.user.id]);

  async function load() {
    const { data } = await supabase
      .from("profiles")
      .select("username, gender, country, age_range, avatar_url")
      .eq("id", session.user.id)
      .maybeSingle();
    setUsername(data?.username || "");
    setGender(data?.gender || "unspecified");
    setCountry(data?.country || null);
    setAgeRange(data?.age_range || null);
    setAvatarUrl(data?.avatar_url || null);
    setLoading(false);
  }

  async function updateField(field, value) {
    await supabase.from("profiles").update({ [field]: value }).eq("id", session.user.id);
  }

  async function handleAvatarPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${session.user.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      setUploading(false);
      alert("خطا در آپلود عکس: " + uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = data.publicUrl + `?t=${Date.now()}`; // جلوگیری از کش شدن عکس قدیمی
    await updateField("avatar_url", publicUrl);
    setAvatarUrl(publicUrl);
    setUploading(false);
  }

  return (
    <div className="account-screen">
      <button className="avatar-upload-btn" onClick={() => fileInputRef.current?.click()}>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="account-avatar-img" />
        ) : (
          <div className="account-avatar">{(username || session.user.email || "?")[0]?.toUpperCase()}</div>
        )}
        <span className="avatar-edit-badge">{uploading ? "..." : "✎"}</span>
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleAvatarPick}
      />

      {!loading && <h2 className="account-username">{username || "بدون نام کاربری"}</h2>}
      <p className="account-email">{session.user.email}</p>

      <div className="account-section">
        <p className="section-title" style={{ textAlign: "right" }}>
          جنسیت من
        </p>
        <div className="gender-selector">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.id}
              className={gender === g.id ? "active" : ""}
              onClick={() => {
                setGender(g.id);
                updateField("gender", g.id);
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="account-section">
        <p className="section-title" style={{ textAlign: "right" }}>
          کشور من
        </p>
        <div className="gender-selector">
          {COUNTRY_OPTIONS.map((c) => (
            <button
              key={c.id}
              className={country === c.id ? "active" : ""}
              onClick={() => {
                setCountry(c.id);
                updateField("country", c.id);
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <div className="account-section">
        <p className="section-title" style={{ textAlign: "right" }}>
          بازه‌ی سنی من
        </p>
        <div className="gender-selector wrap">
          {AGE_OPTIONS.map((a) => (
            <button
              key={a.id}
              className={ageRange === a.id ? "active" : ""}
              onClick={() => {
                setAgeRange(a.id);
                updateField("age_range", a.id);
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="account-section">
        <button className="danger-full-btn" onClick={() => supabase.auth.signOut()}>
          خروج از اکانت
        </button>
      </div>
    </div>
  );
}
