-- Run this BEFORE `pnpm migration:up` when upgrading to the unique-per-user token schema.
-- It deletes all ClientSession rows so the new @@unique([discordUserId]) constraint applies cleanly.
-- Users will need to re-run /client to get a new token.
DELETE FROM ClientSession;
