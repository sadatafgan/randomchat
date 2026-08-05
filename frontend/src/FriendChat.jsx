import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import { censorText } from "./lib/textFilter";
import { notify } from "./lib/notifications";

// مدت زمانی که بعد از آن وضعیت "در حال نوشتن" پاک می‌شود (۳ ثانیه)
const TYPING_TIMEOUT = 3000;

export default function FriendChat({ session, friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [friendTyping, setFriendTyping] = useState(false);
  const endRef = useRef(null);
  const typingTimerRef = useRef(null);
  const myId = session.user.id;
  const channelKey = [myId, friend.id].sort().join("_");

  useEffect(() => {
    let msgChannel;
    let typingChannel;

    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .or(
          `and(sender_id.eq.${myId},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${myId})`
        )
        .order("created_at", { ascending: true });
      setMessages(data || []);
    }
    load();

    // کانال پیام‌ها (Postgres Realtime)
    msgChannel = supabase
      .channel(`chat-${friend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new;
        const isRelevant =
          (m.sender_id === myId && m.receiver_id === friend.id) ||
          (m.sender_id === friend.id && m.receiver_id === myId);
        if (isRelevant) {
          setMessages((prev) => [...prev, m]);
          if (m.sender_id === friend.id) {
            setFriendTyping(false);
            notify(`💬 ${friend.username}`, {
              body: m.content.length > 60 ? m.content.slice(0, 60) + "..." : m.content,
              tag: `msg-${friend.id}`,
            });
          }
        }
      })
      .subscribe();

    // کانال وضعیت تایپ (Broadcast — هیچ چیزی در دیتابیس ذخیره نمی‌شود)
    typingChannel = supabase
      .channel(`typing-${channelKey}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (payload.from !== friend.id) return;
        setFriendTyping(true);
        // اگر ۳ ثانیه چیزی نرسید، وضعیت را پاک کن
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => setFriendTyping(false), TYPING_TIMEOUT);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(msgChannel);
      supabase.removeChannel(typingChannel);
      clearTimeout(typingTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, friendTyping]);

  // هر بار که کاربر تایپ می‌کند، یک رویداد Broadcast می‌فرستد
  async function broadcastTyping() {
    const channel = supabase.channel(`typing-${channelKey}`);
    await channel.send({
      type: "broadcast",
      event: "typing",
      payload: { from: myId },
    });
  }

  async function send() {
    const raw = input.trim();
    if (!raw) return;
    const text = censorText(raw);
    setInput("");
    await supabase.from("messages").insert({ sender_id: myId, receiver_id: friend.id, content: text });
  }

  return (
    <div className="friend-chat-screen">
      <div className="friend-chat-header">
        <button onClick={onBack} className="back-btn">←</button>
        <div className="friend-chat-header-info">
          <span className="header-name">{friend.username}</span>
          {friendTyping && <span className="typing-status">در حال نوشتن...</span>}
        </div>
      </div>

      <div className="chat-box">
        {messages.length === 0 && !friendTyping && (
          <p className="hint">هنوز پیامی رد و بدل نشده</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === myId ? "me" : "stranger"}`}>
            {m.content}
          </div>
        ))}
        {friendTyping && (
          <div className="bubble stranger typing-bubble">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="controls">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            broadcastTyping();
          }}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="پیامت را بنویس..."
        />
        <button className="send-btn" onClick={send}>ارسال</button>
      </div>
    </div>
  );
}
