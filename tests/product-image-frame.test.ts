import { describe, expect, test } from "bun:test";
import { productImageAspect } from "../src/lib/productImageFrame";

describe("product photograph presentation limits", () => {
  test("square remains square", () => expect(productImageAspect(1000, 1000)).toBe(1));
  test("4:3 remains landscape", () => expect(productImageAspect(1200, 900)).toBe(4 / 3));
  test("3:4 remains portrait", () => expect(productImageAspect(900, 1200)).toBe(3 / 4));
  test("extreme portrait is limited to 0.75", () => expect(productImageAspect(400, 1600)).toBe(0.75));
  test("extreme landscape is limited to 4:3", () => expect(productImageAspect(1600, 400)).toBe(4 / 3));
  test("rotation swaps the natural orientation", () => expect(productImageAspect(1200, 900, 90)).toBe(0.75));
  test("unknown dimensions use a safe initial frame", () => expect(productImageAspect(0, 0)).toBe(1));
});