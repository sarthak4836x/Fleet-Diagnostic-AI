import dotenv from "dotenv";

// Imported first by server.ts so .env values exist before server/auth.ts and server/kvStore.ts read them.
dotenv.config();
