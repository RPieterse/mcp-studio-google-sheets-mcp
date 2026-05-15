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
  /** Drive folder ID to drop newly-created sheets into. REQUIRED for
   *  service accounts in personal (non-Workspace) Google Cloud projects —
   *  those SAs have no Drive of their own, so the API rejects file
   *  creation outright. The user creates a regular Drive folder, shares
   *  it with the SA as Editor, and the SA then "creates" the sheet inside
   *  that folder (where it has explicit write permission). Empty string
   *  = no default folder; the sheet attempts to land in the SA's root,
   *  which only works for Workspace + Shared Drive setups. */
  defaultParentFolderId: string;
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
    return err(`${name} failed: ${formatGoogleError(e)}`);
  }
}

/**
 * Google APIs (via googleapis / gaxios) wrap their JSON error bodies inside
 * a thrown Error. The plain `.message` is often just "The caller does not
 * have permission" with none of the helpful detail — reason codes, the
 * project hint, the specific permission name. Pull that detail out so
 * callers see something they can act on instead of a riddle.
 */
function formatGoogleError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const base = e.message;
  // gaxios attaches { response: { status, data: { error: { code, message,
  // status, details, errors[] } } } } on the Error.
  const anyErr = e as unknown as {
    response?: {
      status?: number;
      data?: {
        error?: {
          code?: number;
          status?: string;
          message?: string;
          errors?: { reason?: string; message?: string; domain?: string }[];
          details?: unknown[];
        };
      };
    };
  };
  const gErr = anyErr.response?.data?.error;
  if (!gErr) return base;
  const lines: string[] = [];
  // The terse line first (already in base), then the structured detail.
  if (gErr.message && gErr.message !== base) lines.push(gErr.message);
  if (gErr.status) lines.push(`status: ${gErr.status}`);
  if (gErr.code !== undefined) lines.push(`code: ${gErr.code}`);
  if (anyErr.response?.status !== undefined)
    lines.push(`http: ${anyErr.response.status}`);
  if (Array.isArray(gErr.errors)) {
    for (const inner of gErr.errors) {
      const parts: string[] = [];
      if (inner.reason) parts.push(`reason=${inner.reason}`);
      if (inner.domain) parts.push(`domain=${inner.domain}`);
      if (inner.message) parts.push(inner.message);
      if (parts.length > 0) lines.push(parts.join("; "));
    }
  }
  if (Array.isArray(gErr.details) && gErr.details.length > 0) {
    // details are richly typed protobuf Any-like objects; stringify
    // so the user at least sees the metadata fields (reason, domain, etc.)
    lines.push(`details: ${JSON.stringify(gErr.details)}`);
  }
  return lines.length > 0 ? `${base}\n  ${lines.join("\n  ")}` : base;
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

  // Per-call parent_folder_id overrides the env default. Empty string is
  // treated the same as undefined so the user can blank the field to opt
  // out for a single call.
  const explicitParent =
    typeof args.parent_folder_id === "string" && args.parent_folder_id.trim()
      ? args.parent_folder_id.trim()
      : undefined;
  const parentFolderId =
    explicitParent ??
    (ctx.defaultParentFolderId ? ctx.defaultParentFolderId : undefined);

  const result = await ctx.api.createSpreadsheet({
    title,
    headers,
    share_with_email: explicitShare,
    parent_folder_id: parentFolderId,
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
    parentFolderId
      ? `parent folder: ${parentFolderId}`
      : "parent folder: (none — using service-account root, only works on Workspace + Shared Drive)",
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
