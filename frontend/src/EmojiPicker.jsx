import { useState } from "react";

// یک لیست کوچیک و پرکاربرد از ایموجی‌ها - عمداً کوتاه نگه داشته شده
// تا سریع باز بشه و کاربر گم نشه (نه یک دیتابیس عظیم هزاران ایموجی)
const EMOJI_GROUPS = [
  {
    label: "حالت‌ها",
    emojis: ["😀", "😂", "🥹", "😍", "😘", "😉", "😎", "🤔", "😅", "😢", "😭", "😡", "😱", "🥶", "🤗", "🙄"],
  },
  {
    label: "دست‌ها",
    emojis: ["👍", "👎", "👏", "🙏", "🤝", "✌️", "👋", "💪", "🤙", "✋"],
  },
  {
    label: "قلب‌ها",
    emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💔", "💕", "🔥"],
  },
  {
    label: "دیگر",
    emojis: ["🎉", "✨", "😴", "🤩", "😏", "🙈", "💯", "☕", "🎶", "🌹"],
  },
];

export default function EmojiPicker({ onSelect, onClose }) {
  const [group, setGroup] = useState(0);

  return (
    <div className="emoji-picker" onClick={(e) => e.stopPropagation()}>
      <div className="emoji-tabs">
        {EMOJI_GROUPS.map((g, i) => (
          <button key={g.label} className={i === group ? "active" : ""} onClick={() => setGroup(i)}>
            {g.label}
          </button>
        ))}
      </div>
      <div className="emoji-grid">
        {EMOJI_GROUPS[group].emojis.map((e) => (
          <button
            key={e}
            className="emoji-item"
            onClick={() => {
              onSelect(e);
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
