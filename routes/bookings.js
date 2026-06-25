const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const booking = req.body;
    const ticketsCollection = getCollection("tickets");
    const bookingsCollection = getCollection("bookings");

    if (!booking?.quantity || booking.quantity <= 0) {
      return res.status(400).send({ message: "Invalid quantity" });
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

    const bookedSeats = ticket.bookedSeats || 0;
    const availableSeats = ticket.quantity - bookedSeats;

    if (booking.quantity > availableSeats) {
      return res.status(400).send({ message: "Not enough seats available" });
    }

    const bookingResult = await bookingsCollection.insertOne({
      ...booking,
      bookingStatus: booking.bookingStatus ?? "pending",
      paymentStatus: booking.paymentStatus ?? "pending",
      createdAt: new Date(),
    });

    await ticketsCollection.updateOne(
      { _id: new ObjectId(booking.ticketId) },
      { $inc: { bookedSeats: booking.quantity } }
    );

    res.send({
      success: true,
      insertedId: bookingResult.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Booking failed" });
  }
});

router.get("/vendor/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const bookingsCollection = getCollection("bookings");

    const result = await bookingsCollection.find({ vendorEmail: email }).toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const bookingsCollection = getCollection("bookings");

    const result = await bookingsCollection.find({ userEmail: email }).toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch bookings" });
  }
});

module.exports = router;
