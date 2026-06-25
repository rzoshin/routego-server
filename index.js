const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./db");
const usersRouter = require("./routes/users");
const ticketsRouter = require("./routes/tickets");
const bookingsRouter = require("./routes/bookings");
const singleTicketRouter = require("./routes/singleTicket");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("RouteGo Server Running");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

async function start() {
  await connectDB();

  app.use("/api/users", usersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/single-ticket", singleTicketRouter);

  app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
