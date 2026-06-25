const express = require("express");
const { getCollection } = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const data = req.body;
    const usersCollection = getCollection("users");
    const ticketsCollection = getCollection("tickets");

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

router.get("/", async (req, res) => {
  try {
    const { search, transportType, location, from, to } = req.query;
    const ticketsCollection = getCollection("tickets");

    const query = {};

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

    const result = await ticketsCollection.find(query).toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch tickets" });
  }
});

router.get("/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const ticketsCollection = getCollection("tickets");

    const result = await ticketsCollection.find({ vendorEmail: email }).toArray();

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch tickets" });
  }
});

module.exports = router;
