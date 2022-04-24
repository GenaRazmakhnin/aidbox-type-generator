const sut = require("../lib/cache");
const { suite } = require("uvu");
const assert = require("uvu/assert");
const fs = require("fs");

const cacheSuite = suite("Cache");

cacheSuite.before.each(() => {
  if (fs.existsSync(`${process.cwd()}/.cache`))
    fs.rmSync(`${process.cwd()}/.cache`, { recursive: true });
  if (fs.existsSync(`${process.cwd()}/.custom-cache`))
    fs.rmSync(`${process.cwd()}/.custom-cache`, { recursive: true });
});

cacheSuite("empty input", () => {
  const cache = sut.createCache();
  assert.is(cache.cachePath, `${process.cwd()}/.cache`);
  assert.is(fs.existsSync(cache.cachePath), false);
});

cacheSuite("custom cache path shouldn't be created", () => {
  const cache = sut.createCache(false, `${process.cwd()}/.custom-cache`);
  assert.is(cache.cachePath, `${process.cwd()}/.custom-cache`);
  assert.is(fs.existsSync(cache.cachePath), false);
  cache.clearFolder();
});

cacheSuite("custom cache path should be created", () => {
  const cache = sut.createCache(true, `${process.cwd()}/.custom-cache`);
  assert.is(cache.cachePath, `${process.cwd()}/.custom-cache`);
  assert.is(fs.existsSync(cache.cachePath), true);
  cache.clearFolder();
});

cacheSuite("should return empty set for all cache items", () => {
  const cache = sut.createCache(true);
  assert.is(cache.cachePath, `${process.cwd()}/.cache`);
  assert.is(fs.existsSync(cache.cachePath), true);
  assert.is(cache.confirms.size, 0);
  assert.is(cache.primitiveTypes.size, 0);
  assert.is(cache.schema.size, 0);
  assert.is(cache.valueSets.size, 0);
  cache.clearFolder();
  assert.is(fs.existsSync(cache.cachePath), false);
});

cacheSuite("pre-init confirms file", () => {
  fs.mkdirSync(`${process.cwd()}/.cache`);
  fs.writeFileSync(
    `${process.cwd()}/.cache/confirms.json`,
    JSON.stringify({ test: "test" })
  );
  const cache = sut.createCache(true);
  assert.is(cache.cachePath, `${process.cwd()}/.cache`);

  assert.is(fs.existsSync(cache.cachePath), true);
  assert.is(cache.confirms.size, 1);
  assert.is(cache.primitiveTypes.size, 0);
  assert.is(cache.schema.size, 0);
  assert.is(cache.valueSets.size, 0);
  cache.clearFolder();
  assert.is(fs.existsSync(cache.cachePath), false);
});

cacheSuite("should don't save into file if first argument false", () => {
  const cache = sut.createCache(false);
  assert.is(fs.existsSync(cache.cachePath), false);
  assert.is(fs.existsSync(`${process.cwd()}/.cache/confirms.json`), false);
});

cacheSuite("should save into file if first argument true", () => {
  const cache = sut.createCache(true);
  assert.is(fs.existsSync(cache.cachePath), true);
  assert.is(cache.save(), true);
  assert.is(fs.existsSync(`${process.cwd()}/.cache/confirms.json`), true);
  cache.clearFolder();
});

cacheSuite.run();
