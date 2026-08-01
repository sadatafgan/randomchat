import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

// آدرس سرور بک‌اند - وقتی روی سیستم خودت تست می‌کنی همین می‌ماند
// وقتی روی Render دیپلوی کردی، این را با آدرس واقعی سرور عوض کن
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// وضعیت‌های ممکن اتصال
const STATUS = {
  CONNECTING: "connecting", // در حال وصل شدن به سرور
  WAITING: "waiting", // منتظر پیدا شدن یک نفر دیگر
  CHATTING: "chatting", // در حال چت با یک partner
  PARTNER_LEFT: "partner_left", // partner قطع شد
};

function App() {
  const [status, setStatus] = useState(STATUS.CONNECTING);
  const [messages, setMessages] = useState([]); // { text, from: 'me' | 'stranger' }
  const [input, setInput] = useState("");

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);

  // اتصال به سرور - فقط یک‌بار وقتی کامپوننت بارگذاری می‌شود
  useEffect(() => {
    const socket = io(BACKEND_URL);
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("find-partner");
    });

    socket.on("waiting", () => {
      setStatus(STATUS.WAITING);
    });

    socket.on("matched", () => {
      setStatus(STATUS.CHATTING);
      setMessages([]); // چت قبلی را پاک کن
    });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, { text: data.text, from: "stranger" }]);
    });

    socket.on("partner-left", () => {
      setStatus(STATUS.PARTNER_LEFT);
    });

    // پاک‌سازی وقتی کامپوننت از بین می‌رود
    return () => {
      socket.disconnect();
    };
  }, []);

  // اسکرول خودکار به آخرین پیام
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
    socketRef.current.emit("skip");
    setMessages([]);
    setStatus(STATUS.WAITING);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter") sendMessage();
  }

  return (
    <div className="app">
      <header className="header">
        <h1>💬 RandomChat</h1>
        <StatusBadge status={status} />
      </header>

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
  const { text, color } = map[status];
  return (
    <span className="status" style={{ color }}>
      {text}
    </span>
  );
}

export default App;
