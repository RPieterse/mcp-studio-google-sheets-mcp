import type { Row, SheetsApi, ToolResult } from "./types.js";

export interface ToolContext {
  api: SheetsApi;
  defaultShareEmail: string;
  /** The service-account identity that creates / owns every sheet this MCP
   *  makes. Surfaced in create_sheet output so the caller can see exactly
   *  which account they need to share the file with manually (or who to
   *  grant access to a Drive folder, etc.) if the auto-share didn't land
   *  on the right user. */
  serviceAccountEmail: string;
}

function err(text: string): ToolResult {
  return { text, isError: true };
}

function ok(text: string): ToolResult {
  return { text };
}

function isRowArray(v: unknown): v is Row[] {
  return Array.isArray(v) && v.every((r) => Array.isArray(r));
}

export async function handleTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "create_sheet":
        return await createSheet(args, ctx);
      case "append_rows":
        return await appendRows(args, ctx);
      case "update_range":
        return await updateRange(args, ctx);
      case "read_range":
        return await readRange(args, ctx);
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return err(`${name} failed: ${msg}`);
  }
}

async function createSheet(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const title = typeof args.title === "string" ? args.title.trim() : "";
  if (!title) return err("title is required");

  const headers = Array.isArray(args.headers)
    ? (args.headers as unknown[]).map((h) => String(h))
    : undefined;

  const explicitShare =
    typeof args.share_with_email === "string" && args.share_with_email.trim()
      ? args.share_with_email.trim()
      : undefined;
  const trimmedDefault = ctx.defaultShareEmail.trim();
  const shareEmail = explicitShare ?? (trimmedDefault ? trimmedDefault : undefined);

  const result = await ctx.api.createSpreadsheet({
    title,
    headers,
    share_with_email: explicitShare,
  });

  // Try the share but DON'T let a share failure tank the whole call —
  // the sheet was created successfully, the caller just needs to know
  // whether they can actually access it. Surface the outcome either way.
  let shareStatus: string;
  if (shareEmail) {
    try {
      await ctx.api.shareSpreadsheet(result.spreadsheet_id, shareEmail);
      shareStatus = `shared with: ${shareEmail} (writer)`;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      shareStatus = `share to ${shareEmail} FAILED: ${msg}`;
    }
  } else {
    shareStatus =
      "shared with: (none — no GOOGLE_USER_EMAIL configured and no share_with_email argument provided)";
  }

  // Always print the owner (service account email) so the user can see
  // which identity will be listed as the file owner in Drive — useful when
  // diagnosing "why does my colleague's account see this but mine doesn't".
  const lines = [
    `Created spreadsheet "${result.title}".`,
    `spreadsheet_id: ${result.spreadsheet_id}`,
    `url: ${result.url}`,
    `owner: ${ctx.serviceAccountEmail} (service account)`,
    shareStatus,
  ];
  return ok(lines.join("\n"));
}

async function appendRows(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const spreadsheet_id =
    typeof args.spreadsheet_id === "string" ? args.spreadsheet_id : "";
  if (!spreadsheet_id) return err("spreadsheet_id is required");
  if (!isRowArray(args.values))
    return err("values must be an array of rows (array of arrays)");

  const sheet_name =
    typeof args.sheet_name === "string" && args.sheet_name
      ? args.sheet_name
      : undefined;

  const { updated_rows } = await ctx.api.appendRows({
    spreadsheet_id,
    values: args.values,
    sheet_name,
  });
  return ok(`Appended ${updated_rows} row(s) to ${spreadsheet_id}.`);
}

async function updateRange(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const spreadsheet_id =
    typeof args.spreadsheet_id === "string" ? args.spreadsheet_id : "";
  if (!spreadsheet_id) return err("spreadsheet_id is required");
  const range = typeof args.range === "string" ? args.range : "";
  if (!range) return err("range is required (e.g. 'Sheet1!A1:B2')");
  if (!isRowArray(args.values))
    return err("values must be an array of rows (array of arrays)");

  const { updated_cells } = await ctx.api.updateRange({
    spreadsheet_id,
    range,
    values: args.values,
  });
  return ok(`Updated ${updated_cells} cell(s) in ${range}.`);
}

async function readRange(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const spreadsheet_id =
    typeof args.spreadsheet_id === "string" ? args.spreadsheet_id : "";
  if (!spreadsheet_id) return err("spreadsheet_id is required");
  const range = typeof args.range === "string" ? args.range : "";
  if (!range) return err("range is required");

  const result = await ctx.api.readRange({ spreadsheet_id, range });
  return ok(JSON.stringify(result, null, 2));
}
