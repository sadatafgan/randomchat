import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function Friends({ session, onOpenChat }) {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [friends, setFriends] = useState([]);
  const [message, setMessage] = useState("");

  const myId = session.user.id;

  async function loadAll() {
    // درخواست‌های ورودی که هنوز pending هستند
    const { data: reqs } = await supabase
      .from("friendships")
      .select("id, requester_id, profiles:requester_id(username)")
      .eq("addressee_id", myId)
      .eq("status", "pending");
    setIncoming(reqs || []);

    // دوستی‌هایی که من فرستادم و قبول شدند
    const { data: fr1 } = await supabase
      .from("friendships")
      .select("id, addressee_id, profiles:addressee_id(username)")
      .eq("requester_id", myId)
      .eq("status", "accepted");

    // دوستی‌هایی که برای من فرستاده شد و قبول کردم
    const { data: fr2 } = await supabase
      .from("friendships")
      .select("id, requester_id, profiles:requester_id(username)")
      .eq("addressee_id", myId)
      .eq("status", "accepted");

    const list = [
      ...(fr1 || []).map((f) => ({
        friendshipId: f.id,
        id: f.addressee_id,
        username: f.profiles?.username,
      })),
      ...(fr2 || []).map((f) => ({
        friendshipId: f.id,
        id: f.requester_id,
        username: f.profiles?.username,
      })),
    ];
    setFriends(list);
  }

  useEffect(() => {
    loadAll();

    // هر تغییری در جدول friendships (درخواست جدید، قبول شدن و...) لیست را رفرش کن
    const channel = supabase
      .channel("friendships-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, loadAll)
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    setMessage("");
    setSearchResult(null);
    if (!query.trim()) return;

    setSearching(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", `%${query.trim()}%`)
      .neq("id", myId)
      .limit(1)
      .maybeSingle();
    setSearching(false);

    if (error || !data) {
      setMessage("کاربری با این نام پیدا نشد");
      return;
    }
    setSearchResult(data);
  }

  async function sendRequest(targetId) {
    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: myId, addressee_id: targetId, status: "pending" });

    if (error) {
      setMessage(error.message.includes("duplicate") ? "قبلاً درخواست فرستادی" : "خطا در ارسال درخواست");
    } else {
      setMessage("درخواست دوستی فرستاده شد");
      setSearchResult(null);
      setQuery("");
    }
  }

  async function respond(requestId, accept) {
    if (accept) {
      await supabase.from("friendships").update({ status: "accepted" }).eq("id", requestId);
    } else {
      await supabase.from("friendships").delete().eq("id", requestId);
    }
    loadAll();
  }

  return (
    <div className="friends-screen">
      <form onSubmit={handleSearch} className="friend-search">
        <input
          type="text"
          placeholder="نام کاربری دقیق دوستت را جستجو کن"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" disabled={searching}>
          جستجو
        </button>
      </form>

      {message && <p className="friend-message">{message}</p>}

      {searchResult && (
        <div className="friend-row">
          <span>{searchResult.username}</span>
          <button className="add-btn" onClick={() => sendRequest(searchResult.id)}>
            افزودن دوست
          </button>
        </div>
      )}

      {incoming.length > 0 && (
        <>
          <h3 className="section-title">درخواست‌های دوستی</h3>
          {incoming.map((r) => (
            <div key={r.id} className="friend-row">
              <span>{r.profiles?.username}</span>
              <div className="friend-actions">
                <button className="accept-btn" onClick={() => respond(r.id, true)}>
                  قبول
                </button>
                <button className="reject-btn" onClick={() => respond(r.id, false)}>
                  رد
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      <h3 className="section-title">دوستان ({friends.length})</h3>
      {friends.length === 0 && <p className="hint">هنوز دوستی اضافه نکردی</p>}
      {friends.map((f) => (
        <div key={f.friendshipId} className="friend-row clickable" onClick={() => onOpenChat(f)}>
          <span>{f.username}</span>
          <span className="chevron">‹</span>
        </div>
      ))}
    </div>
  );
}
