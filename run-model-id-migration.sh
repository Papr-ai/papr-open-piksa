#!/bin/bash

echo "Running migration to add modelId column to Message_v2 table"
npx tsx lib/db/migrations/add-model-id.ts
echo "Migration completed" 