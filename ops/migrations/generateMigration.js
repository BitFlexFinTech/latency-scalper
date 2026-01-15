#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load required schema
const requiredSchema = JSON.parse(
  fs.readFileSync(path.join(__dirname, "requiredSchema.json"), "utf-8")
);

// Get Supabase credentials from environment or bot .env
let SUPABASE_URL = process.env.SUPABASE_URL;
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Try to read from bot's .env
  try {
    const envPath = "/opt/latency_scalper/.env";
    const envContent = fs.readFileSync(envPath, "utf-8");
    const envLines = envContent.split("\n");
    for (const line of envLines) {
      const match = line.match(/^SUPABASE_URL=(.+)$/);
      if (match) SUPABASE_URL = match[1].trim();
      const matchKey = line.match(/^SUPABASE_ANON_KEY=(.+)$/);
      if (matchKey) SUPABASE_ANON_KEY = matchKey[1].trim();
    }
  } catch (error) {
    console.error("[MIGRATIONS] Could not read Supabase credentials:", error.message);
    process.exit(1);
  }
}

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("[MIGRATIONS] SUPABASE_URL and SUPABASE_ANON_KEY must be set");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getLiveSchema() {
  const liveSchema = {};
  
  // Fetch each table's structure by querying for one row
  for (const tableName of Object.keys(requiredSchema)) {
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(1);
      
      if (error) {
        // Table doesn't exist
        liveSchema[tableName] = null;
      } else {
        // Table exists - store column names from sample row
        liveSchema[tableName] = data && data.length > 0 ? Object.keys(data[0]) : [];
      }
    } catch (err) {
      liveSchema[tableName] = null;
    }
  }
  
  return liveSchema;
}

function generateSQL(required, live) {
  const sql = [];

  for (const [table, columns] of Object.entries(required)) {
    if (!live[table] || live[table] === null) {
      // Table doesn't exist - create it
      const columnDefs = Object.entries(columns)
        .map(([col, type]) => {
          // Add UUID primary key for id columns
          if (col === "id" && type === "uuid") {
            return `${col} ${type} PRIMARY KEY DEFAULT gen_random_uuid()`;
          }
          // Convert JSON types to PostgreSQL types
          const pgType = type === "text" ? "TEXT" :
                        type === "integer" ? "INTEGER" :
                        type === "numeric" ? "NUMERIC" :
                        type === "boolean" ? "BOOLEAN" :
                        type === "timestamp" ? "TIMESTAMPTZ" :
                        type === "uuid" ? "UUID" : "TEXT";
          return `${col} ${pgType}`;
        })
        .join(", ");
      sql.push(`CREATE TABLE IF NOT EXISTS ${table} (${columnDefs});`);
      continue;
    }

    // Table exists - check for missing columns
    const existingColumns = live[table];
    for (const [col, type] of Object.entries(columns)) {
      if (!existingColumns.includes(col)) {
        const pgType = type === "text" ? "TEXT" :
                      type === "integer" ? "INTEGER" :
                      type === "numeric" ? "NUMERIC" :
                      type === "boolean" ? "BOOLEAN" :
                      type === "timestamp" ? "TIMESTAMPTZ" :
                      type === "uuid" ? "UUID" : "TEXT";
        sql.push(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${pgType};`);
      }
    }
  }

  return sql;
}

async function run() {
  console.log("[MIGRATIONS] Fetching live schema from Supabase...");
  const liveSchema = await getLiveSchema();

  console.log("[MIGRATIONS] Generating SQL migrations...");
  const sql = generateSQL(requiredSchema, liveSchema);

  if (sql.length === 0) {
    console.log("[MIGRATIONS] ✓ Schema is already correct. No migrations needed.");
    return;
  }

  const outputDir = path.join(__dirname, "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = `migration_${Date.now()}.sql`;
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, sql.join("\n\n"));

  console.log(`[MIGRATIONS] ✓ Created: ${filename}`);
  console.log(`[MIGRATIONS] Location: ${filepath}`);
  console.log(`[MIGRATIONS] Run this SQL in your Supabase SQL editor.`);
}

run().catch((error) => {
  console.error("[MIGRATIONS] Error:", error);
  process.exit(1);
});
