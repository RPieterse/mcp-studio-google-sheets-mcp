# Google Sheets MCP

An MCP server for [MCP Studio](https://github.com/anthropics/mcp-widget) (or any MCP-compatible host) that lets an agent **create, read, and modify Google Sheets**. Auth is a Google service account — no OAuth dance, no client secret.

Typical use:

> "Look at hacker news, then create a Google Sheet called *Top Stories* with the top 10 stories. Send me the link."

The agent calls `chrome.fetch` (or any browser MCP) to scrape, then this MCP's `create_sheet` + `append_rows`, and replies with the spreadsheet URL.

## Tools

| Tool | What it does |
|---|---|
| `create_sheet(title, headers?, share_with_email?)` | Creates a new spreadsheet; optionally writes a header row and shares with an email as writer. Returns `spreadsheet_id` + `url`. |
| `append_rows(spreadsheet_id, values, sheet_name?)` | Appends rows to the bottom of a tab. `values` is `string[][]`. |
| `update_range(spreadsheet_id, range, values)` | Overwrites an A1 range like `Sheet1!A1:C3`. |
| `read_range(spreadsheet_id, range)` | Reads an A1 range; returns JSON. |

## Setup — one-time, ~5 minutes

You need a Google service account so this MCP can talk to the Sheets API on your behalf.

1. **Create a Google Cloud project** (skip if you have one):
   https://console.cloud.google.com/projectcreate
2. **Enable the APIs** in that project:
   - [Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com)
   - [Google Drive API](https://console.cloud.google.com/apis/library/drive.googleapis.com) (needed to share the created sheet with you)
3. **Create a service account**:
   - https://console.cloud.google.com/iam-admin/serviceaccounts
   - Click **Create service account**, give it any name (e.g. `mcp-sheets`), skip the optional role/access steps, click **Done**.
4. **Generate a JSON key**:
   - Open the new service account → **Keys** tab → **Add key → Create new key → JSON**.
   - A `.json` file downloads. Open it; you'll paste the full contents into MCP Studio next.

## Install in MCP Studio

From the prompt panel:

```
/install /Users/you/Development/google-sheets-mcp
```

Studio will prompt for two fields:

- **Service account JSON** — paste the entire contents of the key file from step 4.
- **Your Google email** — the address newly-created sheets will be shared with as a writer (so they show up in your Drive).

That's it. Run `/tools google-sheets` to see the catalog or just say "create a new sheet called …" to your agent.

## Notes on ownership

Service accounts are separate Google identities, so:

- Sheets are **created** owned by the service account.
- They are **automatically shared** with the email you provided at install time, as a *writer*. You'll see them under "Shared with me" in Drive — drag to "My Drive" if you want them mixed with your own files.
- If you need a sheet you already own to be writable by this MCP, share it manually with the service account's `client_email` (visible in the JSON key file).

## Local development

```bash
npm install
npm run build
npm test
```

To iterate against Studio without reinstalling:

```bash
npx tsc --watch    # in one terminal
```

Studio re-reads the manifest and respawns the server on each tool call, so saved code is picked up live.

## Permissions declared

```
network: sheets.googleapis.com, www.googleapis.com, oauth2.googleapis.com
secrets: gsheets_credentials
```

No filesystem access. The service account key never leaves the OS keychain; this MCP only sees it via `process.env` at spawn time.
