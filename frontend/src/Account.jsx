import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

const GENDER_OPTIONS = [
  { id: "unspecified", label: "نامشخص" },
  { id: "male", label: "مرد" },
  { id: "female", label: "زن" },
];

export default function Account({ session }) {
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("unspecified");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("username, gender")
        .eq("id", session.user.id)
        .maybeSingle();
      setUsername(data?.username || "");
      setGender(data?.gender || "unspecified");
      setLoading(false);
    }
    load();
  }, [session.user.id]);

  async function handleGenderChange(g) {
    setGender(g);
    setSaving(true);
    await supabase.from("profiles").update({ gender: g }).eq("id", session.user.id);
    setSaving(false);
  }

  return (
    <div className="account-screen">
      <div className="account-avatar">{(username || session.user.email || "?")[0]?.toUpperCase()}</div>

      {!loading && <h2 className="account-username">{username || "بدون نام کاربری"}</h2>}
      <p className="account-email">{session.user.email}</p>

      <div className="account-section">
        <p className="section-title" style={{ textAlign: "right" }}>
          جنسیت من {saving && "(در حال ذخیره...)"}
        </p>
        <div className="gender-selector">
          {GENDER_OPTIONS.map((g) => (
            <button
              key={g.id}
              className={gender === g.id ? "active" : ""}
              onClick={() => handleGenderChange(g.id)}
            >
              {g.label}
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
