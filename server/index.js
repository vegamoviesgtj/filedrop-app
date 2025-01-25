const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8000;

const allowedOrigins = process.env.NODE_ENV === 'production' 
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:3000"];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  })
);

const httpServer = http.createServer(app);

app.get("/", (req, res) => {
  res.json({ status: "Server is running" });
});

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    transports: ['websocket', 'polling']
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  connectTimeout: 30000,
  allowEIO3: true,
  maxHttpBufferSize: 1e8 // 100 MB for larger file transfers
});

var records = new Map();
const usersToUniquedID = new Map();
const uniqueIdTousers = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);
  
  // Send immediate acknowledgment
  socket.emit("connection_ack", { 
    status: "connected",
    socketId: socket.id
  });
  
  socket.on("joinRoom", (temp) => {
    socket.join(Number(temp));
    records.set(socket.id, Number(temp));
    socket.emit("ack", `You have joined room ${temp}`);
  });

  socket.on("message", (temp) => {
    const roomNum = records.get(socket.id);
    io.to(roomNum).emit("roomMsg", temp);
  });

  socket.on("details", (data) => {
    try {
      var user = data.socketId;
      var uniqueId = data.uniqueId;

      console.log("Received details - Socket ID:", user, "Unique ID:", uniqueId);

      if (!user || !uniqueId) {
        console.error("Invalid details received:", data);
        return;
      }

      usersToUniquedID.set(user, uniqueId);
      uniqueIdTousers.set(uniqueId, user);
      
      // Send acknowledgment back to client
      socket.emit("details_ack", {
        status: "success",
        socketId: user,
        uniqueId: uniqueId
      });

      console.log("New User added:", user, "with ID:", uniqueId);
      
      // Log current connections
      console.log("Current connections:");
      for (let [key, value] of usersToUniquedID) {
        console.log(key + " = " + value);
      }
    } catch (error) {
      console.error("Error processing details:", error);
      socket.emit("details_error", {
        status: "error",
        message: "Failed to process connection details"
      });
    }
  });

  socket.on("send-signal", (temp) => {
    console.log(temp);
    var to = temp.to;
    var socketOfPartner = uniqueIdTousers.get(to);
    io.to(socketOfPartner).emit("signaling", {
      from: temp.from,
      signalData: temp.signalData,
      to: temp.to,
    });
    // io.emit("receive-signal",temp)
  });

  socket.on("accept-signal", (temp) => {
    console.log(temp);
    var to = temp.to;
    var socketOfPartner = uniqueIdTousers.get(to);
    console.log(socketOfPartner);
    io.to(socketOfPartner).emit("callAccepted", {
      signalData: temp.signalData,
      to: temp.to,
    });
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    const uniqueId = usersToUniquedID.get(socket.id);
    if (uniqueId) {
      usersToUniquedID.delete(socket.id);
      uniqueIdTousers.delete(uniqueId);
      console.log("User removed:", socket.id);
    }
  });
});

// Handle server errors
io.on("connect_error", (error) => {
  console.error("Connection error:", error);
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
