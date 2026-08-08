import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "./lib/supabaseClient";
import { requestPermission, notify } from "./lib/notifications";
import Logo from "./Logo";
import Auth from "./Auth";
import Friends from "./Friends";
import FriendChat from "./FriendChat";
import RandomChat from "./RandomChat";
import Account from "./Account";
import Settings from "./Settings";
import History from "./History";
import Admin from "./Admin";
import FriendCall from "./FriendCall";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

function TabIcon({ id }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round", strokeLinejoin: "round" };
  if (id === "random")
    return (
      <svg {...common}>
        <rect x="3" y="6" width="13" height="12" rx="2.5" />
        <path d="M16 10.5l5-3v9l-5-3" />
      </svg>
    );
  if (id === "friends")
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M17 8.5a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z" />
        <path d="M15 14c2.8.3 5 2.5 5 6" />
      </svg>
    );
  if (id === "history")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    );
  if (id === "account")
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      </svg>
    );
  if (id === "settings")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 13a7.7 7.7 0 0 0 0-2l2-1.5-2-3.4-2.4.6a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.3 2.6a7.6 7.6 0 0 0-1.7 1l-2.4-.6-2 3.4L4.6 11a7.7 7.7 0 0 0 0 2l-2 1.5 2 3.4 2.4-.6c.5.4 1.1.8 1.7 1L9 21h6l.3-2.6c.6-.2 1.2-.6 1.7-1l2.4.6 2-3.4-2-1.5z" />
      </svg>
    );
  if (id === "admin")
    return (
      <svg {...common}>
        <rect x="5" y="11" width="14" height="9" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
    );
  return null;
}

const TABS = [
  { id: "random", label: "چت رندوم" },
  { id: "friends", label: "دوستان" },
  { id: "history", label: "تاریخچه" },
  { id: "account", label: "اکانت" },
  { id: "settings", label: "تنظیمات" },
];

export default function App() {
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [tab, setTab] = useState("random");
  const [openFriend, setOpenFriend] = useState(null);

  const [onlineIds, setOnlineIds] = useState([]);
  const [myUsername, setMyUsername] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null); // { fromSocketId, fromUserId, fromUsername }
  const [activeCall, setActiveCall] = useState(null); // { partnerId, initiator, partnerUsername }
  const [callStatusMsg, setCallStatusMsg] = useState("");

  const callSocketRef = useRef(null);

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

  useEffect(() => {
    if (!session?.user?.id) return;
    supabase
      .from("profiles")
      .select("username, is_admin")
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setMyUsername(data?.username || "");
        setIsAdmin(!!data?.is_admin);
      });
  }, [session?.user?.id]);

  // اتصال دائمی سبک برای وضعیت آنلاین و تماس با دوستان (جدا از سوکت چت رندوم)
  useEffect(() => {
    if (!session?.user?.id) return;

    // درخواست اجازه‌ی اعلان در اولین اتصال
    requestPermission();

    const socket = io(BACKEND_URL);
    callSocketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("register-presence", { userId: session.user.id });
    });

    socket.on("online-status", (ids) => setOnlineIds(ids));

    socket.on("incoming-call", (payload) => {
      setIncomingCall(payload);
      // اعلان مرورگر — فقط اگر تب پنهان باشد
      notify("📞 تماس ورودی", {
        body: `${payload.fromUsername || "یک دوست"} با شما تماس می‌گیرد`,
        tag: "incoming-call",
        requireInteraction: true, // تا کاربر رد یا قبول نکند، اعلان نمی‌رود
      });
    });

    socket.on("call-accepted", ({ partnerId, initiator }) => {
      setCallStatusMsg("");
      setIncomingCall(null);
      setActiveCall((prev) => ({
        partnerId,
        initiator,
        partnerUsername: prev?.partnerUsername || null,
      }));
    });

    socket.on("call-failed", ({ reason }) => {
      const map = {
        offline: "این دوست الان آنلاین نیست",
        busy: "این دوست الان در تماس دیگری است",
        rejected: "تماس رد شد",
        gone: "تماس‌گیرنده دیگر آنلاین نیست",
      };
      setCallStatusMsg(map[reason] || "تماس برقرار نشد");
      setActiveCall(null);
      setTimeout(() => setCallStatusMsg(""), 3000);
    });

    return () => socket.disconnect();
  }, [session?.user?.id]);

  useEffect(() => {
    function handler(e) {
      e.preventDefault();
      setInstallPromptEvent(e);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function triggerInstall() {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }

  function requestOnlineCheck(ids) {
    callSocketRef.current?.emit("check-online", ids);
  }

  function startCall(friend) {
    if (!callSocketRef.current) return;
    setCallStatusMsg(`در حال تماس با ${friend.username}...`);
    setActiveCall({ partnerUsername: friend.username, pending: true });
    callSocketRef.current.emit("call-friend", {
      targetUserId: friend.id,
      fromUserId: session.user.id,
      fromUsername: myUsername || session.user.email,
    });
  }

  function acceptIncomingCall() {
    if (!incomingCall) return;
    setActiveCall({ partnerUsername: incomingCall.fromUsername, pending: true });
    callSocketRef.current.emit("accept-call", { callerSocketId: incomingCall.fromSocketId });
  }

  function rejectIncomingCall() {
    if (!incomingCall) return;
    callSocketRef.current.emit("reject-call", { callerSocketId: incomingCall.fromSocketId });
    setIncomingCall(null);
  }

  function endCall() {
    setActiveCall(null);
  }

  if (loadingSession) {
    return (
      <div className="splash-screen">
        <div className="splash-logo">
          <div className="splash-rings">
            <span className="ring ring-1" />
            <span className="ring ring-2" />
            <span className="ring ring-3" />
          </div>
          <Logo size={46} />
        </div>
        <span className="splash-name">RandomChat</span>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  function goTo(tabId) {
    setTab(tabId);
    setOpenFriend(null);
  }

  // در حال تماس -> کل صفحه را تماس می‌گیرد، نوار پیمایش مخفی می‌شود
  if (activeCall && !activeCall.pending) {
    return (
      <div className="shell">
        <FriendCall
          socket={callSocketRef.current}
          partnerId={activeCall.partnerId}
          initiator={activeCall.initiator}
          partnerUsername={activeCall.partnerUsername}
          onEnd={endCall}
        />
      </div>
    );
  }

  return (
    <div className="shell">
      {callStatusMsg && <div className="toast call-toast">{callStatusMsg}</div>}

      {incomingCall && !activeCall && (
        <div className="incoming-call-modal">
          <div className="incoming-call-card">
            <div className="account-avatar">{(incomingCall.fromUsername || "?")[0]?.toUpperCase()}</div>
            <p>{incomingCall.fromUsername || "یک دوست"} در حال تماس است</p>
            <div className="incoming-call-actions">
              <button className="reject-btn big" onClick={rejectIncomingCall}>
                رد کردن
              </button>
              <button className="accept-btn big" onClick={acceptIncomingCall}>
                پاسخ
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCall?.pending && (
        <div className="incoming-call-modal">
          <div className="incoming-call-card">
            <div className="account-avatar">{(activeCall.partnerUsername || "?")[0]?.toUpperCase()}</div>
            <p>در حال تماس با {activeCall.partnerUsername}...</p>
            <button className="reject-btn big" onClick={() => setActiveCall(null)}>
              لغو
            </button>
          </div>
        </div>
      )}

      <div className="tab-content">
        <div className="tab-fade-wrapper" key={tab + (openFriend?.id || "")}>
          {tab === "random" && <RandomChat session={session} />}
          {tab === "friends" && !openFriend && (
            <Friends
              session={session}
              onOpenChat={setOpenFriend}
              onlineIds={onlineIds}
              requestOnlineCheck={requestOnlineCheck}
              onCallFriend={startCall}
            />
          )}
          {tab === "friends" && openFriend && (
            <FriendChat session={session} friend={openFriend} onBack={() => setOpenFriend(null)} />
          )}
          {tab === "history" && <History session={session} onAddFriend={() => goTo("friends")} />}
          {tab === "account" && <Account session={session} />}
          {tab === "settings" && <Settings canInstall={!!installPromptEvent} onInstall={triggerInstall} />}
          {tab === "admin" && isAdmin && <Admin />}
        </div>
      </div>

      <nav className="tab-bar bottom">
        {(isAdmin ? [...TABS, { id: "admin", label: "ادمین" }] : TABS).map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => goTo(t.id)}>
            <TabIcon id={t.id} />
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
