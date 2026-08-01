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

// تابع کمکی: تلاش برای جفت‌کردن یک کاربر با نفر بعدی در صف
function tryMatch(socket) {
  // اگر خودش از قبل در صف بود، اول حذفش کن (جلوگیری از تکرار)
  waitingQueue = waitingQueue.filter((id) => id !== socket.id);

  if (waitingQueue.length > 0) {
    // یک نفر منتظر پیدا شد -> جفتشان کن
    const partnerId = waitingQueue.shift();
    const partnerSocket = io.sockets.sockets.get(partnerId);

    if (partnerSocket) {
      partners[socket.id] = partnerId;
      partners[partnerId] = socket.id;

      socket.emit("matched", { partnerId });
      partnerSocket.emit("matched", { partnerId: socket.id });
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

  // کاربر درخواست پیدا کردن partner می‌دهد
  socket.on("find-partner", () => {
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

  // کاربر می‌خواهد partner فعلی را رد کند و یک نفر جدید پیدا کند
  socket.on("skip", () => {
    disconnectFromPartner(socket);
    tryMatch(socket);
  });

  // کاربر قطع می‌شود (تب را بست یا اینترنتش رفت)
  socket.on("disconnect", () => {
    disconnectFromPartner(socket);
    console.log(`❌ کاربر قطع شد: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} در حال اجراست`);
});
