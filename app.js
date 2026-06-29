const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { connectDB } = require("./db");
const usersRouter = require("./routes/users");
const ticketsRouter = require("./routes/tickets");
const bookingsRouter = require("./routes/bookings");
const singleTicketRouter = require("./routes/singleTicket");
const vendorRouter = require("./routes/vendor");
const paymentsRouter = require("./routes/payments");

dotenv.config();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "http://localhost:3000",
].filter(Boolean);

function createApp() {
  const app = express();

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

  app.use("/api/users", usersRouter);
  app.use("/api/tickets", ticketsRouter);
  app.use("/api/bookings", bookingsRouter);
  app.use("/api/single-ticket", singleTicketRouter);
  app.use("/api/vendor", vendorRouter);
  app.use("/api/payments", paymentsRouter);

  return app;
}

async function initApp() {
  await connectDB();
  return createApp();
}

module.exports = { createApp, initApp };
