import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { handleTool, type ToolContext } from "./tools.js";

const TOOLS = [
  {
    name: "create_sheet",
    description:
      "Create a new Google Sheet with the given title. Returns the spreadsheet_id and URL. Optionally writes header row and shares the sheet with an email address.",
    inputSchema: {
      type: "object" as const,
      properties: {
        title: { type: "string", minLength: 1, description: "Title for the new spreadsheet." },
        headers: {
          type: "array",
          items: { type: "string" },
          description: "Optional header row to write to A1.",
        },
        share_with_email: {
          type: "string",
          description:
            "Optional email to share the sheet with as writer. Defaults to the GOOGLE_USER_EMAIL configured on install.",
        },
        parent_folder_id: {
          type: "string",
          description:
            "Drive folder ID (the part of the Drive URL after /folders/). The new sheet is created INSIDE this folder. Required on personal Google projects — share the folder with the service account email as Editor first. Defaults to GOOGLE_DRIVE_FOLDER_ID configured on install.",
        },
      },
      required: ["title"],
      additionalProperties: false,
    },
  },
  {
    name: "append_rows",
    description:
      "Append rows to the bottom of a Google Sheet. Each row is an array of cell values.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string", minLength: 1 },
        values: {
          type: "array",
          items: { type: "array", items: {} },
          minItems: 1,
          description: "Array of rows. Each row is an array of cell values (string/number/boolean).",
        },
        sheet_name: {
          type: "string",
          description: "Tab name within the spreadsheet. Defaults to the first sheet.",
        },
      },
      required: ["spreadsheet_id", "values"],
      additionalProperties: false,
    },
  },
  {
    name: "update_range",
    description:
      "Write values to an A1-notation range (e.g. 'Sheet1!A1:C3'). Overwrites existing cells.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string", minLength: 1 },
        range: { type: "string", minLength: 1, description: "A1 range, e.g. 'Sheet1!A1:C3'." },
        values: {
          type: "array",
          items: { type: "array", items: {} },
          minItems: 1,
        },
      },
      required: ["spreadsheet_id", "range", "values"],
      additionalProperties: false,
    },
  },
  {
    name: "read_range",
    description: "Read values from an A1-notation range.",
    inputSchema: {
      type: "object" as const,
      properties: {
        spreadsheet_id: { type: "string", minLength: 1 },
        range: { type: "string", minLength: 1 },
      },
      required: ["spreadsheet_id", "range"],
      additionalProperties: false,
    },
  },
];

export function createServer(ctx: ToolContext): Server {
  const server = new Server(
    { name: "google-sheets", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const args = (req.params.arguments ?? {}) as Record<string, unknown>;
    const result = await handleTool(req.params.name, args, ctx);
    return {
      content: [{ type: "text" as const, text: result.text }],
      isError: result.isError ?? false,
    };
  });

  return server;
}
