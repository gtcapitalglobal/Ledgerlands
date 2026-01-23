import { describe, expect, it } from "vitest";
import { normalizePropertyId } from "../shared/utils";

describe("propertyId normalization", () => {
  it("normalizes various formats to #NN", () => {
    expect(normalizePropertyId("33")).toBe("#33");
    expect(normalizePropertyId("#33")).toBe("#33");
    expect(normalizePropertyId("Property 33")).toBe("#33");
    expect(normalizePropertyId("  #33  ")).toBe("#33");
    expect(normalizePropertyId("property #33")).toBe("#33");
  });

  it("handles edge cases", () => {
    expect(normalizePropertyId("#")).toBe("");
    expect(normalizePropertyId("")).toBe("");
    expect(normalizePropertyId("  ")).toBe("");
  });
});
