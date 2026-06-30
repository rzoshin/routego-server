const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");
const {
  verifyToken,
  requireSelfOrAdmin,
  requireBookingAccess,
  requireBookingVendorOrAdmin,
  normalizeEmail,
} = require("../middleware/auth");

const router = express.Router();

async function getReservedQuantity(ticketId) {
  const bookingsCollection = getCollection("bookings");

  const result = await bookingsCollection
    .aggregate([
      {
        $match: {
          ticketId: String(ticketId),
          bookingStatus: { $in: ["pending", "accepted"] },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$quantity" },
        },
      },
    ])
    .toArray();

  return result[0]?.total || 0;
}

router.post("/", verifyToken, async (req, res) => {
  try {
    const booking = req.body;
    const ticketsCollection = getCollection("tickets");
    const bookingsCollection = getCollection("bookings");

    if (!booking?.quantity || booking.quantity <= 0) {
      return res.status(400).send({ message: "Invalid quantity" });
    }

    if (
      booking.userEmail &&
      normalizeEmail(booking.userEmail) !== normalizeEmail(req.auth.email)
    ) {
      return res.status(403).send({ message: "Forbidden" });
    }

    if (!booking.ticketId || !ObjectId.isValid(booking.ticketId)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(booking.ticketId),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    const reserved = await getReservedQuantity(booking.ticketId);
    const availableSeats = ticket.quantity - reserved;

    if (booking.quantity > availableSeats) {
      return res.status(400).send({ message: "Not enough seats available" });
    }

    const bookingResult = await bookingsCollection.insertOne({
      ...booking,
      ticketId: String(booking.ticketId),
      bookingStatus: booking.bookingStatus ?? "pending",
      paymentStatus: booking.paymentStatus ?? "pending",
      createdAt: new Date(),
    });

    res.send({
      success: true,
      insertedId: bookingResult.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Booking failed" });
  }
});

router.get("/id/:id", verifyToken, requireBookingAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const bookingsCollection = getCollection("bookings");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    res.send(booking);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch booking" });
  }
});

router.patch(
  "/:id/status",
  verifyToken,
  requireBookingVendorOrAdmin,
  async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const bookingsCollection = getCollection("bookings");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    if (!["accepted", "rejected"].includes(status)) {
      return res.status(400).send({ message: "Invalid booking status" });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    if (booking.bookingStatus !== "pending") {
      return res.status(400).send({
        message: "Only pending bookings can be updated",
      });
    }

    await bookingsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          bookingStatus: status,
          updatedAt: new Date(),
        },
      }
    );

    res.send({ success: true, bookingStatus: status });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update booking status" });
  }
});

router.get(
  "/vendor/:email",
  verifyToken,
  requireSelfOrAdmin((req) => req.params.email),
  async (req, res) => {
  try {
    const { email } = req.params;
    const bookingsCollection = getCollection("bookings");

    const result = await bookingsCollection
      .find({ vendorEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

router.get(
  "/:email",
  verifyToken,
  requireSelfOrAdmin((req) => req.params.email),
  async (req, res) => {
  try {
    const { email } = req.params;
    const bookingsCollection = getCollection("bookings");

    const result = await bookingsCollection
      .find({ userEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

module.exports = router;
