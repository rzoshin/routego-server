const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");
const { isDeparturePassed } = require("../lib/parseDepartureDateTime");

const router = express.Router();

function createMockTransactionId() {
  const suffix = Math.random().toString(36).slice(2, 10);
  return `txn_test_${Date.now()}_${suffix}`;
}

router.post("/complete", async (req, res) => {
  try {
    const { bookingId, userEmail, transactionId: stripeTransactionId } = req.body;
    const bookingsCollection = getCollection("bookings");
    const ticketsCollection = getCollection("tickets");
    const transactionsCollection = getCollection("transactions");

    if (!bookingId || !ObjectId.isValid(bookingId)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    if (!userEmail) {
      return res.status(400).send({ message: "User email is required" });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking) {
      return res.status(404).send({ message: "Booking not found" });
    }

    if (booking.userEmail !== userEmail) {
      return res.status(403).send({ message: "Unauthorized payment attempt" });
    }

    if (booking.bookingStatus === "paid") {
      return res.send({
        success: true,
        message: "Booking is already paid",
        bookingId: String(bookingId),
        transactionId: booking.transactionId,
        amount: booking.totalPrice,
        ticketTitle: booking.ticketTitle,
        quantity: booking.quantity,
        paidAt: booking.paidAt,
        bookingStatus: "paid",
        paymentStatus: "paid",
      });
    }

    if (booking.bookingStatus !== "accepted") {
      return res.status(400).send({
        message: "Only accepted bookings can be paid",
      });
    }

    if (
      isDeparturePassed(booking.departureDate, booking.departureTime)
    ) {
      return res.status(400).send({
        message: "Payment unavailable — departure time has passed",
      });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(booking.ticketId),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    if ((ticket.quantity || 0) < (booking.quantity || 0)) {
      return res.status(400).send({ message: "Not enough tickets available" });
    }

    const transactionId =
      stripeTransactionId || createMockTransactionId();
    const paidAt = new Date();

    await bookingsCollection.updateOne(
      { _id: new ObjectId(bookingId) },
      {
        $set: {
          bookingStatus: "paid",
          paymentStatus: "paid",
          transactionId,
          paidAt,
          updatedAt: paidAt,
        },
      }
    );

    await ticketsCollection.updateOne(
      { _id: new ObjectId(booking.ticketId) },
      {
        $inc: { quantity: -(booking.quantity || 0) },
        $set: { updatedAt: paidAt },
      }
    );

    const transaction = {
      userEmail: booking.userEmail,
      userName: booking.userName,
      bookingId: String(bookingId),
      ticketId: booking.ticketId,
      ticketTitle: booking.ticketTitle,
      amount: booking.totalPrice,
      transactionId,
      paymentStatus: "paid",
      paidAt,
      createdAt: paidAt,
    };

    await transactionsCollection.insertOne(transaction);

    res.send({
      success: true,
      bookingId: String(bookingId),
      transactionId,
      amount: booking.totalPrice,
      ticketTitle: booking.ticketTitle,
      quantity: booking.quantity,
      paidAt,
      bookingStatus: "paid",
      paymentStatus: "paid",
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Payment failed" });
  }
});

router.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const transactionsCollection = getCollection("transactions");

    const result = await transactionsCollection
      .find({ userEmail: email })
      .sort({ paidAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch transactions" });
  }
});

router.get("/verify/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const bookingsCollection = getCollection("bookings");

    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).send({ message: "Invalid booking ID" });
    }

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId),
    });

    if (!booking || booking.bookingStatus !== "paid") {
      return res.status(404).send({ message: "Paid booking not found" });
    }

    res.send({
      ticketTitle: booking.ticketTitle,
      userEmail: booking.userEmail,
      quantity: booking.quantity,
      amount: booking.totalPrice,
      transactionId: booking.transactionId,
      paidAt: booking.paidAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to verify payment" });
  }
});

module.exports = router;
