import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { supabase } from "./lib/supabaseClient";
import { censorText } from "./lib/textFilter";
import Logo from "./Logo";

// آدرس سرور بک‌اند
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// سرورهای STUN و TURN
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    {
      urls: "turn:free.expressturn.com:3478",
      username: "000000002100944551",
      credential: "qGrDOtBUyMefhZSGfAN4SZoG4rM=",
    },
    {
      urls: "turn:free.expressturn.com:3478?transport=tcp",
      username: "000000002100944551",
      credential: "qGrDOtBUyMefhZSGfAN4SZoG4rM=",
    },
  ],
};

const STATUS = {
  CONNECTING: "connecting",
  WAITING: "waiting",
  CHATTING: "chatting",
  PARTNER_LEFT: "partner_left",
  MEDIA_ERROR: "media_error",
  EXITED: "exited",
  SUSPENDED: "suspended",
};

// فیلترهای زیبایی زنده - این‌ها روی ترافیک ارسالی هم اعمال می‌شوند (نه فقط پیش‌نمایش خودت)
const FILTERS = [
  { id: "natural", label: "طبیعی", css: "none" },
  { id: "vivid", label: "واضح", css: "saturate(1.45) contrast(1.12) brightness(1.06)" },
  { id: "warm", label: "گرم", css: "saturate(1.2) sepia(0.15) brightness(1.05) contrast(1.05)" },
  { id: "cool", label: "سرد", css: "saturate(1.15) hue-rotate(-8deg) brightness(1.03) contrast(1.05)" },
  { id: "mono", label: "مونو", css: "grayscale(1) contrast(1.15)" },
];

const GENDER_LABEL = { all: "جنسیت: همه", male: "جنسیت: مرد", female: "جنسیت: زن" };
const COUNTRY_LABEL = { all: "منطقه: همه", AF: "افغانستان", IR: "ایران", other: "سایر کشورها" };
const AGE_LABEL = {
  all: "سن: همه",
  "18-24": "۱۸-۲۴",
  "25-34": "۲۵-۳۴",
  "35-44": "۳۵-۴۴",
  "45+": "۴۵+",
};
function IconMic() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4M9 21h6" />
    </svg>
  );
}
function IconMicOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l18 18" />
      <path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-.29 1.29M15 14.5A3 3 0 0 1 9 12v-1" />
      <path d="M5 10a7 7 0 0 0 10.5 6.06M19 10a7 7 0 0 1-.34 2.17" />
      <path d="M12 17v4M9 21h6" />
    </svg>
  );
}
function IconCam() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="14" height="12" rx="2.5" />
      <path d="M16 10l6-3.2v10.4l-6-3.2" />
    </svg>
  );
}
function IconCamOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M16 10l6-3.2v10.4l-6-3.2" />
      <path d="M14.5 6H4.5A2.5 2.5 0 0 0 2 8.5v7A2.5 2.5 0 0 0 4.5 18h6" />
    </svg>
  );
}
function IconNext() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 5v14l9-7z" />
      <path d="M15 5v14" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3 11.5L20.5 4l-6 17-3.8-6.7L3 11.5z" />
    </svg>
  );
}
function IconMenu() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}
function IconFlag() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v18" />
      <path d="M5 4h11l-2 4 2 4H5" />
    </svg>
  );
}
function IconBlock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.5 5.5l13 13" />
    </svg>
  );
}
function IconUserPlus() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M18 8v6M15 11h6" />
    </svg>
  );
}
function IconExit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
function IconPalette() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.9.7-1.5 1.5-1.5H16a4 4 0 0 0 4-4c0-5.5-4-10-8-10z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="11" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M4 6h10M18 6h2M4 12h2M8 12h12M4 18h14M20 18h0" />
      <circle cx="16" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

// ---------- میله‌های سیگنال ----------
function SignalMeter({ status }) {
  const active = status === STATUS.CHATTING;
  const searching = status === STATUS.WAITING || status === STATUS.CONNECTING;
  return (
    <div className={`signal-meter ${active ? "locked" : ""} ${searching ? "scanning" : ""}`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="signal-bar" style={{ "--i": i }} />
      ))}
    </div>
  );
}

function RandomChat({ session }) {
  const [status, setStatus] = useState(STATUS.CONNECTING);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterPickerOpen, setFilterPickerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("natural");
  const [toast, setToast] = useState("");
  const [wantGender, setWantGender] = useState("all"); // فیلتر جنسیت: all | male | female
  const [wantCountry, setWantCountry] = useState("all");
  const [wantAgeRange, setWantAgeRange] = useState("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const wantCountryRef = useRef("all");
  const wantAgeRangeRef = useRef("all");

  const myProfileRef = useRef({ userId: null, username: null, gender: "unspecified" });
  const partnerInfoRef = useRef({ userId: null, username: null });
  const historyLoggedRef = useRef(false);
  const wantGenderRef = useRef("all");
  const sendFindPartnerRef = useRef(() => {});

  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const rawStreamRef = useRef(null); // استریم خام دوربین (صدا + تصویر پردازش‌نشده)
  const sendStreamRef = useRef(null); // استریمی که واقعاً به partner فرستاده می‌شود (صدا خام + ویدیوی فیلترشده)
  const rawVideoRef = useRef(null); // ویدیوی مخفی - فقط منبع تصویر برای canvas
  const canvasRef = useRef(null); // بوم نمایشی - همان چیزی که خودت و partner می‌بینید
  const localVideoRef = useRef(null); // پیش‌نمایش محلی (نمایش خروجی canvas)
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const filterCssRef = useRef("none"); // برای خواندن سریع داخل حلقه‌ی رسم، بدون وابستگی به state
  const camOnRef = useRef(true);
  const rafRef = useRef(null);
  const videoSenderRef = useRef(null); // برای عوض کردن ترک ویدیو موقع next بدون بازسازی canvas

  function showToast(text) {
    setToast(text);
    setTimeout(() => setToast(""), 2500);
  }

  // ---------- حلقه‌ی رسم: تصویر خام دوربین را با فیلتر فعلی روی canvas می‌کشد ----------
  function startDrawLoop() {
    const canvas = canvasRef.current;
    const video = rawVideoRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext("2d");

    function draw() {
      if (video.videoWidth && video.videoHeight) {
        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        if (camOnRef.current) {
          ctx.filter = filterCssRef.current;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        } else {
          ctx.filter = "none";
          ctx.fillStyle = "#0b0c10";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
  }

  // ---------- ساخت RTCPeerConnection جدید ----------
  function createPeerConnection() {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (sendStreamRef.current) {
      sendStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, sendStreamRef.current);
        if (track.kind === "video") {
          videoSenderRef.current = sender;
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 1_500_000;
          sender.setParameters(params).catch(() => {});
        }
      });
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("webrtc-ice-candidate", event.candidate);
      }
    };

    pcRef.current = pc;
    return pc;
  }

  function cleanupPeerConnection() {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    pendingCandidatesRef.current = [];
  }

  function stopEverything() {
    cleanupPeerConnection();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (rawStreamRef.current) rawStreamRef.current.getTracks().forEach((t) => t.stop());
    if (sendStreamRef.current) sendStreamRef.current.getTracks().forEach((t) => t.stop());
    if (socketRef.current) socketRef.current.disconnect();
  }

  // ---------- راه‌اندازی اولیه ----------
  useEffect(() => {
    let socket;

    async function init() {
      // اول پروفایل خودمان (نام کاربری، جنسیت، منطقه، سن) را از دیتابیس می‌گیریم
      if (session?.user?.id) {
        const { data } = await supabase
          .from("profiles")
          .select("username, gender, country, age_range")
          .eq("id", session.user.id)
          .maybeSingle();
        myProfileRef.current = {
          userId: session.user.id,
          username: data?.username || null,
          gender: data?.gender || "unspecified",
          country: data?.country || null,
          ageRange: data?.age_range || null,
        };

        // چک می‌کنیم که آیا این کاربر به‌خاطر گزارش‌های زیاد تعلیق شده یا نه
        const { data: suspended } = await supabase.rpc("is_suspended", {
          check_id: session.user.id,
        });
        if (suspended) {
          setStatus(STATUS.SUSPENDED);
          return;
        }
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true,
        });
        rawStreamRef.current = stream;

        if (rawVideoRef.current) {
          rawVideoRef.current.srcObject = stream;
          await rawVideoRef.current.play().catch(() => {});
        }

        startDrawLoop();

        // استریم canvas (تصویر فیلترشده) را با صدای خام ترکیب می‌کنیم -> همین به partner فرستاده می‌شود
        const canvasStream = canvasRef.current.captureStream(30);
        const combined = new MediaStream([
          ...canvasStream.getVideoTracks(),
          ...stream.getAudioTracks(),
        ]);
        sendStreamRef.current = combined;

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = canvasStream;
        }
      } catch (err) {
        console.error("خطا در دسترسی به دوربین/میکروفون:", err);
        setStatus(STATUS.MEDIA_ERROR);
        return;
      }

      socket = io(BACKEND_URL);
      socketRef.current = socket;

      function sendFindPartner() {
        socket.emit("find-partner", {
          userId: myProfileRef.current.userId,
          username: myProfileRef.current.username,
          gender: myProfileRef.current.gender,
          wantGender: wantGenderRef.current,
          country: myProfileRef.current.country,
          wantCountry: wantCountryRef.current,
          ageRange: myProfileRef.current.ageRange,
          wantAgeRange: wantAgeRangeRef.current,
        });
      }
      sendFindPartnerRef.current = sendFindPartner;

      socket.on("connect", sendFindPartner);

      socket.on("waiting", () => {
        cleanupPeerConnection();
        setStatus(STATUS.WAITING);
      });

      socket.on("matched", async ({ initiator, partnerUserId, partnerUsername }) => {
        setStatus(STATUS.CHATTING);
        setMessages([]);
        partnerInfoRef.current = { userId: partnerUserId, username: partnerUsername };
        historyLoggedRef.current = false;

        const pc = createPeerConnection();

        if (initiator) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", offer);

          // فقط یک طرف (initiator) تاریخچه را ثبت می‌کند تا دو بار ذخیره نشود
          if (myProfileRef.current.userId && partnerUserId && !historyLoggedRef.current) {
            historyLoggedRef.current = true;
            supabase
              .from("call_history")
              .insert({
                user_a: myProfileRef.current.userId,
                user_b: partnerUserId,
                partner_username: partnerUsername,
              })
              .then(() => {});
          }
        }
      });

      socket.on("webrtc-offer", async (offer) => {
        let pc = pcRef.current;
        if (!pc) pc = createPeerConnection();

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", answer);
      });

      socket.on("webrtc-answer", async (answer) => {
        const pc = pcRef.current;
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on("webrtc-ice-candidate", async (candidate) => {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("خطا در اضافه کردن ICE candidate:", err);
          }
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      });

      socket.on("message", (data) => {
        setMessages((prev) => [...prev, { text: data.text, from: "stranger" }]);
      });

      socket.on("partner-left", () => {
        cleanupPeerConnection();
        setStatus(STATUS.PARTNER_LEFT);
      });
    }

    init();

    return () => {
      stopEverything();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const raw = input.trim();
    if (!raw || status !== STATUS.CHATTING) return;
    const text = censorText(raw);
    socketRef.current.emit("message", text);
    setMessages((prev) => [...prev, { text, from: "me" }]);
    setInput("");
  }

  function handleNext() {
    cleanupPeerConnection();
    sendFindPartnerRef.current();
    setMessages([]);
    setStatus(STATUS.WAITING);
  }

  function handleWantGenderChange(g) {
    wantGenderRef.current = g;
    setWantGender(g);
    if (status === STATUS.WAITING || status === STATUS.CONNECTING) {
      sendFindPartnerRef.current();
    } else {
      showToast("فیلتر برای جستجوی بعدی اعمال می‌شود");
    }
  }

  function handleWantCountryChange(c) {
    wantCountryRef.current = c;
    setWantCountry(c);
    if (status === STATUS.WAITING || status === STATUS.CONNECTING) {
      sendFindPartnerRef.current();
    } else {
      showToast("فیلتر برای جستجوی بعدی اعمال می‌شود");
    }
  }

  function handleWantAgeRangeChange(a) {
    wantAgeRangeRef.current = a;
    setWantAgeRange(a);
    if (status === STATUS.WAITING || status === STATUS.CONNECTING) {
      sendFindPartnerRef.current();
    } else {
      showToast("فیلتر برای جستجوی بعدی اعمال می‌شود");
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") sendMessage();
  }

  function toggleMic() {
    if (!rawStreamRef.current) return;
    const track = rawStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const next = !camOnRef.current;
    camOnRef.current = next;
    setCamOn(next);
  }

  function handleSelectFilter(f) {
    filterCssRef.current = f.css;
    setActiveFilter(f.id);
    setFilterPickerOpen(false);
  }

  function handleReport() {
    socketRef.current?.emit("report");
    if (myProfileRef.current.userId && partnerInfoRef.current.userId) {
      supabase
        .from("reports")
        .insert({
          reporter_id: myProfileRef.current.userId,
          reported_id: partnerInfoRef.current.userId,
        })
        .then(() => {});
    }
    showToast("گزارش ثبت شد. به نفر بعدی وصل می‌شی");
    setMenuOpen(false);
    handleNext();
  }

  function handleBlock() {
    socketRef.current?.emit("block");
    showToast("این کاربر بلاک شد");
    setMenuOpen(false);
    handleNext();
  }

  function handleAddFriend() {
    showToast("لیست دوستان به‌زودی اضافه می‌شود 🚧");
    setMenuOpen(false);
  }

  function handleExit() {
    stopEverything();
    setStatus(STATUS.EXITED);
    setMenuOpen(false);
  }

  if (status === STATUS.MEDIA_ERROR) {
    return (
      <div className="app">
        <div className="media-error">
          <div className="media-error-icon">
            <IconCamOff />
          </div>
          <h2>دسترسی به دوربین و میکروفون لازم است</h2>
          <p>برای برقراری تماس باید به مرورگر اجازه دسترسی بدهی. صفحه را رفرش کن و روی «Allow» بزن.</p>
        </div>
      </div>
    );
  }

  if (status === STATUS.EXITED) {
    return (
      <div className="app">
        <div className="media-error">
          <div className="media-error-icon exited">
            <IconExit />
          </div>
          <h2>از چت خارج شدی</h2>
          <p>دوربین و میکروفون قطع شدند. هر وقت خواستی دوباره وصل شو.</p>
          <button className="scan-retry" onClick={() => window.location.reload()}>
            شروع دوباره
          </button>
        </div>
      </div>
    );
  }

  if (status === STATUS.SUSPENDED) {
    return (
      <div className="app">
        <div className="media-error">
          <div className="media-error-icon">
            <IconFlag />
          </div>
          <h2>دسترسی شما موقتاً محدود شده</h2>
          <p>به‌خاطر گزارش‌های متعدد از طرف کاربران دیگر، امکان استفاده از چت رندوم فعلاً غیرفعال شده.</p>
        </div>
      </div>
    );
  }

  const showOverlay = status !== STATUS.CHATTING;
  const canModerate = status === STATUS.CHATTING;

  return (
    <div className="app">
      <video ref={rawVideoRef} style={{ display: "none" }} autoPlay playsInline muted />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      <div className="video-container fullscreen">
        <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />

        {/* هدر شناور روی ویدیو */}
        <div className="live-header">
          <div className="brand">
            <Logo size={26} />
            <span className="brand-name">RandomChat</span>
          </div>
          <div className="menu-wrap">
            <button className="icon-btn ghost" onClick={() => setMenuOpen((v) => !v)} aria-label="منو">
              <IconMenu />
            </button>
            {menuOpen && (
              <div className="dropdown">
                <button onClick={handleAddFriend}>
                  <IconUserPlus /> افزودن دوست
                </button>
                <div className="dropdown-divider" />
                <button onClick={handleReport} disabled={!canModerate} className="danger">
                  <IconFlag /> گزارش تخلف
                </button>
                <button onClick={handleBlock} disabled={!canModerate} className="danger">
                  <IconBlock /> مسدود کردن
                </button>
                <div className="dropdown-divider" />
                <button onClick={handleExit} className="danger">
                  <IconExit /> پایان و خروج
                </button>
              </div>
            )}
          </div>
        </div>

        {/* نوار فیلتر جستجو: جنسیت (فعال)، منطقه/سن (به‌زودی) */}
        <div className="match-filter-bar">
          <button className="filter-summary-btn" onClick={() => setFilterSheetOpen((v) => !v)}>
            <IconSliders />
            فیلترهای جستجو
            {(wantGender !== "all" || wantCountry !== "all" || wantAgeRange !== "all") && (
              <span className="sub-tab-badge">فعال</span>
            )}
          </button>
        </div>

        {filterSheetOpen && (
          <div className="filter-sheet-overlay" onClick={() => setFilterSheetOpen(false)}>
            <div className="filter-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="filter-sheet-handle" />
              <h3>فیلتر نفر بعدی</h3>

              <p className="filter-sheet-label">جنسیت</p>
              <div className="filter-chip-row">
                {Object.entries(GENDER_LABEL).map(([id, label]) => (
                  <button
                    key={id}
                    className={wantGender === id ? "chip active" : "chip"}
                    onClick={() => handleWantGenderChange(id)}
                  >
                    {label.replace("جنسیت: ", "")}
                  </button>
                ))}
              </div>

              <p className="filter-sheet-label">منطقه</p>
              <div className="filter-chip-row">
                {Object.entries(COUNTRY_LABEL).map(([id, label]) => (
                  <button
                    key={id}
                    className={wantCountry === id ? "chip active" : "chip"}
                    onClick={() => handleWantCountryChange(id)}
                  >
                    {label.replace("منطقه: ", "")}
                  </button>
                ))}
              </div>

              <p className="filter-sheet-label">سن</p>
              <div className="filter-chip-row">
                {Object.entries(AGE_LABEL).map(([id, label]) => (
                  <button
                    key={id}
                    className={wantAgeRange === id ? "chip active" : "chip"}
                    onClick={() => handleWantAgeRangeChange(id)}
                  >
                    {label.replace("سن: ", "")}
                  </button>
                ))}
              </div>

              <button className="filter-sheet-close" onClick={() => setFilterSheetOpen(false)}>
                بستن
              </button>
            </div>
          </div>
        )}

        {toast && <div className="toast">{toast}</div>}

        {showOverlay && (
          <div className="scan-overlay">
            <div className="scan-lines" />
            <div className="scan-content">
              <SignalMeter status={status} />
              <p className="scan-text">
                {status === STATUS.PARTNER_LEFT ? "طرف مقابل ارتباط را قطع کرد" : "در حال یافتن یک نفر..."}
              </p>
              {status === STATUS.PARTNER_LEFT && (
                <button onClick={handleNext} className="scan-retry">
                  <IconNext /> نفر بعدی
                </button>
              )}
            </div>
          </div>
        )}

        <div className="local-video-frame">
          <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
          <span className="local-video-label">شما</span>
        </div>

        {/* چت روی ویدیو - مثل کامنت‌های لایو اینستاگرام */}
        <div className="live-chat-overlay">
          {messages.length === 0 && status === STATUS.CHATTING && (
            <p className="hint hint-overlay">به یک غریبه وصل شدی، سلام کن</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`live-bubble ${m.from === "me" ? "me" : "stranger"}`}>
              {m.text}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {filterPickerOpen && (
          <div className="filter-picker">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                className={`filter-thumb-btn ${activeFilter === f.id ? "active" : ""}`}
                onClick={() => handleSelectFilter(f)}
              >
                <span className={`filter-thumb swatch-${f.id}`} />
                <span className="filter-thumb-label">{f.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* نوار پایین: کنترل‌ها + ورودی پیام، همه شناور روی ویدیو */}
        <div className="live-bottom-bar">
          <div className="video-controls">
            <button
              onClick={toggleMic}
              className={`ctrl-btn ${!micOn ? "off" : ""}`}
              aria-label={micOn ? "قطع میکروفون" : "روشن کردن میکروفون"}
            >
              {micOn ? <IconMic /> : <IconMicOff />}
            </button>
            <button
              onClick={toggleCam}
              className={`ctrl-btn ${!camOn ? "off" : ""}`}
              aria-label={camOn ? "قطع دوربین" : "روشن کردن دوربین"}
            >
              {camOn ? <IconCam /> : <IconCamOff />}
            </button>
            <button
              onClick={() => setFilterPickerOpen((v) => !v)}
              className={`ctrl-btn ${filterPickerOpen ? "active-filter" : ""}`}
              aria-label="فیلتر تصویر"
            >
              <IconPalette />
            </button>
            <button onClick={handleNext} className="ctrl-btn next" aria-label="نفر بعدی">
              <IconNext />
            </button>
            <button onClick={handleExit} className="ctrl-btn exit-call" aria-label="پایان تماس">
              <IconExit />
            </button>
          </div>

          <div className="controls live-controls">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={status === STATUS.CHATTING ? "پیامت را بنویس..." : "منتظر نفر بعدی..."}
              disabled={status !== STATUS.CHATTING}
            />
            <button
              onClick={sendMessage}
              disabled={status !== STATUS.CHATTING}
              className="send-btn"
              aria-label="ارسال"
            >
              <IconSend />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RandomChat;
