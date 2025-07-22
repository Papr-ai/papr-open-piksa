# Container Runner Setup

This guide explains how to set up and configure the server-side Vercel Sandbox integration for running applications in a secure environment.

## Overview

The container runner allows you to execute code in isolated environments, making it ideal for running user-submitted code or testing applications without security risks.

## Vercel Sandbox Integration

The Vercel Sandbox integration is automatically configured when you deploy to Vercel. It uses OpenID Connect (OIDC) for secure authentication.

### Authentication

Vercel Sandbox uses OIDC (OpenID Connect) for secure authentication:

- **OIDC Benefits**: 
  - No persisted credentials
  - Short-lived tokens
  - Granular access control
  - Secure local development

- **Automatic Setup**: 
  - When deployed to Vercel, the `VERCEL_OIDC_TOKEN` is automatically available
  - No need to manually create or manage access tokens

### Benefits

- Run Node.js and Python applications in isolated environments
- Full language and dependency support in real container environments
- Secure isolation via microVMs and iframes
- Preview apps with real networking and system dependencies
- Seamless integration with Vercel deployments
- Turbopack-powered HMR for fast code updates

## Local Development

For local development, the Vercel Sandbox integration requires a Vercel account:

1. Install the Vercel CLI: `npm i -g vercel`
2. Link your project: `vercel link`
3. Pull environment variables (including OIDC token): `vercel env pull`

This will create a `.env.local` file with the necessary OIDC token for local development.

## API Usage

The container runner API is accessible via the following endpoint:

```
POST /api/github/run-vercel-sandbox
```

### Request Body

```json
{
  "files": [
    {
      "path": "index.js",
      "content": "console.log('Hello World');"
    },
    {
      "path": "package.json",
      "content": "{\"name\":\"test\",\"version\":\"1.0.0\",\"scripts\":{\"start\":\"node index.js\"}}"
    }
  ],
  "repoInfo": {
    "owner": "username",
    "repo": "repository-name"
  }
}
```

### Response

```json
{
  "success": true,
  "url": "https://sandbox-url.vercel.run",
  "sandboxId": "sandbox-id",
  "appType": "node"
}
```

## Stopping a Sandbox

To stop a running sandbox:

```
POST /api/github/stop-sandbox?id=sandbox-id
```

## Troubleshooting

### Common Issues

- **Error: Failed to create sandbox**
  - **Cause**: Network issues or Vercel API limits
  - **Solution**: Try again later or check your Vercel account status

- **Error: Sandbox timeout**
  - **Cause**: The sandbox took too long to start
  - **Solution**: Simplify your application or check for infinite loops

- **Error: Failed to run command**
  - **Cause**: Invalid start command or missing dependencies
  - **Solution**: Check your package.json scripts and dependencies

- **Error: Vercel authentication failed**
  - **Cause**: Missing or invalid OIDC token
  - **Solution**: Run `vercel env pull` to refresh your local OIDC token

## Supported Application Types

The container runner automatically detects and supports the following application types:

- Node.js
- React
- Next.js
- Python
- Flask
- FastAPI
- Streamlit
- Static HTML

Each application type has predefined start commands and port configurations. 