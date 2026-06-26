const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");

const router = express.Router();

function normalizeUserPayload(body, existingUser = null) {
  return {
    name: body.name ?? existingUser?.name ?? "",
    email: body.email,
    role: body.role ?? existingUser?.role ?? "user",
    image: body.image ?? existingUser?.image ?? null,
    isFraud: existingUser?.isFraud ?? false,
    createdAt: existingUser?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
}

// Upsert user (email/password or Google sign-up sync)
router.post("/", async (req, res) => {
  try {
    const usersCollection = getCollection("users");
    const user = req.body;

    if (!user?.email) {
      return res.status(400).send({ message: "Email is required" });
    }

    const existingUser = await usersCollection.findOne({ email: user.email });

    if (existingUser) {
      const updatedFields = normalizeUserPayload(user, existingUser);
      delete updatedFields.createdAt;

      await usersCollection.updateOne(
        { email: user.email },
        { $set: updatedFields }
      );

      return res.send({
        success: true,
        message: "User synced",
        matchedCount: 1,
      });
    }

    const result = await usersCollection.insertOne(normalizeUserPayload(user));

    res.send({
      success: true,
      insertedId: result.insertedId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to create user" });
  }
});

// List all users (admin — JWT protection added in Phase 7)
router.get("/", async (_req, res) => {
  try {
    const usersCollection = getCollection("users");
    const users = await usersCollection
      .find({}, { projection: { password: 0 } })
      .toArray();

    res.send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch users" });
  }
});

router.get("/:email/stats", async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = getCollection("users");
    const bookingsCollection = getCollection("bookings");
    const ticketsCollection = getCollection("tickets");

    const user = await usersCollection.findOne(
      { email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    if (user.role === "user") {
      const bookings = await bookingsCollection
        .find({ userEmail: email })
        .toArray();

      return res.send({
        role: "user",
        totalBookings: bookings.length,
        pending: bookings.filter((b) => b.bookingStatus === "pending").length,
        accepted: bookings.filter((b) => b.bookingStatus === "accepted").length,
        paid: bookings.filter((b) => b.bookingStatus === "paid").length,
        rejected: bookings.filter((b) => b.bookingStatus === "rejected").length,
      });
    }

    if (user.role === "vendor") {
      const tickets = await ticketsCollection
        .find({ vendorEmail: email })
        .toArray();
      const bookings = await bookingsCollection
        .find({ vendorEmail: email })
        .toArray();
      const paidBookings = bookings.filter((b) => b.bookingStatus === "paid");

      return res.send({
        role: "vendor",
        ticketsAdded: tickets.length,
        approvedTickets: tickets.filter((t) => t.verificationStatus === "approved")
          .length,
        ticketsSold: paidBookings.reduce(
          (sum, booking) => sum + (booking.quantity || 0),
          0
        ),
        pendingRequests: bookings.filter((b) => b.bookingStatus === "pending")
          .length,
        totalRevenue: paidBookings.reduce(
          (sum, booking) => sum + (booking.totalPrice || 0),
          0
        ),
      });
    }

    const allUsers = await usersCollection.countDocuments();
    const pendingTickets = await ticketsCollection.countDocuments({
      verificationStatus: "pending",
    });
    const advertisedTickets = await ticketsCollection.countDocuments({
      isAdvertised: true,
      verificationStatus: "approved",
    });

    return res.send({
      role: "admin",
      totalUsers: allUsers,
      pendingTickets,
      advertisedTickets,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user stats" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const usersCollection = getCollection("users");

    const user = await usersCollection.findOne(
      { email },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send(user);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch user profile" });
  }
});

// Update user role or fraud flag (admin — JWT protection added in Phase 7)
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { role, isFraud } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid user ID" });
    }

    const updates = { updatedAt: new Date() };

    if (role !== undefined) {
      if (!["user", "vendor", "admin"].includes(role)) {
        return res.status(400).send({ message: "Invalid role" });
      }
      updates.role = role;
    }

    if (isFraud !== undefined) {
      updates.isFraud = Boolean(isFraud);
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).send({ message: "No valid fields to update" });
    }

    const usersCollection = getCollection("users");
    const result = await usersCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    res.send({ success: true, modifiedCount: result.modifiedCount });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update user" });
  }
});

module.exports = router;
