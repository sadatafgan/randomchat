import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Auth from "./Auth";
import Friends from "./Friends";
import FriendChat from "./FriendChat";
import RandomChat from "./RandomChat";
import Account from "./Account";
import Settings from "./Settings";

const TABS = [
  { id: "random", label: "چت رندوم" },
  { id: "friends", label: "دوستان" },
  { id: "account", label: "اکانت" },
  { id: "settings", label: "تنظیمات" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tab, setTab] = useState("random");
  const [openFriend, setOpenFriend] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loadingSession) return null;

  if (!session) {
    return <Auth />;
  }

  function goTo(tabId) {
    setTab(tabId);
    setOpenFriend(null);
  }

  return (
    <div className="shell">
      <nav className="tab-bar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => goTo(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="tab-content">
        {tab === "random" && <RandomChat />}
        {tab === "friends" && !openFriend && <Friends session={session} onOpenChat={setOpenFriend} />}
        {tab === "friends" && openFriend && (
          <FriendChat session={session} friend={openFriend} onBack={() => setOpenFriend(null)} />
        )}
        {tab === "account" && <Account session={session} />}
        {tab === "settings" && <Settings />}
      </div>
    </div>
  );
}
