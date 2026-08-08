import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function formatWhen(iso) {
  return new Date(iso).toLocaleString("fa-IR", { dateStyle: "short", timeStyle: "short" });
}

export default function Admin() {
  const [subTab, setSubTab] = useState("reports"); // reports | users
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadReports() {
    const { data, error } = await supabase.rpc("admin_get_reports");
    if (!error) setReports(data || []);
  }

  async function loadUsers(search = null) {
    const { data, error } = await supabase.rpc("admin_list_users", { search });
    if (!error) setUsers(data || []);
  }

  useEffect(() => {
    setLoading(true);
    Promise.all([loadReports(), loadUsers()]).then(() => setLoading(false));
  }, []);

  async function toggleBan(user) {
    const nextBanned = !user.is_banned;
    await supabase.rpc("admin_set_ban", { target_id: user.id, banned: nextBanned });
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_banned: nextBanned } : u)));
  }

  function handleUserSearch(e) {
    e.preventDefault();
    loadUsers(userSearch.trim() || null);
  }

  // شمارش گزارش‌ها به‌ازای هر کاربر گزارش‌شده (برای برجسته کردن کاربرهای پرگزارش)
  const reportCounts = {};
  reports.forEach((r) => {
    reportCounts[r.reported_id] = (reportCounts[r.reported_id] || 0) + 1;
  });

  return (
    <div className="admin-screen">
      <div className="admin-badge">🔒 پنل ادمین — فقط برای تو قابل مشاهده است</div>

      <div className="sub-tabs">
        <button className={subTab === "reports" ? "active" : ""} onClick={() => setSubTab("reports")}>
          گزارش‌ها ({reports.length})
        </button>
        <button className={subTab === "users" ? "active" : ""} onClick={() => setSubTab("users")}>
          کاربران ({users.length})
        </button>
      </div>

      {loading && <p className="hint">در حال بارگذاری...</p>}

      {!loading && subTab === "reports" && (
        <div className="sub-tab-panel">
          {reports.length === 0 && <p className="hint">هیچ گزارشی ثبت نشده</p>}
          {reports.map((r) => (
            <div key={r.id} className="admin-row">
              <div className="admin-row-info">
                <span className="admin-row-title">
                  <strong>{r.reporter_username}</strong> گزارش داد <strong>{r.reported_username}</strong> را
                </span>
                <span className="admin-row-sub">
                  {formatWhen(r.created_at)} · مجموع گزارش این کاربر: {reportCounts[r.reported_id]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && subTab === "users" && (
        <div className="sub-tab-panel">
          <form onSubmit={handleUserSearch} className="friend-search">
            <input
              type="text"
              placeholder="جستجوی نام کاربری..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
            <button type="submit">جستجو</button>
          </form>

          {users.map((u) => (
            <div key={u.id} className="admin-row">
              <div className="admin-row-info">
                <span className="admin-row-title">
                  {u.username} {u.is_admin && "👑"}
                  {u.is_banned && <span className="admin-banned-tag">مسدود</span>}
                </span>
                <span className="admin-row-sub">
                  {u.email} · گزارش: {u.report_count} · عضویت: {formatWhen(u.created_at)}
                </span>
              </div>
              {!u.is_admin && (
                <button
                  className={u.is_banned ? "accept-btn" : "reject-btn"}
                  onClick={() => toggleBan(u)}
                >
                  {u.is_banned ? "رفع مسدودی" : "مسدود کردن"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
