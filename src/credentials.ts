export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  project_id?: string;
}

export function parseServiceAccountJson(raw: string): ServiceAccountCredentials {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is empty. Paste the service account JSON in the MCP credentials form.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(
      "GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the full contents of the service account key file.",
    );
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON must be a JSON object");
  }
  const obj = parsed as Record<string, unknown>;
  const client_email = obj.client_email;
  const private_key = obj.private_key;
  if (typeof client_email !== "string" || !client_email) {
    throw new Error("Service account JSON is missing 'client_email'");
  }
  if (typeof private_key !== "string" || !private_key) {
    throw new Error("Service account JSON is missing 'private_key'");
  }
  return {
    client_email,
    private_key: private_key.replace(/\\n/g, "\n"),
    project_id: typeof obj.project_id === "string" ? obj.project_id : undefined,
  };
}
