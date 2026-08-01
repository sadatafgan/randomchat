import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// آدرس سرور بک‌اند
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// سرورهای STUN رایگان گوگل - برای کمک به دو مرورگر تا مسیر اتصال مستقیم را پیدا کنند
// اگر بعداً با شبکه‌های سخت‌گیرتر (NAT سنگین) مشکل داشتی، باید یک TURN server هم اضافه کنیم
const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const STATUS = {
  CONNECTING: "connecting",
  WAITING: "waiting",
  CHATTING: "chatting",
  PARTNER_LEFT: "partner_left",
  MEDIA_ERROR: "media_error",
};

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
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // وقتی ترک ویدیو/صدای طرف مقابل می‌رسد
    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    // هر بار که یک ICE candidate جدید پیدا می‌شود، برای طرف مقابل بفرست
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("webrtc-ice-candidate", event.candidate);
      }
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
          video: true,
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
          <h2>⚠️ دسترسی به دوربین/میکروفون داده نشد</h2>
          <p>
            برای استفاده از چت ویدیویی باید به مرورگر اجازه دسترسی به دوربین و
            میکروفون را بدهی. صفحه را رفرش کن و روی "Allow" بزن.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>💬 RandomChat</h1>
        <StatusBadge status={status} />
      </header>

      <div className="video-container">
        <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />
        <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
        <div className="video-controls">
          <button onClick={toggleMic} className={micOn ? "" : "off"}>
            {micOn ? "🎤" : "🔇"}
          </button>
          <button onClick={toggleCam} className={camOn ? "" : "off"}>
            {camOn ? "📷" : "🚫"}
          </button>
        </div>
      </div>

      <div className="chat-box">
        {messages.length === 0 && status === STATUS.CHATTING && (
          <p className="hint">به یک غریبه وصل شدی! سلام کن 👋</p>
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
          placeholder={
            status === STATUS.CHATTING ? "پیامت را بنویس..." : "منتظر پیدا شدن یک نفر..."
          }
          disabled={status !== STATUS.CHATTING}
        />
        <button onClick={sendMessage} disabled={status !== STATUS.CHATTING}>
          ارسال
        </button>
        <button onClick={handleNext} className="next-btn">
          نفر بعدی ⏭
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    [STATUS.CONNECTING]: { text: "در حال اتصال به سرور...", color: "#999" },
    [STATUS.WAITING]: { text: "در حال پیدا کردن یک نفر...", color: "#f0ad4e" },
    [STATUS.CHATTING]: { text: "متصل شدی ✅", color: "#5cb85c" },
    [STATUS.PARTNER_LEFT]: { text: "طرف مقابل رفت. دکمه نفر بعدی را بزن", color: "#d9534f" },
  };
  const { text, color } = map[status] || {};
  return (
    <span className="status" style={{ color }}>
      {text}
    </span>
  );
}

export default App;
