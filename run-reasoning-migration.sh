#!/bin/bash

echo "Running migration to add supportsReasoning column to Message_v2 table"
npx tsx lib/db/migrations/add-supports-reasoning.ts
echo "Migration completed" 