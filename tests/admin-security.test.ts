import { before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

process.env.DATABASE_URL ??= "postgresql://unused";
process.env.APP_URL ??= "http://localhost:3000";
process.env.CLOUDINARY_CLOUD_NAME = "democloud";
process.env.CLOUDINARY_API_KEY = "123";
process.env.CLOUDINARY_API_SECRET = "shhh";
process.env.CLOUDINARY_FOLDER = "czuchi";

type Pw = typeof import("../src/lib/auth/password");
type Cld = typeof import("../src/lib/cloudinary");
type Media = typeof import("../src/lib/media");
let hashPassword: Pw["hashPassword"], verifyPassword: Pw["verifyPassword"], isStrongPassword: Pw["isStrongPassword"], generatePassword: Pw["generatePassword"];
let signParams: Cld["signParams"], isAllowedMediaUrl: Cld["isAllowedMediaUrl"], parseCloudinaryUrl: Cld["parseCloudinaryUrl"], createUploadSignature: Cld["createUploadSignature"];
let cloudinaryLoader: Media["cloudinaryLoader"], isCloudinary: Media["isCloudinary"];

// Imported after env is set (env() is parsed lazily but cached on first use).
before(async () => {
  ({ hashPassword, verifyPassword, isStrongPassword, generatePassword } = await import("../src/lib/auth/password"));
  ({ signParams, isAllowedMediaUrl, parseCloudinaryUrl, createUploadSignature } = await import("../src/lib/cloudinary"));
  ({ cloudinaryLoader, isCloudinary } = await import("../src/lib/media"));
});

test("password hash verifies the right password only", async () => {
  const h = await hashPassword("correct horse battery 9");
  assert.match(h, /^scrypt\$32768\$8\$1\$/);
  assert.equal(await verifyPassword("correct horse battery 9", h), true);
  assert.equal(await verifyPassword("correct horse battery 8", h), false);
  assert.equal(await verifyPassword("anything", "garbage"), false);
});

test("same password hashes differently each time (salted)", async () => {
  assert.notEqual(await hashPassword("SamePassword123"), await hashPassword("SamePassword123"));
});

test("password policy and generator", () => {
  assert.equal(isStrongPassword("short1"), false);
  assert.equal(isStrongPassword("nonumbersatall"), false);
  assert.equal(isStrongPassword("longenough1234"), true);
  for (let i = 0; i < 20; i++) assert.equal(generatePassword().length, 20);
});

test("Cloudinary signature matches the documented algorithm", () => {
  const params = { timestamp: 1315060510, public_id: "sample_image", eager: "w_400,h_300,c_pad|w_260,h_200,c_crop" };
  // Example from Cloudinary's "Generating authentication signatures" docs.
  const expected = createHash("sha1").update("eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510abcd").digest("hex");
  assert.equal(signParams(params, "abcd"), expected);
});

test("upload signature pins the folder", () => {
  const sig = createUploadSignature("containers")!;
  assert.equal(sig.folder, "czuchi/containers");
  assert.equal(sig.uploadUrl, "https://api.cloudinary.com/v1_1/democloud/auto/upload");
  assert.equal(sig.signature, signParams({ timestamp: sig.timestamp, folder: sig.folder, allowed_formats: sig.allowed_formats }, "shhh"));
});

test("only our Cloudinary folder (or legacy host) is accepted for media", () => {
  assert.equal(isAllowedMediaUrl("https://res.cloudinary.com/democloud/image/upload/v1/czuchi/containers/a.jpg"), true);
  assert.equal(isAllowedMediaUrl("https://res.cloudinary.com/othercloud/image/upload/v1/czuchi/containers/a.jpg"), false);
  assert.equal(isAllowedMediaUrl("https://res.cloudinary.com/democloud/image/upload/v1/elsewhere/a.jpg"), false);
  assert.equal(isAllowedMediaUrl("http://res.cloudinary.com/democloud/image/upload/v1/czuchi/a.jpg"), false);
  assert.equal(isAllowedMediaUrl("https://evil.example/czuchi/a.jpg"), false);
  assert.equal(isAllowedMediaUrl("javascript:alert(1)"), false);
  assert.equal(isAllowedMediaUrl("https://pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev/containers/1/x.jpg"), true);
});

test("public id extraction for deletes", () => {
  assert.deepEqual(parseCloudinaryUrl("https://res.cloudinary.com/democloud/image/upload/v1712/czuchi/containers/abc123.jpg"), { resourceType: "image", publicId: "czuchi/containers/abc123" });
  assert.deepEqual(parseCloudinaryUrl("https://res.cloudinary.com/democloud/video/upload/v9/czuchi/gallery/clip.mp4"), { resourceType: "video", publicId: "czuchi/gallery/clip" });
  assert.equal(parseCloudinaryUrl("https://res.cloudinary.com/democloud/image/upload/v1/other/abc.jpg"), null);
});

test("image loader injects f_auto/q_auto and width", () => {
  const src = "https://res.cloudinary.com/democloud/image/upload/v1/czuchi/containers/a.jpg";
  assert.equal(isCloudinary(src), true);
  assert.equal(cloudinaryLoader({ src, width: 640 }), "https://res.cloudinary.com/democloud/image/upload/f_auto,q_auto,c_limit,w_640,dpr_1/v1/czuchi/containers/a.jpg");
  assert.equal(isCloudinary("https://pub-ab61e9141ab444a2a62d1178bcf81b10.r2.dev/x.jpg"), false);
});
