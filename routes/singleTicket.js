const express = require("express");
const { ObjectId } = require("mongodb");
const { getCollection } = require("../db");

const router = express.Router();

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ticketsCollection = getCollection("tickets");

    if (!ObjectId.isValid(id)) {
      return res.status(400).send({ message: "Invalid ticket ID" });
    }

    const result = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!result) {
      return res.status(404).send({ message: "Ticket not found" });
    }

    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: "Failed to fetch ticket" });
  }
});

module.exports = router;
