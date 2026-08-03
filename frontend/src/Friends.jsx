import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function Friends({ session, onOpenChat, onlineIds = [], requestOnlineCheck, onCallFriend }) {
  const [subTab, setSubTab] = useState("list"); // list | requests
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [incoming, setIncoming] = useState([]);
  const [sent, setSent] = useState([]);
  const [friends, setFriends] = useState([]);
  const [message, setMessage] = useState("");

  const myId = session.user.id;

  async function loadAll() {
    // درخواست‌های ورودی که هنوز pending هستند
    const { data: reqs } = await supabase
      .from("friendships")
      .select("id, requester_id, profiles:requester_id(username, avatar_url)")
      .eq("addressee_id", myId)
      .eq("status", "pending");
    setIncoming(reqs || []);

    // درخواست‌هایی که خودم فرستادم و هنوز pending هستند
    const { data: sentReqs } = await supabase
      .from("friendships")
      .select("id, addressee_id, profiles:addressee_id(username, avatar_url)")
      .eq("requester_id", myId)
      .eq("status", "pending");
    setSent(sentReqs || []);

    // دوستی‌هایی که من فرستادم و قبول شدند
    const { data: fr1 } = await supabase
      .from("friendships")
      .select("id, addressee_id, profiles:addressee_id(username, avatar_url)")
      .eq("requester_id", myId)
      .eq("status", "accepted");

    // دوستی‌هایی که برای من فرستاده شد و قبول کردم
    const { data: fr2 } = await supabase
      .from("friendships")
      .select("id, requester_id, profiles:requester_id(username, avatar_url)")
      .eq("addressee_id", myId)
      .eq("status", "accepted");

    const list = [
      ...(fr1 || []).map((f) => ({
        friendshipId: f.id,
        id: f.addressee_id,
        username: f.profiles?.username,
        avatarUrl: f.profiles?.avatar_url,
      })),
      ...(fr2 || []).map((f) => ({
        friendshipId: f.id,
        id: f.requester_id,
        username: f.profiles?.username,
        avatarUrl: f.profiles?.avatar_url,
      })),
    ];
    setFriends(list);

    if (requestOnlineCheck && list.length > 0) {
      requestOnlineCheck(list.map((f) => f.id));
    }
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

  async function cancelSent(requestId) {
    await supabase.from("friendships").delete().eq("id", requestId);
    loadAll();
  }

  async function removeFriend(friendshipId) {
    if (!window.confirm("این دوست حذف شود؟")) return;
    await supabase.from("friendships").delete().eq("id", friendshipId);
    loadAll();
  }

  const pendingCount = incoming.length + sent.length;

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

      <div className="sub-tabs">
        <button className={subTab === "list" ? "active" : ""} onClick={() => setSubTab("list")}>
          دوستان ({friends.length})
        </button>
        <button className={subTab === "requests" ? "active" : ""} onClick={() => setSubTab("requests")}>
          درخواست‌ها {pendingCount > 0 && <span className="sub-tab-badge">{pendingCount}</span>}
        </button>
      </div>

      {subTab === "list" && (
        <div className="sub-tab-panel">
          {friends.length === 0 && <p className="hint">هنوز دوستی اضافه نکردی</p>}
          {friends.map((f) => {
            const isOnline = onlineIds.includes(f.id);
            return (
              <div key={f.friendshipId} className="friend-row">
                <div className="friend-row-clickable" onClick={() => onOpenChat(f)}>
                  {f.avatarUrl ? (
                    <img src={f.avatarUrl} alt="" className="mini-avatar" />
                  ) : (
                    <span className="mini-avatar-fallback">{(f.username || "?")[0]?.toUpperCase()}</span>
                  )}
                  <span className={`online-dot ${isOnline ? "online" : ""}`} />
                  <span>{f.username}</span>
                </div>
                <div className="friend-actions">
                  {isOnline && onCallFriend && (
                    <button className="call-btn" onClick={() => onCallFriend(f)}>
                      تماس
                    </button>
                  )}
                  <button
                    className="remove-friend-btn"
                    onClick={() => removeFriend(f.friendshipId)}
                    aria-label="حذف دوست"
                  >
                    ✕
                  </button>
                  <span className="chevron" onClick={() => onOpenChat(f)}>
                    ‹
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {subTab === "requests" && (
        <div className="sub-tab-panel">
          {pendingCount === 0 && <p className="hint">درخواست دوستی‌ای در جریان نیست</p>}

          {incoming.length > 0 && (
            <>
              <h3 className="section-title">دریافت‌شده</h3>
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

          {sent.length > 0 && (
            <>
              <h3 className="section-title">ارسال‌شده</h3>
              {sent.map((r) => (
                <div key={r.id} className="friend-row">
                  <span>{r.profiles?.username}</span>
                  <button className="reject-btn" onClick={() => cancelSent(r.id)}>
                    لغو
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
