-- Add onboarding fields to User table
ALTER TABLE "User" ADD COLUMN "referredBy" varchar(255);
ALTER TABLE "User" ADD COLUMN "useCase" text;
ALTER TABLE "User" ADD COLUMN "onboardingCompleted" boolean DEFAULT false;
