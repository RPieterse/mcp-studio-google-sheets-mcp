import { google, type sheets_v4, type drive_v3 } from "googleapis";
import type { JWT } from "google-auth-library";
import type {
  SheetsApi,
  CreateSheetInput,
  CreateSheetResult,
  AppendRowsInput,
  UpdateRangeInput,
  ReadRangeInput,
  ReadRangeResult,
} from "./types.js";
import type { ServiceAccountCredentials } from "./credentials.js";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive",
];

export function createSheetsApi(creds: ServiceAccountCredentials): SheetsApi {
  const auth: JWT = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: SCOPES,
  });
  const sheets = google.sheets({ version: "v4", auth });
  const drive = google.drive({ version: "v3", auth });
  return new GoogleSheetsApi(sheets, drive);
}

export class GoogleSheetsApi implements SheetsApi {
  constructor(
    private readonly sheets: sheets_v4.Sheets,
    private readonly drive: drive_v3.Drive,
  ) {}

  async createSpreadsheet(input: CreateSheetInput): Promise<CreateSheetResult> {
    const res = await this.sheets.spreadsheets.create({
      requestBody: { properties: { title: input.title } },
      fields: "spreadsheetId,spreadsheetUrl,properties.title",
    });
    const spreadsheet_id = res.data.spreadsheetId ?? "";
    const url = res.data.spreadsheetUrl ?? "";
    const title = res.data.properties?.title ?? input.title;
    if (!spreadsheet_id) {
      throw new Error("Google did not return a spreadsheetId");
    }
    if (input.headers && input.headers.length > 0) {
      await this.sheets.spreadsheets.values.update({
        spreadsheetId: spreadsheet_id,
        range: "A1",
        valueInputOption: "RAW",
        requestBody: { values: [input.headers] },
      });
    }
    return { spreadsheet_id, url, title };
  }

  async shareSpreadsheet(spreadsheet_id: string, email: string): Promise<void> {
    await this.drive.permissions.create({
      fileId: spreadsheet_id,
      sendNotificationEmail: false,
      requestBody: { type: "user", role: "writer", emailAddress: email },
    });
  }

  async appendRows(input: AppendRowsInput): Promise<{ updated_rows: number }> {
    const range = input.sheet_name ? `${input.sheet_name}!A1` : "A1";
    const res = await this.sheets.spreadsheets.values.append({
      spreadsheetId: input.spreadsheet_id,
      range,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: input.values as unknown as (string | number | boolean)[][] },
    });
    return { updated_rows: res.data.updates?.updatedRows ?? input.values.length };
  }

  async updateRange(input: UpdateRangeInput): Promise<{ updated_cells: number }> {
    const res = await this.sheets.spreadsheets.values.update({
      spreadsheetId: input.spreadsheet_id,
      range: input.range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: input.values as unknown as (string | number | boolean)[][] },
    });
    return { updated_cells: res.data.updatedCells ?? 0 };
  }

  async readRange(input: ReadRangeInput): Promise<ReadRangeResult> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: input.spreadsheet_id,
      range: input.range,
    });
    return {
      range: res.data.range ?? input.range,
      values: (res.data.values as unknown as ReadRangeResult["values"]) ?? [],
    };
  }
}
