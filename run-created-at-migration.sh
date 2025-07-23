#!/bin/bash

echo "Running migration to add createdAt column to User table"
npx tsx lib/db/migrations/add-created-at.ts
echo "Migration completed" 