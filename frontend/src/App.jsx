import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import Auth from "./Auth";
import Friends from "./Friends";
import FriendChat from "./FriendChat";
import RandomChat from "./RandomChat";

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tab, setTab] = useState("random"); // random | friends
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

  return (
    <div className="shell">
      <nav className="tab-bar">
        <button
          className={tab === "random" ? "active" : ""}
          onClick={() => {
            setTab("random");
            setOpenFriend(null);
          }}
        >
          چت رندوم
        </button>
        <button
          className={tab === "friends" ? "active" : ""}
          onClick={() => {
            setTab("friends");
            setOpenFriend(null);
          }}
        >
          دوستان
        </button>
        <button className="logout-btn" onClick={() => supabase.auth.signOut()}>
          خروج از اکانت
        </button>
      </nav>

      <div className="tab-content">
        {tab === "random" && <RandomChat />}
        {tab === "friends" && !openFriend && <Friends session={session} onOpenChat={setOpenFriend} />}
        {tab === "friends" && openFriend && (
          <FriendChat session={session} friend={openFriend} onBack={() => setOpenFriend(null)} />
        )}
      </div>
    </div>
  );
}
