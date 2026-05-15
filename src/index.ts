#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { createSheetsApi } from "./sheets.js";
import { parseServiceAccountJson } from "./credentials.js";

const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON ?? "";
const defaultShareEmail = (process.env.GOOGLE_USER_EMAIL ?? "").trim();
const defaultParentFolderId = (process.env.GOOGLE_DRIVE_FOLDER_ID ?? "").trim();

let api;
let serviceAccountEmail = "";
try {
  const creds = parseServiceAccountJson(raw);
  api = createSheetsApi(creds);
  serviceAccountEmail = creds.client_email;
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[google-sheets-mcp] credential error: ${msg}`);
  process.exit(1);
}

const server = createServer({
  api,
  defaultShareEmail,
  serviceAccountEmail,
  defaultParentFolderId,
});
const transport = new StdioServerTransport();
await server.connect(transport);
