import test from "node:test";
import assert from "node:assert/strict";
import { guestContinuePath, isSafeNext, sanitizeNext, GUEST_INTAKE, authCallbackPath } from "./safeNext.ts";

test("guest continue with no next goes to intake, not marketing", () => {
  assert.equal(guestContinuePath(null), GUEST_INTAKE);
  assert.equal(guestContinuePath("/"), GUEST_INTAKE);
  assert.equal(guestContinuePath(""), GUEST_INTAKE);
});

test("guest continue preserves the intake destination", () => {
  assert.equal(guestContinuePath("/?entry=new-business"), "/?entry=new-business");
  assert.equal(guestContinuePath("/?entry=new-business&resume=abc"), "/?entry=new-business&resume=abc");
});

test("guest continue does not send users to protected routes", () => {
  assert.equal(guestContinuePath("/businesses"), GUEST_INTAKE);
  assert.equal(guestContinuePath("/dashboard"), GUEST_INTAKE);
  assert.equal(guestContinuePath("/settings?x=1"), GUEST_INTAKE);
});

test("open redirects are rejected", () => {
  assert.equal(isSafeNext("https://evil.example"), false);
  assert.equal(isSafeNext("//evil.example"), false);
  assert.equal(sanitizeNext("https://evil.example", "/businesses"), "/businesses");
  assert.equal(authCallbackPath("https://evil.example"), GUEST_INTAKE);
});

test("same-origin relative next is kept for authenticated users", () => {
  assert.equal(sanitizeNext("/businesses/abc"), "/businesses/abc");
  assert.equal(isSafeNext("/?entry=new-business"), true);
});
