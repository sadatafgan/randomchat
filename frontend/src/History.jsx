import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function formatWhen(iso) {
  const d = new Date(iso);
  return d.toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}

export default function History({ session, onAddFriend }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const myId = session.user.id;

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("call_history")
        .select("id, user_a, user_b, partner_username, started_at")
        .or(`user_a.eq.${myId},user_b.eq.${myId}`)
        .order("started_at", { ascending: false })
        .limit(50);
      setRows(data || []);
      setLoading(false);
    }
    load();
  }, [myId]);

  async function handleAdd(partnerId) {
    if (!partnerId) return;
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: myId, addressee_id: partnerId, status: "pending" });
    if (!error && onAddFriend) onAddFriend();
  }

  return (
    <div className="history-screen">
      {loading && <p className="hint">در حال بارگذاری...</p>}
      {!loading && rows.length === 0 && <p className="hint">هنوز هیچ چتی ثبت نشده</p>}

      {rows.map((r) => {
        const partnerId = r.user_a === myId ? r.user_b : r.user_a;
        return (
          <div key={r.id} className="history-row">
            <div className="history-avatar">{(r.partner_username || "?")[0]?.toUpperCase()}</div>
            <div className="history-info">
              <span className="history-name">{r.partner_username || "کاربر ناشناس"}</span>
              <span className="history-time">{formatWhen(r.started_at)}</span>
            </div>
            <button className="add-btn" onClick={() => handleAdd(partnerId)}>
              افزودن دوست
            </button>
          </div>
        );
      })}
    </div>
  );
}
