const { MongoClient, ServerApiVersion } = require("mongodb");

let client;
let db;

async function connectDB() {
  if (db) {
    return db;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("MONGODB_URI environment variable is required");
  }

  client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    },
  });

  await client.connect();
  await client.db("admin").command({ ping: 1 });

  db = client.db(process.env.MONGODB_DB_NAME || "routego");
  console.log("✅ Successfully connected to MongoDB");

  return db;
}

function getDB() {
  if (!db) {
    throw new Error("Database not connected. Call connectDB() first.");
  }

  return db;
}

function getCollection(name) {
  return getDB().collection(name);
}

module.exports = { connectDB, getDB, getCollection };
