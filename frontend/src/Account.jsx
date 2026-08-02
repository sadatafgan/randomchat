import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function Account({ session }) {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", session.user.id)
        .maybeSingle();
      setUsername(data?.username || "");
      setLoading(false);
    }
    load();
  }, [session.user.id]);

  return (
    <div className="account-screen">
      <div className="account-avatar">{(username || session.user.email || "?")[0]?.toUpperCase()}</div>

      {!loading && <h2 className="account-username">{username || "بدون نام کاربری"}</h2>}
      <p className="account-email">{session.user.email}</p>

      <div className="account-section">
        <button className="danger-full-btn" onClick={() => supabase.auth.signOut()}>
          خروج از اکانت
        </button>
      </div>
    </div>
  );
}
