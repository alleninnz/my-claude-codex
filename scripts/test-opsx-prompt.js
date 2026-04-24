#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const SCENARIO_DIR = path.join(
  ROOT,
  "skills",
  "opsx-prompt",
  "testdata",
  "scenarios",
);
const RESPONSE_DIR = path.join(
  ROOT,
  "skills",
  "opsx-prompt",
  "testdata",
  "responses",
);

function parseArgs(argv) {
  const args = {
    selfTest: false,
    list: false,
    scenario: null,
    response: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--self-test") {
      args.selfTest = true;
    } else if (arg === "--list") {
      args.list = true;
    } else if (arg === "--scenario") {
      args.scenario = argv[i + 1] || null;
      i += 1;
    } else if (arg === "--response") {
      args.response = argv[i + 1] || null;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printHelp(0);
    } else {
      printHelp(1, `Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp(exitCode, error) {
  if (error) {
    console.error(error);
    console.error("");
  }

  console.error("Usage:");
  console.error("  node scripts/test-opsx-prompt.js --self-test");
  console.error("  node scripts/test-opsx-prompt.js --list");
  console.error(
    "  node scripts/test-opsx-prompt.js --scenario <name> [--response <file>]",
  );
  console.error("");
  console.error("Notes:");
  console.error(
    "  --self-test validates the checked-in sample responses under skills/opsx-prompt/testdata/responses/.",
  );
  console.error(
    "  --scenario validates a single response file against one scenario fixture. If --response is omitted, the checked-in sample response for that scenario is used.",
  );
  process.exit(exitCode);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function listScenarioNames() {
  return fs
    .readdirSync(SCENARIO_DIR)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""))
    .sort();
}

function resolveScenario(name) {
  const scenarioPath = path.join(SCENARIO_DIR, `${name}.json`);
  if (!fs.existsSync(scenarioPath)) {
    throw new Error(`Scenario not found: ${name}`);
  }
  return {
    name,
    path: scenarioPath,
    data: readJson(scenarioPath),
  };
}

function resolveResponsePath(name, explicitPath) {
  if (explicitPath) {
    return path.resolve(explicitPath);
  }
  return path.join(RESPONSE_DIR, `${name}.md`);
}

function extractCodeBlocks(markdown) {
  const blocks = [];
  const regex = /```([a-zA-Z0-9_-]+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      info: (match[1] || "").trim(),
      body: match[2].trim(),
      raw: match[0],
    });
  }
  return blocks;
}

function stripCodeBlocks(markdown) {
  return markdown.replace(/```([a-zA-Z0-9_-]+)?\n[\s\S]*?```/g, "").trim();
}

function parseSections(promptText) {
  const sections = [];
  const regex = /^([A-Z][A-Za-z -]+):$/gm;
  let match;
  while ((match = regex.exec(promptText)) !== null) {
    sections.push(match[1].trim());
  }
  return sections;
}

function parseUserNoteHeadings(outsideText) {
  const headings = [];
  const regex = /^###\s+(.+)$/gm;
  let match;
  while ((match = regex.exec(outsideText)) !== null) {
    headings.push(match[1].trim());
  }
  return headings;
}

function firstNonEmptyLine(text) {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim()) {
      return line.trim();
    }
  }
  return "";
}

function hasMatch(text, pattern) {
  return new RegExp(pattern, "m").test(text);
}

function validateScenario(scenario, responsePath) {
  const markdown = readText(responsePath);
  const expect = scenario.data.expect || {};
  const codeBlocks = extractCodeBlocks(markdown);
  const promptBlock = codeBlocks[0] ? codeBlocks[0].body : "";
  const outsideText = stripCodeBlocks(markdown);
  const promptSections = parseSections(promptBlock);
  const userNotes = parseUserNoteHeadings(outsideText);
  const promptHeader = firstNonEmptyLine(promptBlock);
  const errors = [];

  const expectPrompt = Boolean(expect.has_prompt);
  if (expectPrompt && codeBlocks.length !== 1) {
    errors.push(`expected exactly 1 fenced prompt block, found ${codeBlocks.length}`);
  }
  if (!expectPrompt && codeBlocks.length !== 0) {
    errors.push(`expected no fenced prompt block, found ${codeBlocks.length}`);
  }

  if (expectPrompt && expect.header_pattern && !hasMatch(promptHeader, expect.header_pattern)) {
    errors.push(
      `prompt header mismatch: got "${promptHeader}", expected pattern ${expect.header_pattern}`,
    );
  }

  for (const section of expect.required_prompt_sections || []) {
    if (!promptSections.includes(section)) {
      errors.push(`missing prompt section: ${section}`);
    }
  }

  for (const heading of expect.required_user_notes || []) {
    if (!userNotes.includes(heading)) {
      errors.push(`missing user note heading: ${heading}`);
    }
  }

  for (const heading of expect.forbidden_user_notes || []) {
    if (userNotes.includes(heading)) {
      errors.push(`unexpected user note heading: ${heading}`);
    }
  }

  for (const pattern of expect.required_prompt_patterns || []) {
    if (!hasMatch(promptBlock, pattern)) {
      errors.push(`prompt missing required pattern: ${pattern}`);
    }
  }

  for (const pattern of expect.forbidden_prompt_patterns || []) {
    if (hasMatch(promptBlock, pattern)) {
      errors.push(`prompt matched forbidden pattern: ${pattern}`);
    }
  }

  for (const pattern of expect.required_output_patterns || []) {
    if (!hasMatch(markdown, pattern)) {
      errors.push(`output missing required pattern: ${pattern}`);
    }
  }

  for (const pattern of expect.forbidden_output_patterns || []) {
    if (hasMatch(markdown, pattern)) {
      errors.push(`output matched forbidden pattern: ${pattern}`);
    }
  }

  return {
    errors,
    promptHeader,
    promptSections,
    userNotes,
  };
}

function runSingleScenario(name, responsePath) {
  const scenario = resolveScenario(name);
  if (!fs.existsSync(responsePath)) {
    throw new Error(`Response file not found: ${responsePath}`);
  }

  const result = validateScenario(scenario, responsePath);
  if (result.errors.length === 0) {
    console.log(`PASS ${name}`);
    return true;
  }

  console.error(`FAIL ${name}`);
  for (const error of result.errors) {
    console.error(`  - ${error}`);
  }
  return false;
}

function runSelfTest() {
  const scenarioNames = listScenarioNames();
  let passed = 0;
  for (const name of scenarioNames) {
    const ok = runSingleScenario(name, resolveResponsePath(name, null));
    if (ok) {
      passed += 1;
    }
  }

  const total = scenarioNames.length;
  if (passed !== total) {
    console.error(`\n${passed}/${total} scenarios passed`);
    process.exit(1);
  }

  console.log(`\n${passed}/${total} scenarios passed`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const name of listScenarioNames()) {
      console.log(name);
    }
    return;
  }

  if (args.selfTest || (!args.scenario && !args.response)) {
    runSelfTest();
    return;
  }

  if (!args.scenario) {
    printHelp(1, "--scenario is required unless --self-test or --list is used");
  }

  const responsePath = resolveResponsePath(args.scenario, args.response);
  const ok = runSingleScenario(args.scenario, responsePath);
  process.exit(ok ? 0 : 1);
}

main();
