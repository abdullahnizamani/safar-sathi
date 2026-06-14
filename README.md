# SafarSathi — Carpooling Web Application & API Server

SafarSathi is a premium, dark-themed carpooling platform designed to connect drivers and passengers. This monorepo contains the web application frontend (`carpool`), the backend Express API server (`api-server`), the database schemas, and shared workspace libraries.

---

## Repository Structure

```
Attached-Assets/
├── artifacts/
│   ├── carpool/          # React Web Application (Vite + Tailwind CSS v4)
│   ├── api-server/       # Express Backend API Server (Node + TypeScript)
│   └── mockup-sandbox/   # Sandbox environment for UI component previews
├── lib/
│   ├── db/               # Shared Drizzle ORM database schemas & migrations
│   ├── api-spec/         # OpenAPI specs and configuration for schema generation
│   ├── api-client-react/ # Automatically generated React Query client hooks
│   └── api-zod/          # Zod validation schemas compiled from API spec
├── scripts/              # Build, validation, and merge scripts
├── package.json          # Root workspace configuration
└── pnpm-workspace.yaml   # Workspace packages definitions
```

---

## Features

### 🌟 Frontend Web Application (`carpool`)
- **Premium Dark-Theme & Responsive Layout**: Clean dark UI matching the mobile app's brand with glassmorphic cards and visual state indicators.
- **Ride Searching & Filtering**: Search available rides by Origin, Destination, Date, and Gender Preferences.
- **Passenger Location Sharing**: Share real-time pickup location markers with drivers using the browser Geolocation API.
- **Interactive Routing Map**: Mapbox GL integration showing routes, pickups, and destinations.
- **Driver Management Dashboard**: Drivers can accept or reject ride requests, view passenger locations on an interactive tracking map, and get turn-by-turn navigation options.
- **Review System**: Passengers can rate and comment on driver behavior after ride completion.

### ⚙️ Backend API Server (`api-server`)
- **Express & TypeScript**: Highly responsive API architecture.
- **Seat Booking Status Management**: Automatic validation and transitions (e.g. marking rides as `FULL` or `OPEN` dynamically on seat updates/restorations).
- **Supabase Cloud Storage Integration**: Handles user avatar image uploads directly to a Supabase bucket (`avatars`) with public URL resolution.
- **Location Updates Rate Limiting**: Cooldown limits on coordinate updates to safeguard against heavy GPS updates.

### 🗄️ Database Schemas & Migrations (`lib/db`)
Powered by Drizzle ORM mapping to a Supabase PostgreSQL instance:
- **`users`**: Details profiles, average ratings, genders, and Supabase cloud avatar links.
- **`rides`**: Configures origin/destination names, coordinates, departure times, total/available seats, fares, status (`OPEN`, `FULL`, `COMPLETED`, `CANCELLED`), and gender policies.
- **`ride_requests`**: Tracks requested seats, request statuses (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`), passenger phone numbers, and passenger GPS marker coordinates (`marker_lat`, `marker_lng`, `marker_updated_at`).
- **`reviews`**: Holds rating feedback stars and driver comments.

---

## Getting Started

### Prerequisites
- Node.js (v20+ recommended)
- **pnpm** (installed globally: `npm i -g pnpm`)
- Mapbox account token (for routing maps)
- Supabase account and database connection URL

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```

2. **Environment Variables Config**:
   Create a `.env` file in `artifacts/carpool/.env` and `artifacts/api-server/.env` based on your workspace needs:
   
   **For the Frontend (`carpool`)**:
   ```env
   VITE_MAPBOX_TOKEN=your_mapbox_public_token
   ```

   **For the Backend (`api-server`)**:
   ```env
   DATABASE_URL=postgresql://postgres:password@db.supabase.co:5432/postgres
   SUPABASE_URL=https://your-supabase-project.supabase.co
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Push Database Schema**:
   ```bash
   pnpm --filter @workspace/db run push
   ```

4. **Start Development Servers**:
   Run both frontend and backend development environments concurrently from the workspace root:
   ```bash
   # Start the Express API server
   pnpm --filter @workspace/api-server dev

   # Start the Vite React web app
   pnpm --filter @workspace/carpool dev
   ```

5. **TypeScript Verification**:
   Ensure all monorepo dependencies and workspaces compile cleanly:
   ```bash
   pnpm run typecheck
   ```

---

## Production Deployment (Vercel)

The codebase is configured to build and package serverless functions cleanly on Vercel:

- **Frontend**: Vite outputs static assets to `dist` which Vercel serves at edge nodes. Routing rewrites send `/api/*` requests directly to the API Server.
- **Backend API**: Uses an ESM esbuild bundler target mapping routes to a Zero-Config Express Serverless Function handler located in `api/index.js`.

---

## Dummy Test Accounts

For testing the passenger location sharing and driver tracking map integration, you can register these two dummy users:
1. **Driver**: `driver_test` (for posting a ride and viewing passenger location tracking maps)
2. **Passenger**: `passenger_test` (for requesting to join a ride and sharing location markers)
