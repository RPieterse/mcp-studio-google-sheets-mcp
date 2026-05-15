# Google Sheets MCP

An MCP server for [MCP Studio](https://github.com/RPieterse/mcp-studio) (or any MCP-compatible host) that lets an agent **create, read, and modify Google Sheets**. Auth is a Google service account — no OAuth dance, no client secret, no app-verification process.

Typical use:

> "Look at Hacker News, then create a Google Sheet called *Top Stories* with the top 10 stories. Send me the link."

The agent uses a browser MCP (like Chrome) to scrape, then this MCP's `create_sheet` + `append_rows`, and replies with the spreadsheet URL.

---

## Tools

| Tool | What it does |
|---|---|
| `create_sheet(title, headers?, share_with_email?)` | Creates a new spreadsheet; optionally writes a header row and shares it with an email as writer. Returns `spreadsheet_id` + `url`. |
| `append_rows(spreadsheet_id, values, sheet_name?)` | Appends rows to the bottom of a tab. `values` is a 2D array of cell values. |
| `update_range(spreadsheet_id, range, values)` | Overwrites an A1-notation range like `Sheet1!A1:C3`. |
| `read_range(spreadsheet_id, range)` | Reads an A1 range and returns the values as JSON. |

### Quick commands

| Trigger | Action |
|---|---|
| `/sheet_create <title>` | Create a new sheet with the given title. |
| `/sheet_read` | Read `A1:Z100` from the most recently created sheet. |

---

## Setup — one-time, ~5 minutes

You need a Google service account so this MCP can talk to the Sheets API on your behalf.

1. **Create a Google Cloud project** (skip if you already have one):
   https://console.cloud.google.com/projectcreate

2. **Enable two APIs** in that project:
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) — needed so the MCP can share created sheets with you.

3. **Create a service account:**
   - Go to https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click **Create service account**.
   - Give it any name (e.g. `mcp-sheets`), skip the optional role/access steps, click **Done**.

4. **Generate a JSON key:**
   - Open the service account you just made → **Keys** tab → **Add key → Create new key → JSON**.
   - A `.json` file downloads. Keep it handy; you'll paste its full contents into MCP Studio in the next step.

---

## Install in MCP Studio

From the MCP Studio prompt panel:

```
/install https://github.com/RPieterse/mcp-studio-google-sheets-mcp
```

…or install from a local clone:

```
/install /path/to/mcp-studio-google-sheets-mcp
```

Studio will then prompt for two fields:

| Field | What to paste |
|---|---|
| **Service account JSON** | The entire contents of the JSON key file from step 4. |
| **Your Google email** | The Google account address that newly-created sheets will be shared with as a writer (so they show up in your Drive). |

That's it. Test it from the panel:

```
/sheet_create my first MCP-created sheet
```

…or just say *"create a new Google Sheet called inbox"* to your agent.

---

## How ownership works

Service accounts are separate Google identities, so:

- **Sheets are owned** by the service account, not by you.
- **They are automatically shared with you** (using the email from install) as a *writer*. You'll see them under **"Shared with me"** in Drive — drag to **My Drive** if you want them mixed with your own files.
- **If you need this MCP to write to a sheet you already own,** share that sheet with the service account's `client_email` (visible in the JSON key file).
- **Quota** counts against the service account's project, not your personal Google account.

If you want sheets owned by your account directly, that requires OAuth instead of a service account — see *Future work* below.

---

## Local development

```bash
git clone https://github.com/RPieterse/mcp-studio-google-sheets-mcp.git
cd mcp-studio-google-sheets-mcp
npm install
npm run build
npm test
```

To iterate against Studio without reinstalling, run a watcher in one terminal:

```bash
npx tsc --watch
```

Studio re-reads the manifest and respawns the server on each tool call, so saved code is picked up live. Manifest edits are picked up on the next `/mcp-servers` call.

### Project layout

```
src/
  index.ts        Stdio entrypoint. Reads env, builds the API client, wires the server.
  server.ts       MCP tool schema + dispatch.
  tools.ts        Pure handler functions (no Google deps — testable with a mock SheetsApi).
  sheets.ts       Real googleapis-backed SheetsApi implementation.
  credentials.ts  Parses + validates the service account JSON.
  types.ts        Shared types + the SheetsApi interface.
test/             vitest unit tests against the mock API.
widget.manifest.json    MCP Studio manifest.
```

### Tests

`npm test` runs the vitest suite. Tools and credential parsing are covered against an in-memory mock `SheetsApi`; no Google account or network is touched.

---

## Permissions declared

```
network: sheets.googleapis.com, www.googleapis.com, oauth2.googleapis.com
secrets: gsheets_credentials
```

No filesystem access. The service account JSON never leaves the OS keychain; this MCP only sees it via `process.env` at spawn time.

---

## Future work

- **OAuth flow** for user-owned sheets (requires Studio's OAuth implementation to support `client_secret`, which Google's Desktop OAuth requires even with PKCE — pending an upstream change to MCP Studio).
- **Batch update tool** (`batch_update_range`) for multi-range writes in one API call.
- **Sheet/tab management** — add new tabs, rename, delete.
- **Formatting** — bold headers, freeze first row, etc.

PRs welcome.

---

## License

MIT.
