import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// آدرس سرور بک‌اند
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// سرورهای STUN و TURN
// STUN فقط به دو طرف کمک می‌کند "آدرس عمومی" خودشان را بفهمند - در خیلی از شبکه‌ها کافیست
// TURN وقتی لازم می‌شود که اتصال مستقیم P2P ممکن نباشد (NAT سخت‌گیر، شبکه موبایل و...)
// و ترافیک ویدیو را relay می‌کند. اینجا از ExpressTURN (پلن رایگان) استفاده می‌کنیم.
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
};

// ---------- آیکون‌ها (SVG سبک، بدون وابستگی به کتابخانه خارجی) ----------
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

// ---------- میله‌های سیگنال (المان تصویری اصلی برای وضعیت اتصال) ----------
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

function App() {
  const [status, setStatus] = useState(STATUS.CONNECTING);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const socketRef = useRef(null);
  const pcRef = useRef(null); // RTCPeerConnection فعلی
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const pendingCandidatesRef = useRef([]); // ICE candidate هایی که قبل از آماده شدن remoteDescription رسیده‌اند

  // ---------- ساخت یک RTCPeerConnection جدید برای هر جفت‌شدن ----------
  function createPeerConnection(partnerId) {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // ترک‌های صدا/ویدیوی خودمان را به اتصال اضافه می‌کنیم
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        const sender = pc.addTrack(track, localStreamRef.current);

        // برای ترک ویدیو، به مرورگر می‌گوییم بیت‌ریت (کیفیت) را خیلی پایین نیاورد
        // این مهم است چون وقتی ترافیک از TURN relay رد می‌شود، مرورگر معمولاً محتاطانه کیفیت را کم می‌کند
        if (track.kind === "video") {
          const params = sender.getParameters();
          if (!params.encodings) params.encodings = [{}];
          params.encodings[0].maxBitrate = 1_500_000; // حداکثر ۱.۵ مگابیت بر ثانیه
          sender.setParameters(params).catch((err) => {
            console.warn("تنظیم بیت‌ریت ممکن نشد:", err);
          });
        }
      });
    }

    // وقتی ترک ویدیو/صدای طرف مقابل می‌رسد
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // لاگ وضعیت اتصال - برای عیب‌یابی در کنسول مرورگر (F12) مفید است
    pc.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", pc.iceConnectionState);
    };

    // هر بار که یک ICE candidate جدید پیدا می‌شود، برای طرف مقابل بفرست
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // نوع candidate را لاگ می‌کنیم: host (مستقیم) / srflx (از طریق STUN) / relay (از طریق TURN)
        console.log("پیدا شد ICE candidate از نوع:", event.candidate.type, event.candidate.candidate);
        socketRef.current.emit("webrtc-ice-candidate", event.candidate);
      } else {
        console.log("جمع‌آوری ICE candidate ها تمام شد");
      }
    };

    // اگر مشکلی در رسیدن به سرور STUN/TURN باشد، اینجا خطا می‌دهد
    pc.onicecandidateerror = (event) => {
      console.error("خطای ICE candidate:", event.errorCode, event.errorText, event.url);
    };

    pc.onconnectionstatechange = () => {
      console.log("Peer connection state:", pc.connectionState);
    };

    pcRef.current = pc;
    return pc;
  }

  // پاک‌سازی اتصال فعلی (وقتی partner می‌رود یا skip می‌زنیم)
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

  // ---------- گرفتن اجازه دوربین/میکروفون و اتصال به سرور ----------
  useEffect(() => {
    let socket;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error("خطا در دسترسی به دوربین/میکروفون:", err);
        setStatus(STATUS.MEDIA_ERROR);
        return; // بدون دسترسی به دوربین ادامه نمی‌دهیم
      }

      socket = io(BACKEND_URL);
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("find-partner");
      });

      socket.on("waiting", () => {
        cleanupPeerConnection();
        setStatus(STATUS.WAITING);
      });

      socket.on("matched", async ({ partnerId, initiator }) => {
        setStatus(STATUS.CHATTING);
        setMessages([]);

        const pc = createPeerConnection(partnerId);

        if (initiator) {
          // این طرف باید offer بسازد
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("webrtc-offer", offer);
        }
      });

      socket.on("webrtc-offer", async (offer) => {
        let pc = pcRef.current;
        if (!pc) pc = createPeerConnection();

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // هر candidate ای که زودتر رسیده بود را الان اضافه کن
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
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
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
          // هنوز remoteDescription آماده نیست، بعداً اضافه‌اش می‌کنیم
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
      cleanupPeerConnection();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const text = input.trim();
    if (!text || status !== STATUS.CHATTING) return;
    socketRef.current.emit("message", text);
    setMessages((prev) => [...prev, { text, from: "me" }]);
    setInput("");
  }

  function handleNext() {
    cleanupPeerConnection();
    socketRef.current.emit("skip");
    setMessages([]);
    setStatus(STATUS.WAITING);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") sendMessage();
  }

  function toggleMic() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  if (status === STATUS.MEDIA_ERROR) {
    return (
      <div className="app">
        <div className="media-error">
          <div className="media-error-icon">
            <IconCamOff />
          </div>
          <h2>دسترسی به دوربین و میکروفون لازم است</h2>
          <p>
            برای برقراری تماس باید به مرورگر اجازه دسترسی بدهی. صفحه را رفرش
            کن و روی «Allow» بزن.
          </p>
        </div>
      </div>
    );
  }

  const statusText = {
    [STATUS.CONNECTING]: "در حال اتصال به سرور",
    [STATUS.WAITING]: "در جست‌وجوی یک فرکانس زنده",
    [STATUS.CHATTING]: "سیگنال قفل شد",
    [STATUS.PARTNER_LEFT]: "طرف مقابل قطع شد",
  }[status];

  const showOverlay = status !== STATUS.CHATTING;

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-dot" />
          <span className="brand-name">RandomChat</span>
        </div>
        <div className="status-pill">
          <SignalMeter status={status} />
          <span className="status-text">{statusText}</span>
        </div>
      </header>

      <div className="video-container">
        <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />

        {showOverlay && (
          <div className="scan-overlay">
            <div className="scan-lines" />
            <div className="scan-content">
              <SignalMeter status={status} />
              <p className="scan-text">
                {status === STATUS.PARTNER_LEFT
                  ? "طرف مقابل ارتباط را قطع کرد"
                  : "در حال یافتن یک نفر..."}
              </p>
              {status === STATUS.PARTNER_LEFT && (
                <button onClick={handleNext} className="scan-retry">
                  <IconNext />
                  نفر بعدی
                </button>
              )}
            </div>
          </div>
        )}

        <div className="local-video-frame">
          <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
          <span className="local-video-label">شما</span>
        </div>

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
          <button onClick={handleNext} className="ctrl-btn next" aria-label="نفر بعدی">
            <IconNext />
          </button>
        </div>
      </div>

      <div className="chat-box">
        {messages.length === 0 && status === STATUS.CHATTING && (
          <p className="hint">به یک غریبه وصل شدی، سلام کن</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.from === "me" ? "me" : "stranger"}`}>
            {m.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="controls">
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
  );
}

export default App;
