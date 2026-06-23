const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

dotenv.config();
const app = express()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    const db = client.db("routego");
    const usersCollection = db.collection("user");
    const ticketsCollection = db.collection("tickets");
    const bookingsCollection = db.collection("bookings");
    const transactionsCollection = db.collection("transactions");

    app.post('/api/users', async (req, res) => {
      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post('/api/tickets', async (req, res) => {
      const ticketData = {
  ...data,
  bookedSeats: 0,
};
      // console.log(data);
      const vendor = await usersCollection.findOne({ email: data?.vendorEmail });
      const vendorTicketCounts = await ticketsCollection.countDocuments({
        vendorEmail: data?.vendorEmail,
      });
  
      const result = await ticketsCollection.insertOne(ticketData);
      // console.log(result);

      res.send(result);
    });
    
    app.get('/api/tickets/:email', async (req, res) => {
      const { email } = req.params;
      // console.log(email);

      const result = await ticketsCollection.find({ vendorEmail: email }).toArray();
      res.send(result);
    });

    app.get('/api/tickets', async (req, res) => {
      const search = req.query.search;
      const transportType = req.query.transportType;
      const from = req.query.location;
      const to = req.query.to;
      const query = {}; // {title: "mern"}
      if (search) {
        query.title = {
          $regex: search,
          $options: 'i', // upper lower matter korbe na
        };
      }
      if (transportType) {
        // query.category = category;
        // ?category=Music,Tech,Digial
        // console.log(category, category.split(',')); ["Music", "Tech", "Digital"]

        query.transportType = { $in: transportType.split(',') };
      }
      if (from) {
        query.from = from;
      }
      if (to) {
        query.to = to;
      }

      const cursor = ticketsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get('/api/single-ticket/:id', async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await ticketsCollection.findOne(query);
      res.send(result);
    });

    app.post('/api/bookings', async (req, res) => {
    try {
    const booking = req.body;

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(booking.ticketId),
    });

    if (!ticket) {
      return res.status(404).send({
        message: "Ticket not found",
      });
    }

    const bookedSeats = ticket.bookedSeats || 0;

    const availableSeats =
      ticket.quantity - bookedSeats;

    if (booking.quantity > availableSeats) {
      return res.status(400).send({
        message: "Not enough seats available",
      });
    }

    // Create booking
    const bookingResult =
      await bookingsCollection.insertOne(booking);

    // Update booked seats
    await ticketsCollection.updateOne(
      {
        _id: new ObjectId(booking.ticketId),
      },
      {
        $inc: {
          bookedSeats: booking.quantity,
        },
      }
    );

    res.send({
      success: true,
      insertedId: bookingResult.insertedId,
    });
  } catch (error) {
    console.error(error);

    res.status(500).send({
      message: "Booking failed",
    });
  }
    });

    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})