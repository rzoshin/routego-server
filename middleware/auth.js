const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");

const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";
const JWKS = createRemoteJWKSet(new URL(`${clientUrl}/api/auth/jwks`));

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isAdmin(auth) {
  return auth?.role === "admin";
}

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const token = authHeader.slice(7);

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: clientUrl,
      audience: clientUrl,
    });

    const email = payload.email;
    const role = payload.role;

    if (!email || !role) {
      return res.status(401).send({ message: "Invalid token" });
    }

    if (payload.isBlocked) {
      return res.status(403).send({ message: "Account is blocked" });
    }

    req.auth = {
      sub: payload.sub,
      email: String(email),
      role: String(role),
      isBlocked: Boolean(payload.isBlocked),
      name: payload.name ? String(payload.name) : "",
    };

    return next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);
    return res.status(401).send({ message: "Unauthorized" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    if (!roles.includes(req.auth.role)) {
      return res.status(403).send({ message: "Forbidden" });
    }

    return next();
  };
}

function requireSelfOrAdmin(getEmail) {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const targetEmail = normalizeEmail(
      typeof getEmail === "function" ? getEmail(req) : getEmail
    );
    const authEmail = normalizeEmail(req.auth.email);

    if (isAdmin(req.auth) || authEmail === targetEmail) {
      return next();
    }

    return res.status(403).send({ message: "Forbidden" });
  };
}

async function requireBookingAccess(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const bookingsCollection = getCollection("bookings");
    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    const authEmail = normalizeEmail(req.auth.email);

    if (
      isAdmin(req.auth) ||
      normalizeEmail(booking.userEmail) === authEmail ||
      normalizeEmail(booking.vendorEmail) === authEmail
    ) {
      req.booking = booking;
      return next();
    }

    return res.status(403).send({ message: "Forbidden" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Failed to authorize booking access" });
  }
}

async function requireTicketOwnerOrAdmin(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    if (isAdmin(req.auth)) {
      return next();
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    const ticketsCollection = getCollection("tickets");
    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    if (
      req.auth.role === "vendor" &&
      normalizeEmail(ticket.vendorEmail) === normalizeEmail(req.auth.email)
    ) {
      return next();
    }

    return res.status(403).send({ message: "Forbidden" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Failed to authorize ticket access" });
  }
}

async function requireBookingVendorOrAdmin(req, res, next) {
  try {
    if (!req.auth) {
      return res.status(401).send({ message: "Unauthorized" });
    }

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const bookingsCollection = getCollection("bookings");
    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    if (
      isAdmin(req.auth) ||
      (req.auth.role === "vendor" &&
        normalizeEmail(booking.vendorEmail) === normalizeEmail(req.auth.email))
    ) {
      req.booking = booking;
      return next();
    }

    return res.status(403).send({ message: "Forbidden" });
  } catch (error) {
    console.error(error);
    return res.status(500).send({ message: "Failed to authorize booking access" });
  }
}

module.exports = {
  verifyToken,
  requireRole,
  requireSelfOrAdmin,
  requireBookingAccess,
  requireTicketOwnerOrAdmin,
  requireBookingVendorOrAdmin,
  normalizeEmail,
  isAdmin,
};
