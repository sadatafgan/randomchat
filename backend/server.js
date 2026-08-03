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

// نگهداری اطلاعات اکانت هر socket: profiles["A"] = { userId, username, gender, wantGender, country, wantCountry, ageRange, wantAgeRange }
let profiles = {};

// نگهداری وضعیت آنلاین: onlineUsers["user-uuid"] = socket.id  (برای تماس با دوستان)
let onlineUsers = {};

function isBlockedPair(id1, id2) {
  return (blockedBy[id1] && blockedBy[id1].has(id2)) || (blockedBy[id2] && blockedBy[id2].has(id1));
}

// چک تطابق دوطرفه‌ی یک فیلتر خاص (جنسیت/منطقه/سن) - اگر یکی "all" خواسته یا اطلاعاتی نبود، محدودیتی نمی‌گذارد
function fieldCompatible(wantValue, actualValue) {
  if (!wantValue || wantValue === "all") return true;
  return wantValue === actualValue;
}

// آیا این دو نفر از نظر جنسیت/منطقه/سن با ترجیح همدیگر جور هستند؟
function isMatchCompatible(id1, id2) {
  const p1 = profiles[id1];
  const p2 = profiles[id2];
  if (!p1 || !p2) return true; // اگر اطلاعاتی نبود، محدودیتی اعمال نکن

  return (
    fieldCompatible(p1.wantGender, p2.gender) &&
    fieldCompatible(p2.wantGender, p1.gender) &&
    fieldCompatible(p1.wantCountry, p2.country) &&
    fieldCompatible(p2.wantCountry, p1.country) &&
    fieldCompatible(p1.wantAgeRange, p2.ageRange) &&
    fieldCompatible(p2.wantAgeRange, p1.ageRange)
  );
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
      isMatchCompatible(socket.id, candidateId) &&
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
        country: profile.country || null,
        wantCountry: profile.wantCountry || "all",
        ageRange: profile.ageRange || null,
        wantAgeRange: profile.wantAgeRange || "all",
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

  // --- وضعیت آنلاین و تماس با دوستان (جدا از صف چت رندوم) ---

  // کاربر اعلام می‌کند که آنلاین است (userId خودش را ثبت می‌کند)
  socket.on("register-presence", ({ userId }) => {
    if (!userId) return;
    socket.userId = userId;
    onlineUsers[userId] = socket.id;
  });

  // چک کردن اینکه کدام‌یک از لیست دوستان الان آنلاین هستند
  socket.on("check-online", (userIds) => {
    const online = (userIds || []).filter((id) => !!onlineUsers[id]);
    socket.emit("online-status", online);
  });

  // درخواست تماس با یک دوست مشخص (بر اساس userId، نه صف رندوم)
  socket.on("call-friend", ({ targetUserId, fromUserId, fromUsername }) => {
    const targetSocketId = onlineUsers[targetUserId];
    const targetSocket = targetSocketId && io.sockets.sockets.get(targetSocketId);

    if (!targetSocket) {
      socket.emit("call-failed", { reason: "offline" });
      return;
    }
    if (partners[targetSocketId] || partners[socket.id]) {
      socket.emit("call-failed", { reason: "busy" });
      return;
    }

    targetSocket.emit("incoming-call", {
      fromSocketId: socket.id,
      fromUserId,
      fromUsername,
    });
  });

  // دوست تماس را قبول می‌کند -> از همان مکانیزم partners چت رندوم استفاده می‌کنیم
  // چون رویدادهای webrtc-offer/answer/ice-candidate از قبل بر همین اساس کار می‌کنند
  socket.on("accept-call", ({ callerSocketId }) => {
    const callerSocket = io.sockets.sockets.get(callerSocketId);
    if (!callerSocket) {
      socket.emit("call-failed", { reason: "gone" });
      return;
    }
    partners[socket.id] = callerSocketId;
    partners[callerSocketId] = socket.id;

    const socketIsInitiator = socket.id < callerSocketId;
    socket.emit("call-accepted", { partnerId: callerSocketId, initiator: socketIsInitiator });
    callerSocket.emit("call-accepted", { partnerId: socket.id, initiator: !socketIsInitiator });
  });

  socket.on("reject-call", ({ callerSocketId }) => {
    const callerSocket = io.sockets.sockets.get(callerSocketId);
    if (callerSocket) callerSocket.emit("call-failed", { reason: "rejected" });
  });

  // پایان تماس با دوست (بدون قطع کل اتصال سوکت، چون برای وضعیت آنلاین هم لازم است)
  socket.on("end-call", () => {
    disconnectFromPartner(socket);
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
    if (socket.userId && onlineUsers[socket.userId] === socket.id) {
      delete onlineUsers[socket.userId];
    }
    console.log(`❌ کاربر قطع شد: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} در حال اجراست`);
});
