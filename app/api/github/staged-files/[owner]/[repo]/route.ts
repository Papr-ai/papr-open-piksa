import { getGitHubClient } from "@/lib/github/utils";
import { NextResponse } from "next/server";

type Params = Promise<{ owner: string; repo: string }>;

export async function GET(
  request: Request,
  context: { params: Params }
) {
  // params is now a Promise<{ owner: string; repo: string }>
  const { owner, repo } = await context.params;

  try {
    const client = await getGitHubClient();
    const files  = await client.getStagedFiles(owner, repo);
    return NextResponse.json(files);
  } catch (error) {
    console.error(`Error getting staged files for ${owner}/${repo}:`, error);
    return NextResponse.json([], { status: 500 });
  }
}