# RouteGo Server

Express API for the RouteGo ticket booking platform. Deploy as a separate Vercel project alongside `routego-client`.

## Local development

```bash
cd routego-server
cp .env.example .env
# Edit .env with your MongoDB URI and CLIENT_URL
npm install
npm run dev
```

API runs at `http://localhost:8000` by default.

## Environment variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB Atlas connection string |
| `MONGODB_DB_NAME` | Database name (default: `routego`) |
| `PORT` | Local port (default: `8000`) |
| `CLIENT_URL` | Frontend origin for CORS (e.g. `http://localhost:3000` or your Vercel client URL) |

## Deploy to Vercel

1. Create a new Vercel project from the `routego-server` directory.
2. Set environment variables in the Vercel dashboard (`MONGODB_URI`, `MONGODB_DB_NAME`, `CLIENT_URL`).
3. Deploy — `vercel.json` routes all requests through `api/index.js` (serverless Express).

After deploy, set `NEXT_PUBLIC_API_URL` on the client to your server Vercel URL (e.g. `https://routego-server.vercel.app`).

## API routes

- `GET /health` — health check
- `/api/users` — user management
- `/api/tickets` — tickets (public, vendor, admin)
- `/api/bookings` — bookings
- `/api/payments` — mock payment completion & transactions
- `/api/vendor` — vendor stats
- `/api/single-ticket/:id` — single ticket details
