// server.js
// سرور signaling برای چت متنی رندوم (شبیه Omegle)
// وظیفه: مدیریت اتصال کاربران، قرار دادن آن‌ها در صف انتظار،
// جفت‌کردن دو کاربر با هم، و انتقال پیام‌ها بین آن‌ها.

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const app = express();
app.use(cors());

// یک route ساده فقط برای اینکه بفهمیم سرور بالا هست
app.get("/", (req, res) => {
  res.send("RandomChat backend is running ✅");
});

const server = http.createServer(app);

// راه‌اندازی Socket.io روی همان سرور HTTP
// origin: "*" یعنی فعلاً اجازه اتصال از هر آدرسی را می‌دهیم (برای تست بین دوستان کافیست)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// صف کاربرانی که منتظر پیدا شدن یک partner هستند (آرایه‌ای از socket.id ها)
let waitingQueue = [];

// نگهداری جفت‌های فعلی: partners["A"] = "B"  و  partners["B"] = "A"
let partners = {};

// نگهداری بلاک‌ها: blockedBy["A"] = Set{"B", "C"} یعنی A این‌ها را بلاک کرده
let blockedBy = {};

// نگهداری اطلاعات اکانت هر socket: profiles["A"] = { userId, username, gender, wantGender }
let profiles = {};

function isBlockedPair(id1, id2) {
  return (blockedBy[id1] && blockedBy[id1].has(id2)) || (blockedBy[id2] && blockedBy[id2].has(id1));
}

// آیا این دو نفر از نظر جنسیت با ترجیح همدیگر جور هستند؟
function isGenderCompatible(id1, id2) {
  const p1 = profiles[id1];
  const p2 = profiles[id2];
  if (!p1 || !p2) return true; // اگر اطلاعاتی نبود، محدودیتی اعمال نکن

  const p1Wants = !p1.wantGender || p1.wantGender === "all" || p1.wantGender === p2.gender;
  const p2Wants = !p2.wantGender || p2.wantGender === "all" || p2.wantGender === p1.gender;
  return p1Wants && p2Wants;
}

// تابع کمکی: تلاش برای جفت‌کردن یک کاربر با نفر بعدی در صف (که بلاک نشده و جنسیتش جور باشد)
function tryMatch(socket) {
  // اگر خودش از قبل در صف بود، اول حذفش کن (جلوگیری از تکرار)
  waitingQueue = waitingQueue.filter((id) => id !== socket.id);

  // اولین نفر در صف که بلاک نشده، جنسیتش جور است، و هنوز آنلاین است را پیدا کن
  let matchIndex = -1;
  for (let i = 0; i < waitingQueue.length; i++) {
    const candidateId = waitingQueue[i];
    if (
      !isBlockedPair(socket.id, candidateId) &&
      isGenderCompatible(socket.id, candidateId) &&
      io.sockets.sockets.get(candidateId)
    ) {
      matchIndex = i;
      break;
    }
  }

  if (matchIndex !== -1) {
    const partnerId = waitingQueue.splice(matchIndex, 1)[0];
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket) {
      partners[socket.id] = partnerId;
      partners[partnerId] = socket.id;

      // تعیین می‌کنیم کدام طرف "initiator" باشد یعنی اولین کسی که
      // WebRTC offer را می‌سازد. برای جلوگیری از تداخل (glare)،
      // بر اساس مقایسه‌ی رشته‌ای id ها تصمیم می‌گیریم - همیشه هر دو طرف
      // به یک نتیجه‌ی یکسان می‌رسند.
      const socketIsInitiator = socket.id < partnerId;

      const myProfile = profiles[socket.id] || {};
      const partnerProfile = profiles[partnerId] || {};

      socket.emit("matched", {
        partnerId,
        initiator: socketIsInitiator,
        partnerUserId: partnerProfile.userId || null,
        partnerUsername: partnerProfile.username || null,
      });
      partnerSocket.emit("matched", {
        partnerId: socket.id,
        initiator: !socketIsInitiator,
        partnerUserId: myProfile.userId || null,
        partnerUsername: myProfile.username || null,
      });
      return;
    }
  }

  // کسی در صف نبود -> خودش را در صف بگذار و منتظر بماند
  waitingQueue.push(socket.id);
  socket.emit("waiting");
}

// تابع کمکی: قطع ارتباط یک کاربر از partner فعلی‌اش (وقتی دیسکانکت می‌شود یا skip می‌زند)
function disconnectFromPartner(socket) {
  const partnerId = partners[socket.id];

  if (partnerId) {
    const partnerSocket = io.sockets.sockets.get(partnerId);
    if (partnerSocket) {
      partnerSocket.emit("partner-left");
    }
    delete partners[partnerId];
  }

  delete partners[socket.id];
  waitingQueue = waitingQueue.filter((id) => id !== socket.id);
}

io.on("connection", (socket) => {
  console.log(`✅ کاربر متصل شد: ${socket.id}`);

  // کاربر درخواست پیدا کردن partner می‌دهد - همراه با اطلاعات اکانتش
  socket.on("find-partner", (profile) => {
    if (profile) {
      profiles[socket.id] = {
        userId: profile.userId || null,
        username: profile.username || null,
        gender: profile.gender || "unspecified",
        wantGender: profile.wantGender || "all",
      };
    }
    disconnectFromPartner(socket); // برای اطمینان، هر وضعیت قبلی را پاک کن
    tryMatch(socket);
  });

  // کاربر یک پیام متنی می‌فرستد -> باید برای partner ارسال شود
  socket.on("message", (text) => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      io.to(partnerId).emit("message", { text, from: "stranger" });
    }
  });

  // --- رویدادهای سیگنالینگ WebRTC ---
  // این سرور فقط پیام‌ها را بین دو طرف رد و بدل می‌کند (relay)
  // خودش هیچ‌کاری با محتوای ویدیو/صدا ندارد؛ ویدیو مستقیم بین دو مرورگر رد و بدل می‌شود (P2P)

  socket.on("webrtc-offer", (offer) => {
    const partnerId = partners[socket.id];
    if (partnerId) io.to(partnerId).emit("webrtc-offer", offer);
  });

  socket.on("webrtc-answer", (answer) => {
    const partnerId = partners[socket.id];
    if (partnerId) io.to(partnerId).emit("webrtc-answer", answer);
  });

  socket.on("webrtc-ice-candidate", (candidate) => {
    const partnerId = partners[socket.id];
    if (partnerId) io.to(partnerId).emit("webrtc-ice-candidate", candidate);
  });

  // کاربر طرف مقابل را گزارش می‌کند (تخلف)
  socket.on("report", () => {
    const partnerId = partners[socket.id];
    console.log(`🚩 گزارش تخلف ثبت شد: ${socket.id} از ${partnerId} شکایت کرد`);
    // نکته برای بعد: وقتی دیتابیس اضافه شد، این گزارش‌ها باید ذخیره و بررسی شوند
  });

  // کاربر طرف مقابل را بلاک می‌کند - دیگر هیچ‌وقت با هم جفت نمی‌شوند (در این سشن)
  socket.on("block", () => {
    const partnerId = partners[socket.id];
    if (partnerId) {
      if (!blockedBy[socket.id]) blockedBy[socket.id] = new Set();
      blockedBy[socket.id].add(partnerId);
      console.log(`🚫 ${socket.id} کاربر ${partnerId} را بلاک کرد`);
    }
  });

  // کاربر می‌خواهد partner فعلی را رد کند و یک نفر جدید پیدا کند
  socket.on("skip", () => {
    disconnectFromPartner(socket);
    tryMatch(socket);
  });

  // کاربر قطع می‌شود (تب را بست یا اینترنتش رفت)
  socket.on("disconnect", () => {
    disconnectFromPartner(socket);
    delete blockedBy[socket.id];
    delete profiles[socket.id];
    console.log(`❌ کاربر قطع شد: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} در حال اجراست`);
});
