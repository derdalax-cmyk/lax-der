import { expect, test } from "bun:test";
import { IMAGE_CACHE_LIMIT, IMAGE_CACHE_TTL, imageDimensionKey, pruneImageDimensions, productImageMetadata } from "../src/lib/productImageCache";
import { anchorScrollTarget, isListRestoring, setListRestoring, subscribeListRestoration } from "../src/lib/listContext";

test("uncropped thumbnail and main URL reuse the same persistent dimensions", () => {
  const original = "https://cdn.example/storage/v1/object/public/products/a.jpg";
  expect(imageDimensionKey(original.replace("/object/", "/render/image/") + "?width=500&quality=78&resize=contain")).toBe(original);
  expect(imageDimensionKey(original.replace("/object/", "/render/image/") + "?width=1000&resize=contain")).toBe(original);
  expect(imageDimensionKey(original.replace("/object/", "/render/image/") + "?width=500&height=500&resize=cover")).not.toBe(original);
});
test("signed image tokens are never persisted", () => {
  expect(imageDimensionKey("https://cdn.example/storage/v1/object/sign/private/a.jpg?token=private")).toBeNull();
  expect(imageDimensionKey("https://cdn.example/a.jpg?token=private")).toBeNull();
});
test("dimension persistence is limited to 2000 most recent entries and expires after 30 days", () => {
  const entries: [string, {width: number; height: number; aspect: number; ts: number}][] = Array.from({length: 3000}, (_, i) => [`image${i}`, {width: 300, height: 400, aspect: .75, ts: 1000 + i}]);
  const kept = pruneImageDimensions(entries, 5000);
  expect(kept.length).toBe(IMAGE_CACHE_LIMIT);
  expect(kept[0][0]).toBe("image1000");
  expect(pruneImageDimensions(entries, 5000 + IMAGE_CACHE_TTL)).toEqual([]);
});
test("invalid dimensions are discarded; existing image metadata takes priority", () => {
  expect(productImageMetadata([{url: "a", width: 400, height: 300}])).toEqual({width: 400, height: 300});
  expect(productImageMetadata(["a"])).toEqual({});
  expect(pruneImageDimensions([["bad", {width: 0, height: 400, aspect: 1, ts: 1000}]], 1001)).toEqual([]);
});
test("restoration pause affects only the active list and notifies sentinel on release", () => {
  let calls = 0;
  const stop = subscribeListRestoration(() => calls++);
  setListRestoring("/explorar|q=azul");
  expect(isListRestoring("/explorar|q=azul")).toBe(true);
  expect(isListRestoring("/explorar|q=verde")).toBe(false);
  setListRestoring(null);
  expect(isListRestoring("/explorar|q=azul")).toBe(false);
  expect(calls).toBe(2);
  stop();
});
test("five repeat returns do not accumulate drift when using absolute anchor delta", () => {
  let scroll = 2000;
  for (let i = 0; i < 5; i++) {
    scroll = anchorScrollTarget(scroll, 2020 - scroll, 120);
    expect(scroll).toBe(1900);
  }
});