import { describe, expect, test } from "bun:test";
import { parseTransferLine, withTransferLine } from "../src/lib/transferLine";

describe("transfer line in notes", () => {
  test("line and notes round-trip", () => {
    const notes = withTransferLine("Linia de spălat manual", "urgent");
    expect(notes).toBe("Linia: Linia de spălat manual · urgent");
    expect(parseTransferLine(notes)).toEqual({ line: "Linia de spălat manual", rest: "urgent" });
  });
  test("line without notes", () => {
    expect(parseTransferLine(withTransferLine("Giostra", ""))).toEqual({ line: "Giostra", rest: "" });
  });
  test("old transfers without a line keep their notes", () => {
    expect(parseTransferLine("Transfer vechi")).toEqual({ line: null, rest: "Transfer vechi" });
  });
});
