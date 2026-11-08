import { expect, test } from "bun:test";
import { optionalCategoryIcon } from "../src/lib/categoryIcons";

test("categories and Home collections accept no icon without a replacement", () => {
  expect(optionalCategoryIcon(null)).toBeNull();
  expect(optionalCategoryIcon("")).toBeNull();
  expect(optionalCategoryIcon("   ")).toBeNull();
  expect(optionalCategoryIcon(undefined)).toBeNull();
});
test("existing selected icons and uploaded icons are preserved", () => {
  expect(optionalCategoryIcon("shirt")).toBe("shirt");
  expect(optionalCategoryIcon("https://derdalax.co.mz/icon.png")).toBe("https://derdalax.co.mz/icon.png");
});