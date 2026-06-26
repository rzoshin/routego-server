const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");

const router = express.Router();

async function getReservedQuantity(ticketId) {
  const bookingsCollection = getCollection("bookings");

  const result = await bookingsCollection
    .aggregate([
      {
        $match: {
          ticketId: String(ticketId),
          bookingStatus: { $in: ["pending", "accepted", "paid"] },
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

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ticketsCollection = getCollection("tickets");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    const reserved = await getReservedQuantity(id);
    const availableSeats = Math.max(0, ticket.quantity - reserved);

    res.send({
      ...ticket,
      reservedSeats: reserved,
      availableSeats,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch ticket" });
  }
});

module.exports = router;
