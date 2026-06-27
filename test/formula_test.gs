const test = require("node:test");
const assert = require("node:assert/strict");
const { IdM_eval_formula } = require("../dst/formula.gs");

test("returns typed number for single template", () => {
  const out = IdM_eval_formula("${price:number}", { price: "12.5" });
  assert.equal(out, 12.5);
});

test("returns typed int for single template", () => {
  const out = IdM_eval_formula("${qty:int}", { qty: "7.9" });
  assert.equal(out, 7);
});

test("string mode replacement in sentence", () => {
  const out = IdM_eval_formula("Hello ${name}", { name: "Ada" });
  assert.equal(out, "Hello Ada");
});

test("forceStringMode always interpolates as string", () => {
  const out = IdM_eval_formula("x=${x}", { x: 10 }, true);
  assert.equal(out, "x=10");
});

test("expression mode evaluates math helpers", () => {
  const out = IdM_eval_formula("round5($(v:number))", { v: 12 });
  assert.equal(out, 10);
});

test("expression mode handles ternary", () => {
  const out = IdM_eval_formula("$(a:number) > 10 ? 'big' : 'small'", { a: 11 });
  assert.equal(out, "big");
});

test("throws on unknown variable", () => {
  assert.throws(() => IdM_eval_formula("${missing}", {}), /Unknown variable missing/);
});

test("returns original string on invalid expression syntax", () => {
  const src = "$(a:number) +";
  const out = IdM_eval_formula(src, { a: 1 });
  assert.equal(out, src);
});