import { useEffect, useRef, useState } from "react";
import { censorText } from "./lib/textFilter";

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
function IconExit() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
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

export default function FriendCall({ socket, partnerId, initiator, partnerUsername, onEnd }) {
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    let stopped = false;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      if (stopped) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) socket.emit("webrtc-ice-candidate", event.candidate);
      };

      if (initiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc-offer", offer);
      }
    }

    function onOffer(offer) {
      (async () => {
        let pc = pcRef.current;
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c));
        }
        pendingCandidatesRef.current = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc-answer", answer);
      })();
    }

    function onAnswer(answer) {
      pcRef.current?.setRemoteDescription(new RTCSessionDescription(answer));
    }

    function onCandidate(candidate) {
      const pc = pcRef.current;
      if (pc && pc.remoteDescription) {
        pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
      } else {
        pendingCandidatesRef.current.push(candidate);
      }
    }

    function onPartnerLeft() {
      onEnd();
    }

    function onMessage(data) {
      setMessages((prev) => [...prev, { text: data.text, from: "stranger" }]);
    }

    socket.on("webrtc-offer", onOffer);
    socket.on("webrtc-answer", onAnswer);
    socket.on("webrtc-ice-candidate", onCandidate);
    socket.on("partner-left", onPartnerLeft);
    socket.on("message", onMessage);

    start();

    return () => {
      stopped = true;
      socket.off("webrtc-offer", onOffer);
      socket.off("webrtc-answer", onAnswer);
      socket.off("webrtc-ice-candidate", onCandidate);
      socket.off("partner-left", onPartnerLeft);
      socket.off("message", onMessage);
      if (pcRef.current) pcRef.current.close();
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function sendMessage() {
    const raw = input.trim();
    if (!raw) return;
    const text = censorText(raw);
    socket.emit("message", text);
    setMessages((prev) => [...prev, { text, from: "me" }]);
    setInput("");
  }

  function toggleMic() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  function handleEnd() {
    socket.emit("end-call");
    onEnd();
  }

  return (
    <div className="video-container fullscreen">
      <video ref={remoteVideoRef} className="remote-video" autoPlay playsInline />

      {!connected && (
        <div className="scan-overlay">
          <div className="scan-content">
            <p className="scan-text">در حال اتصال به {partnerUsername || "دوست"}...</p>
          </div>
        </div>
      )}

      <div className="local-video-frame">
        <video ref={localVideoRef} className="local-video" autoPlay playsInline muted />
        <span className="local-video-label">شما</span>
      </div>

      <div className="live-chat-overlay">
        {messages.map((m, i) => (
          <div key={i} className={`live-bubble ${m.from === "me" ? "me" : "stranger"}`}>
            {m.text}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="live-bottom-bar">
        <div className="video-controls">
          <button onClick={toggleMic} className={`ctrl-btn ${!micOn ? "off" : ""}`} aria-label="میکروفون">
            {micOn ? <IconMic /> : <IconMicOff />}
          </button>
          <button onClick={toggleCam} className={`ctrl-btn ${!camOn ? "off" : ""}`} aria-label="دوربین">
            {camOn ? <IconCam /> : <IconCamOff />}
          </button>
          <button onClick={handleEnd} className="ctrl-btn exit-call" aria-label="پایان تماس">
            <IconExit />
          </button>
        </div>

        <div className="controls live-controls">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="پیامت را بنویس..."
          />
          <button onClick={sendMessage} className="send-btn" aria-label="ارسال">
            <IconSend />
          </button>
        </div>
      </div>
    </div>
  );
}
