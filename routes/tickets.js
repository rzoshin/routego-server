const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");
const {
  verifyToken,
  requireRole,
  requireSelfOrAdmin,
  requireTicketOwnerOrAdmin,
  normalizeEmail,
} = require("../middleware/auth");

const router = express.Router();

async function getFraudVendorEmails() {
  const usersCollection = getCollection("users");
  const fraudVendors = await usersCollection
    .find({ isFraud: true }, { projection: { email: 1 } })
    .toArray();

  return fraudVendors.map((vendor) => vendor.email);
}

function buildPublicTicketQuery(req, fraudEmails) {
  const { search, transportType, location, from, to, date } = req.query;

  const query = {
    verificationStatus: "approved",
    vendorEmail: { $nin: fraudEmails },
  };

  if (search) {
    query.title = { $regex: search, $options: "i" };
  }

  if (transportType) {
    query.transportType = { $in: transportType.split(",") };
  }

  const fromLocation = from || location;
  if (fromLocation) {
    query.from = fromLocation;
  }

  if (to) {
    query.to = to;
  }

  if (date) {
    query.departureDate = date;
  }

  return query;
}

router.post("/", verifyToken, requireRole("vendor"), async (req, res) => {
  try {
    const data = req.body;
    const usersCollection = getCollection("users");
    const ticketsCollection = getCollection("tickets");

    if (
      data?.vendorEmail &&
      normalizeEmail(data.vendorEmail) !== normalizeEmail(req.auth.email)
    ) {
      return res.status(403).send({ message: "Forbidden" });
    }

    const vendor = await usersCollection.findOne({ email: data?.vendorEmail });

    if (!vendor) {
      return res.status(404).send({ message: "Vendor not found" });
    }

    if (vendor.isFraud) {
      return res.status(403).send({ message: "Fraud-flagged vendors cannot add tickets" });
    }

    const ticketData = {
      ...data,
      bookedSeats: data.bookedSeats ?? 0,
      verificationStatus: data.verificationStatus ?? "pending",
      isAdvertised: data.isAdvertised ?? false,
      createdAt: new Date(),
    };

    const result = await ticketsCollection.insertOne(ticketData);

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to create ticket" });
  }
});

router.get("/featured", async (_req, res) => {
  try {
    const ticketsCollection = getCollection("tickets");
    const fraudEmails = await getFraudVendorEmails();

    const tickets = await ticketsCollection
      .find({
        verificationStatus: "approved",
        isAdvertised: true,
        vendorEmail: { $nin: fraudEmails },
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(6)
      .toArray();

    res.send(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch featured tickets" });
  }
});

router.get("/latest", async (_req, res) => {
  try {
    const ticketsCollection = getCollection("tickets");
    const fraudEmails = await getFraudVendorEmails();

    const tickets = await ticketsCollection
      .find({
        verificationStatus: "approved",
        vendorEmail: { $nin: fraudEmails },
      })
      .sort({ createdAt: -1 })
      .limit(8)
      .toArray();

    res.send(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch latest tickets" });
  }
});

router.get("/admin/all", verifyToken, requireRole("admin"), async (_req, res) => {
  try {
    const ticketsCollection = getCollection("tickets");

    const tickets = await ticketsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.send(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch tickets" });
  }
});

router.get("/admin/approved", verifyToken, requireRole("admin"), async (_req, res) => {
  try {
    const ticketsCollection = getCollection("tickets");

    const tickets = await ticketsCollection
      .find({ verificationStatus: "approved" })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(tickets);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch approved tickets" });
  }
});

router.patch("/:id/verification", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const ticketsCollection = getCollection("tickets");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).send({ message: "Invalid verification status" });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    const updates = {
      verificationStatus: status,
      updatedAt: new Date(),
    };

    if (status === "rejected") {
      updates.isAdvertised = false;
    }

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updates }
    );

    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
      verificationStatus: status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update verification status" });
  }
});

router.patch("/:id/advertise", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { isAdvertised } = req.body;
    const ticketsCollection = getCollection("tickets");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    if (typeof isAdvertised !== "boolean") {
      return res.status(400).send({ message: "isAdvertised must be a boolean" });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!ticket) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    if (ticket.verificationStatus !== "approved") {
      return res.status(400).send({
        message: "Only approved tickets can be advertised",
      });
    }

    if (isAdvertised && !ticket.isAdvertised) {
      const advertisedCount = await ticketsCollection.countDocuments({
        isAdvertised: true,
        verificationStatus: "approved",
      });

      if (advertisedCount >= 6) {
        return res.status(400).send({
          message: "Cannot advertise more than 6 tickets at a time",
        });
      }
    }

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          isAdvertised,
          updatedAt: new Date(),
        },
      }
    );

    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
      isAdvertised,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update advertise status" });
  }
});

router.get(
  "/vendor/:email",
  verifyToken,
  requireSelfOrAdmin((req) => req.params.email),
  async (req, res) => {
  try {
    const { email } = req.params;
    const ticketsCollection = getCollection("tickets");

    const result = await ticketsCollection
      .find({ vendorEmail: email })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch vendor tickets" });
  }
});

router.patch(
  "/:id",
  verifyToken,
  requireTicketOwnerOrAdmin,
  async (req, res) => {
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

    if (ticket.verificationStatus === "rejected") {
      return res.status(403).send({
        message: "Rejected tickets cannot be updated",
      });
    }

    const {
      verificationStatus,
      isAdvertised,
      vendorEmail,
      vendorName,
      vendorId,
      bookedSeats,
      createdAt,
      image,
      ...updates
    } = req.body;

    const result = await ticketsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );

    res.send({
      success: true,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to update ticket" });
  }
});

router.delete(
  "/:id",
  verifyToken,
  requireTicketOwnerOrAdmin,
  async (req, res) => {
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

    if (ticket.verificationStatus === "rejected") {
      return res.status(403).send({
        message: "Rejected tickets cannot be deleted",
      });
    }

    const result = await ticketsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send({
      success: true,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to delete ticket" });
  }
});

router.get("/", async (req, res) => {
  try {
    const ticketsCollection = getCollection("tickets");
    const fraudEmails = await getFraudVendorEmails();
    const query = buildPublicTicketQuery(req, fraudEmails);

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(9, Math.max(6, parseInt(req.query.limit, 10) || 6));
    const skip = (page - 1) * limit;

    const sortParam = req.query.sort;
    let sort = { createdAt: -1 };
    if (sortParam === "price_asc") {
      sort = { price: 1 };
    } else if (sortParam === "price_desc") {
      sort = { price: -1 };
    }

    const total = await ticketsCollection.countDocuments(query);
    const tickets = await ticketsCollection
      .find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .toArray();

    res.send({
      tickets,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch tickets" });
  }
});

module.exports = router;
