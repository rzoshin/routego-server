const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    const db = client.db("routego");

    const usersCollection = db.collection("users");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    const transactionsCollection = db.collection("transactions");

    // =========================
    // USERS
    // =========================

    app.post("/api/users", async (req, res) => {
      try {
        const user = req.body;

        if (!user?.email) {
          return res.status(400).send({
            message: "Email is required",
          });
        }

        const existingUser = await usersCollection.findOne({
          email: user.email,
        });

        if (existingUser) {
          return res.send({
            success: true,
            message: "User already exists",
          });
        }

        const result = await usersCollection.insertOne(user);

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to create user",
        });
      }
    });

    // =========================
    // ADD TICKET
    // =========================

    app.post("/api/tickets", async (req, res) => {
      try {
        const data = req.body;

        const vendor = await usersCollection.findOne({
          email: data?.vendorEmail,
        });

        if (!vendor) {
          return res.status(404).send({
            message: "Vendor not found",
          });
        }

        const ticketData = {
          ...data,
          bookedSeats: 0,
          createdAt: new Date(),
        };

        const result = await ticketsCollection.insertOne(
          ticketData
        );

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to create ticket",
        });
      }
    });

    // =========================
    // GET ALL TICKETS
    // =========================

    app.get("/api/tickets", async (req, res) => {
      try {
        const search = req.query.search;
        const transportType =
          req.query.transportType;
        const from = req.query.location;
        const to = req.query.to;

        const query = {};

        if (search) {
          query.title = {
            $regex: search,
            $options: "i",
          };
        }

        if (transportType) {
          query.transportType = {
            $in: transportType.split(","),
          };
        }

        if (from) {
          query.from = from;
        }

        if (to) {
          query.to = to;
        }

        const result =
          await ticketsCollection.find(query).toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to fetch tickets",
        });
      }
    });

    // =========================
    // GET VENDOR TICKETS
    // =========================

    app.get("/api/tickets/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const result =
          await ticketsCollection
            .find({
              vendorEmail: email,
            })
            .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to fetch tickets",
        });
      }
    });

    // =========================
    // SINGLE TICKET
    // =========================

    app.get("/api/single-ticket/:id", async (req, res) => {
      try {
        const { id } = req.params;

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({
            message: "Invalid ticket ID",
          });
        }

        const result =
          await ticketsCollection.findOne({
            _id: new ObjectId(id),
          });

        if (!result) {
          return res.status(404).send({
            message: "Ticket not found",
          });
        }

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to fetch ticket",
        });
      }
    });

    // =========================
    // CREATE BOOKING
    // =========================

    app.post("/api/bookings", async (req, res) => {
      try {
        const booking = req.body;

        if (
          !booking?.quantity ||
          booking.quantity <= 0
        ) {
          return res.status(400).send({
            message: "Invalid quantity",
          });
        }

        if (
          !booking.ticketId ||
          !ObjectId.isValid(booking.ticketId)
        ) {
          return res.status(400).send({
            message: "Invalid ticket ID",
          });
        }

        const ticket =
          await ticketsCollection.findOne({
            _id: new ObjectId(
              booking.ticketId
            ),
          });

        if (!ticket) {
          return res.status(404).send({
            message: "Ticket not found",
          });
        }

        const bookedSeats =
          ticket.bookedSeats || 0;

        const availableSeats =
          ticket.quantity - bookedSeats;

        if (
          booking.quantity > availableSeats
        ) {
          return res.status(400).send({
            message:
              "Not enough seats available",
          });
        }

        const bookingResult =
          await bookingsCollection.insertOne({
            ...booking,
            createdAt: new Date(),
          });

        await ticketsCollection.updateOne(
          {
            _id: new ObjectId(
              booking.ticketId
            ),
          },
          {
            $inc: {
              bookedSeats:
                booking.quantity,
            },
          }
        );

        res.send({
          success: true,
          insertedId:
            bookingResult.insertedId,
        });
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Booking failed",
        });
      }
    });

    // =========================
    // GET BOOKING DATA
    // =========================
    app.get("/api/bookings/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const result =
          await bookingsCollection
            .find({
              userEmail: email,
            })
            .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to fetch bookings",
        });
      }
    });

    // =========================
    // GET BOOKING DATA FOR VENDOR
    // =========================
    app.get("/api/bookings/vendor/:email", async (req, res) => {
      try {
        const { email } = req.params;

        const result =
          await bookingsCollection
            .find({
              vendorEmail: email,
            })
            .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);

        res.status(500).send({
          message: "Failed to fetch bookings",
        });
      }
    });
    console.log(
      "✅ Successfully connected to MongoDB"
    );
  } catch (error) {
    console.error(error);
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("RouteGo Server Running");
});

app.listen(port, () => {
  console.log(
    `🚀 Server running on port ${port}`
  );
});