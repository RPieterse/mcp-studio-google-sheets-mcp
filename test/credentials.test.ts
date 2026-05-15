import { describe, it, expect } from "vitest";
import { parseServiceAccountJson } from "../src/credentials.js";

describe("parseServiceAccountJson", () => {
  it("parses a well-formed service account JSON", () => {
    const json = JSON.stringify({
      type: "service_account",
      project_id: "my-proj",
      client_email: "sa@my-proj.iam.gserviceaccount.com",
      private_key: "-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----\\n",
    });
    const creds = parseServiceAccountJson(json);
    expect(creds.client_email).toBe("sa@my-proj.iam.gserviceaccount.com");
    expect(creds.project_id).toBe("my-proj");
    expect(creds.private_key).toContain("\n");
    expect(creds.private_key).not.toContain("\\n");
  });

  it("throws a helpful error on empty input", () => {
    expect(() => parseServiceAccountJson("   ")).toThrow(/empty/i);
  });

  it("throws a helpful error on non-JSON input", () => {
    expect(() => parseServiceAccountJson("not json")).toThrow(/not valid JSON/i);
  });

  it("throws when client_email is missing", () => {
    const json = JSON.stringify({ private_key: "x" });
    expect(() => parseServiceAccountJson(json)).toThrow(/client_email/);
  });

  it("throws when private_key is missing", () => {
    const json = JSON.stringify({ client_email: "x@y.com" });
    expect(() => parseServiceAccountJson(json)).toThrow(/private_key/);
  });
});
