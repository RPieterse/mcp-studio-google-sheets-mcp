import { describe, it, expect, vi } from "vitest";
import { handleTool } from "../src/tools.js";
import type {
  SheetsApi,
  CreateSheetInput,
  CreateSheetResult,
  AppendRowsInput,
  UpdateRangeInput,
  ReadRangeInput,
  ReadRangeResult,
} from "../src/types.js";

function makeApi(overrides: Partial<SheetsApi> = {}): SheetsApi {
  return {
    createSpreadsheet: vi.fn(
      async (i: CreateSheetInput): Promise<CreateSheetResult> => ({
        spreadsheet_id: "sheet_abc",
        url: "https://docs.google.com/spreadsheets/d/sheet_abc/edit",
        title: i.title,
      }),
    ),
    shareSpreadsheet: vi.fn(async () => {}),
    appendRows: vi.fn(async (_i: AppendRowsInput) => ({ updated_rows: 0 })),
    updateRange: vi.fn(async (_i: UpdateRangeInput) => ({ updated_cells: 0 })),
    readRange: vi.fn(
      async (i: ReadRangeInput): Promise<ReadRangeResult> => ({
        range: i.range,
        values: [],
      }),
    ),
    ...overrides,
  };
}

describe("create_sheet", () => {
  it("creates a sheet with the given title and returns its URL", async () => {
    const api = makeApi();
    const result = await handleTool(
      "create_sheet",
      { title: "Top Stories" },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain("sheet_abc");
    expect(result.text).toContain("https://docs.google.com/spreadsheets/d/sheet_abc/edit");
    expect(api.createSpreadsheet).toHaveBeenCalledWith({
      title: "Top Stories",
      headers: undefined,
      share_with_email: undefined,
    });
  });

  it("shares the sheet with the configured user email when set", async () => {
    const api = makeApi();
    await handleTool(
      "create_sheet",
      { title: "X" },
      { api, defaultShareEmail: "user@example.com" },
    );
    expect(api.shareSpreadsheet).toHaveBeenCalledWith("sheet_abc", "user@example.com");
  });

  it("does not share if no email is configured and none passed", async () => {
    const api = makeApi();
    await handleTool("create_sheet", { title: "X" }, { api, defaultShareEmail: "" });
    expect(api.shareSpreadsheet).not.toHaveBeenCalled();
  });

  it("passes through an explicit share_with_email override", async () => {
    const api = makeApi();
    await handleTool(
      "create_sheet",
      { title: "X", share_with_email: "other@example.com" },
      { api, defaultShareEmail: "user@example.com" },
    );
    expect(api.shareSpreadsheet).toHaveBeenCalledWith("sheet_abc", "other@example.com");
  });

  it("rejects empty titles", async () => {
    const api = makeApi();
    const result = await handleTool(
      "create_sheet",
      { title: "" },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBe(true);
    expect(api.createSpreadsheet).not.toHaveBeenCalled();
  });
});

describe("append_rows", () => {
  it("appends rows to a sheet", async () => {
    const api = makeApi({
      appendRows: vi.fn(async () => ({ updated_rows: 3 })),
    });
    const result = await handleTool(
      "append_rows",
      {
        spreadsheet_id: "abc",
        values: [
          ["a", "b"],
          ["c", "d"],
          ["e", "f"],
        ],
      },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain("3");
    expect(api.appendRows).toHaveBeenCalledWith({
      spreadsheet_id: "abc",
      values: [
        ["a", "b"],
        ["c", "d"],
        ["e", "f"],
      ],
      sheet_name: undefined,
    });
  });

  it("rejects missing spreadsheet_id", async () => {
    const api = makeApi();
    const result = await handleTool(
      "append_rows",
      { values: [["a"]] },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBe(true);
    expect(api.appendRows).not.toHaveBeenCalled();
  });

  it("rejects non-array values", async () => {
    const api = makeApi();
    const result = await handleTool(
      "append_rows",
      { spreadsheet_id: "abc", values: "not an array" },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBe(true);
  });
});

describe("update_range", () => {
  it("updates a range", async () => {
    const api = makeApi({
      updateRange: vi.fn(async () => ({ updated_cells: 4 })),
    });
    const result = await handleTool(
      "update_range",
      {
        spreadsheet_id: "abc",
        range: "Sheet1!A1:B2",
        values: [
          ["a", "b"],
          ["c", "d"],
        ],
      },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain("4");
    expect(api.updateRange).toHaveBeenCalled();
  });
});

describe("read_range", () => {
  it("reads a range and returns a json block", async () => {
    const api = makeApi({
      readRange: vi.fn(async () => ({
        range: "Sheet1!A1:B2",
        values: [
          ["a", "b"],
          ["c", "d"],
        ],
      })),
    });
    const result = await handleTool(
      "read_range",
      { spreadsheet_id: "abc", range: "Sheet1!A1:B2" },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBeFalsy();
    expect(result.text).toContain('"a"');
    expect(result.text).toContain('"d"');
  });
});

describe("unknown tool", () => {
  it("returns an error", async () => {
    const api = makeApi();
    const result = await handleTool("nope", {}, { api, defaultShareEmail: "" });
    expect(result.isError).toBe(true);
  });
});

describe("api errors", () => {
  it("surfaces a clear error message when the api throws", async () => {
    const api = makeApi({
      createSpreadsheet: vi.fn(async () => {
        throw new Error("invalid_grant: bad credentials");
      }),
    });
    const result = await handleTool(
      "create_sheet",
      { title: "X" },
      { api, defaultShareEmail: "" },
    );
    expect(result.isError).toBe(true);
    expect(result.text).toContain("invalid_grant");
  });
});
