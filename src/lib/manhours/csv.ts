// ────────────────────────────────────────────────────────────────────────
// Tiny CSV parser + template generators for the Manhours wizard's bulk
// import paths. Kept dependency-free — no papaparse — because the
// shape we need is trivial and a 50-line implementation is easier to
// audit than a third-party library.
//
// Handles the cases that show up in real exports:
//   • CRLF or LF line endings
//   • optional UTF-8 BOM
//   • quoted fields with embedded commas
//   • quoted fields with embedded newlines (Excel does this)
//   • doubled "" inside quoted fields → literal "
//   • trailing blank lines
//
// Out of scope (intentionally — not needed for our schemas):
//   • backslash escapes
//   • single-quoted fields
//   • inferring types
// ────────────────────────────────────────────────────────────────────────

export type CategoryKind = "PERMANENT" | "CONTRACT" | "TRAINEE";

export interface CategoryRowInput {
  /** For PERMANENT/TRAINEE: department code. For CONTRACT: contractor company code. */
  key: string;
  averageHeadcount: number;
  peakHeadcount: number;
  endOfPeriodHeadcount: number;
  regularHours: number;
  overtimeHours: number;
  notes?: string;
}

export interface CsvParseError {
  /** 1-indexed row in the CSV (header is row 1). */
  row: number;
  message: string;
}

export interface CsvParseResult {
  rows: CategoryRowInput[];
  errors: CsvParseError[];
}

const HEADERS_BY_KIND: Record<CategoryKind, { key: string; label: string }> = {
  PERMANENT: { key: "departmentCode", label: "Department code" },
  TRAINEE: { key: "departmentCode", label: "Department code" },
  CONTRACT: { key: "contractorCode", label: "Contractor code" }
};

const EXPECTED_NUMERIC_HEADERS = [
  "averageHeadcount",
  "peakHeadcount",
  "endOfPeriodHeadcount",
  "regularHours",
  "overtimeHours"
] as const;

/** Generate the CSV template string for a given category kind. The template
 *  is what users download to see the expected column order; the wizard
 *  pre-fills department / contractor codes from masters so they don't
 *  need to look them up. */
export function generateCsvTemplate(kind: CategoryKind, codes: string[] = []): string {
  const keyHeader = HEADERS_BY_KIND[kind].key;
  const headers = [keyHeader, ...EXPECTED_NUMERIC_HEADERS, "notes"];
  const lines = [headers.join(",")];
  for (const code of codes) {
    lines.push([code, "0", "0", "0", "0", "0", ""].join(","));
  }
  return lines.join("\n") + "\n";
}

/** Parse a CSV blob into row inputs. Validates header shape; per-row
 *  numeric parsing errors accumulate in the errors array but don't
 *  abort the parse — caller decides whether to import partial data. */
export function parseCategoryCsv(csv: string, kind: CategoryKind): CsvParseResult {
  const errors: CsvParseError[] = [];
  const rows: CategoryRowInput[] = [];

  const stripped = csv.replace(/^﻿/, ""); // drop UTF-8 BOM if present
  const records = tokeniseCsv(stripped);
  if (records.length === 0) {
    return { rows: [], errors: [{ row: 1, message: "Empty CSV" }] };
  }

  const header = records[0].map((h) => h.trim());
  const expectedKey = HEADERS_BY_KIND[kind].key;
  if (header[0] !== expectedKey) {
    errors.push({
      row: 1,
      message: `First column must be "${expectedKey}" (got "${header[0]}")`
    });
    return { rows, errors };
  }
  for (const numericHeader of EXPECTED_NUMERIC_HEADERS) {
    if (!header.includes(numericHeader)) {
      errors.push({ row: 1, message: `Missing required column "${numericHeader}"` });
    }
  }
  if (errors.length > 0) return { rows, errors };

  const idx = (col: string) => header.indexOf(col);
  const numericIndices = EXPECTED_NUMERIC_HEADERS.map((c) => [c, idx(c)] as const);
  const notesIdx = idx("notes");

  for (let r = 1; r < records.length; r++) {
    const fields = records[r];
    // Skip wholly-blank lines (Excel often appends trailing newlines).
    if (fields.every((f) => f.trim() === "")) continue;

    const key = (fields[0] ?? "").trim();
    if (!key) {
      errors.push({ row: r + 1, message: `Row missing ${HEADERS_BY_KIND[kind].label.toLowerCase()}` });
      continue;
    }

    const numerics: Record<string, number> = {};
    let rowOk = true;
    for (const [col, colIdx] of numericIndices) {
      const raw = (fields[colIdx] ?? "").trim();
      const n = raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        errors.push({ row: r + 1, message: `Invalid number for "${col}": ${raw || "(empty)"}` });
        rowOk = false;
        break;
      }
      numerics[col] = n;
    }
    if (!rowOk) continue;

    rows.push({
      key,
      averageHeadcount: numerics.averageHeadcount,
      peakHeadcount: numerics.peakHeadcount,
      endOfPeriodHeadcount: numerics.endOfPeriodHeadcount,
      regularHours: numerics.regularHours,
      overtimeHours: numerics.overtimeHours,
      notes: notesIdx >= 0 ? (fields[notesIdx] ?? "").trim() || undefined : undefined
    });
  }

  return { rows, errors };
}

// ── Internal: state-machine tokeniser ───────────────────────────────

/** Split CSV into records (each record = string[]). Honours quoted
 *  fields with embedded commas / newlines / "" escapes. */
function tokeniseCsv(input: string): string[][] {
  const records: string[][] = [];
  let current: string[] = [];
  let field = "";
  let i = 0;
  let inQuotes = false;

  while (i < input.length) {
    const ch = input[i];

    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'; // escaped quote
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += ch;
        i++;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      current.push(field);
      field = "";
      i++;
    } else if (ch === "\r") {
      // \r or \r\n — finish field + record
      current.push(field);
      field = "";
      records.push(current);
      current = [];
      i += input[i + 1] === "\n" ? 2 : 1;
    } else if (ch === "\n") {
      current.push(field);
      field = "";
      records.push(current);
      current = [];
      i++;
    } else {
      field += ch;
      i++;
    }
  }

  // Flush trailing field/record (no terminator after last value).
  if (field !== "" || current.length > 0) {
    current.push(field);
    records.push(current);
  }

  return records;
}
