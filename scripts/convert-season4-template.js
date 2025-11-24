// scripts/convert-season4-template.js
const fs = require("fs");
const path = require("path");

// 1. Read CSV file
const inputPath = path.join(__dirname, "..", "data", "season4_40x40_template.csv");
const csvText = fs.readFileSync(inputPath, "utf8");

// 2. Parse CSV into string[][]
// Assumes: 40 lines, 40 comma separated values, no quoted commas
const rows = csvText
  .trim()
  .split(/\r?\n/)
  .map((line) =>
    line
      .split(",")
      .map((cell) => cell.trim())
  );

// Optional sanity checks
const numRows = rows.length;
const numCols = rows[0]?.length ?? 0;
console.log(`Parsed ${numRows} rows × ${numCols} cols`);

if (numRows !== 40 || numCols !== 40) {
  console.warn("Warning: expected 40×40 grid, got", numRows, "×", numCols);
}

// 3. Build TypeScript source
const outputLines = [];
outputLines.push("// AUTO-GENERATED from season4_40x40_template.csv");
outputLines.push("// Do not edit by hand; re-run scripts/convert-season4-template.js instead.");
outputLines.push("");
outputLines.push("export const season4Template: string[][] = [");

rows.forEach((row, rowIndex) => {
  const rowLiteral =
    "  [" +
    row.map((cell) => JSON.stringify(cell)).join(", ") +
    "]" +
    (rowIndex === rows.length - 1 ? "" : ",");
  outputLines.push(rowLiteral);
});

outputLines.push("];");
outputLines.push("");

const outputText = outputLines.join("\n");

// 4. Write to config file
const outputPath = path.join(
  __dirname,
  "..",
  "config",
  "season4",
  "season4_40x40_template.ts"
);

// Ensure folder exists
fs.mkdirSync(path.dirname(outputPath), { recursive: true });

// Write file
fs.writeFileSync(outputPath, outputText, "utf8");

console.log("Wrote", outputPath);
