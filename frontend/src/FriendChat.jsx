import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function FriendChat({ session, friend, onBack }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);
  const myId = session.user.id;

  useEffect(() => {
    let channel;

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

    // آپدیت زنده: هر پیام جدیدی که مربوط به این گفتگو باشد فوراً اضافه شود
    channel = supabase
      .channel(`chat-${friend.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const m = payload.new;
        const isRelevant =
          (m.sender_id === myId && m.receiver_id === friend.id) ||
          (m.sender_id === friend.id && m.receiver_id === myId);
        if (isRelevant) setMessages((prev) => [...prev, m]);
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.id]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await supabase.from("messages").insert({ sender_id: myId, receiver_id: friend.id, content: text });
  }

  return (
    <div className="friend-chat-screen">
      <div className="friend-chat-header">
        <button onClick={onBack} className="back-btn">
          ←
        </button>
        <span>{friend.username}</span>
      </div>

      <div className="chat-box">
        {messages.length === 0 && <p className="hint">هنوز پیامی رد و بدل نشده</p>}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.sender_id === myId ? "me" : "stranger"}`}>
            {m.content}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="controls">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="پیامت را بنویس..."
        />
        <button className="send-btn" onClick={send}>
          ارسال
        </button>
      </div>
    </div>
  );
}
