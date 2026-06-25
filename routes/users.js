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
