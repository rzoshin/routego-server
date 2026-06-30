const express = require("express");
const { getCollection } = require("../db");
const { verifyToken, requireSelfOrAdmin } = require("../middleware/auth");

const router = express.Router();

router.get(
  "/stats/:email",
  verifyToken,
  requireSelfOrAdmin((req) => req.params.email),
  async (req, res) => {
  try {
    const { email } = req.params;
    const ticketsCollection = getCollection("tickets");
    const bookingsCollection = getCollection("bookings");

    const tickets = await ticketsCollection
      .find({ vendorEmail: email })
      .toArray();
    const bookings = await bookingsCollection
      .find({ vendorEmail: email })
      .toArray();

    const paidBookings = bookings.filter((b) => b.bookingStatus === "paid");
    const ticketsSold = paidBookings.reduce(
      (sum, booking) => sum + (booking.quantity || 0),
      0
    );
    const totalRevenue = paidBookings.reduce(
      (sum, booking) => sum + (booking.totalPrice || 0),
      0
    );
    const pendingRequests = bookings.filter(
      (b) => b.bookingStatus === "pending"
    ).length;

    const monthlyRevenue = [];
    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - i);

      const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
      const monthEnd = new Date(
        date.getFullYear(),
        date.getMonth() + 1,
        0,
        23,
        59,
        59,
        999
      );

      const monthBookings = paidBookings.filter((booking) => {
        const created = new Date(booking.createdAt);
        return created >= monthStart && created <= monthEnd;
      });

      monthlyRevenue.push({
        month: monthStart.toLocaleString("default", {
          month: "short",
          year: "numeric",
        }),
        revenue: monthBookings.reduce(
          (sum, booking) => sum + (booking.totalPrice || 0),
          0
        ),
        ticketsSold: monthBookings.reduce(
          (sum, booking) => sum + (booking.quantity || 0),
          0
        ),
      });
    }

    res.send({
      ticketsAdded: tickets.length,
      ticketsSold,
      totalRevenue,
      pendingRequests,
      monthlyRevenue,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch vendor stats" });
  }
});

module.exports = router;
