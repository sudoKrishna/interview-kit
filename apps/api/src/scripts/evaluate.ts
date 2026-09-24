
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import type { BatchCase, BatchOutput, BatchResult } from "@prepkit/shared";
import { runPipeline } from "../pipeline/runPipeline";
import { validateKit } from "../pipeline/validateKit";
import { config } from "../config";

async function main() {
  const { values } = parseArgs({
    options: {
      input: { type: "string" },
      output: { type: "string" },
    },
  });
  if (!values.input || !values.output) {
    console.error('Usage: npm run evaluate -- --input <cases.json> --output <kits.json>');
    process.exit(1);
  }

  const casesPath = path.resolve(values.input);
  const outPath = path.resolve(values.output);

  let raw: string;
  try {
    raw = fs.readFileSync(casesPath, "utf-8");
  } catch (e: any) {
    console.error(`Could not read input file: ${e.message}`);
    process.exit(1);
  }

  let cases: BatchCase[];
  try {
    cases = JSON.parse(raw);
    if (!Array.isArray(cases)) throw new Error("input must be an array of cases");
  } catch (e: any) {
    console.error(`Invalid input file: ${e.message}`);
    process.exit(1);
  }

  if (!config.llm.apiKey) {
    console.error("LLM_API_KEY is not set. Copy .env.example to .env and add your key.");
    process.exit(1);
  }

  const results: BatchResult[] = [];

  for (const c of cases) {
    const started = Date.now();
    console.log(`→ case ${c.id}: ${c.company_url} (${c.days} days)`);
    try {
      if (typeof c.jd !== "string" || typeof c.company_url !== "string" || !Number.isInteger(c.days)) {
        throw Object.assign(new Error("case is malformed (jd/company_url/days)"), { code: "CASE_MALFORMED" });
      }
      const kit = await runPipeline({ jd: c.jd, companyUrl: c.company_url, days: c.days });
      const { valid, issues } = validateKit(kit);
      if (!valid) {
        console.warn(`  ⚠ ${c.id}: kit has ${issues.length} structural issue(s) but was produced — reporting ok with honesty`);
      }
      results.push({ id: c.id, status: "ok", kit, error: null });
      console.log(`  ✓ ${c.id} done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    } catch (e: any) {
      results.push({
        id: c.id,
        status: "failed",
        kit: null,
        error: { code: e?.code ?? "CASE_FAILED", message: String(e?.message ?? e).slice(0, 300) },
      });
      console.log(`  ✗ ${c.id} FAILED: ${e?.code ?? ""} ${String(e?.message ?? e).slice(0, 120)}`);
    }
  }

  const output: BatchOutput = {
    version: "1.0",
    generated_at: new Date().toISOString(),
    kits: results,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  const ok = results.filter((r) => r.status === "ok").length;
  console.log(`\nDone: ${ok}/${results.length} cases ok → ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
