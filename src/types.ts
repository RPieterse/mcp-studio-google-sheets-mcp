export type CellValue = string | number | boolean | null;
export type Row = CellValue[];

export interface CreateSheetInput {
  title: string;
  headers?: string[];
  share_with_email?: string;
  /** If set, the new file is moved into this Drive folder after creation.
   *  Required on personal Google projects where service accounts can't
   *  create files in their own Drive. */
  parent_folder_id?: string;
}

export interface CreateSheetResult {
  spreadsheet_id: string;
  url: string;
  title: string;
}

export interface AppendRowsInput {
  spreadsheet_id: string;
  values: Row[];
  sheet_name?: string;
}

export interface UpdateRangeInput {
  spreadsheet_id: string;
  range: string;
  values: Row[];
}

export interface ReadRangeInput {
  spreadsheet_id: string;
  range: string;
}

export interface ReadRangeResult {
  range: string;
  values: Row[];
}

export interface SheetsApi {
  createSpreadsheet(input: CreateSheetInput): Promise<CreateSheetResult>;
  shareSpreadsheet(spreadsheet_id: string, email: string): Promise<void>;
  appendRows(input: AppendRowsInput): Promise<{ updated_rows: number }>;
  updateRange(input: UpdateRangeInput): Promise<{ updated_cells: number }>;
  readRange(input: ReadRangeInput): Promise<ReadRangeResult>;
}

export interface ToolResult {
  text: string;
  isError?: boolean;
}
