# GitHub Integration Setup

This document describes how to set up GitHub integration for the PaprChat code artifacts.

## Features

- **GitHub OAuth Authentication**: Connect your GitHub account to access repositories
- **Repository Browser**: IDE-like file explorer for GitHub repositories
- **Live Code Editor**: Edit files directly in the browser with syntax highlighting
- **App Runner**: Execute Python apps, static HTML, and React projects
- **File System Support**: Multi-file projects with proper directory structure
- **Real-time Sync**: Save changes back to GitHub with commit messages

## Setup Instructions

### 1. Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Fill in the application details:
   - **Application name**: PaprChat
   - **Homepage URL**: `http://localhost:3000` (or your domain)
   - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
4. Click "Register application"
5. Copy the Client ID and Client Secret

### 2. Environment Variables

Add these variables to your `.env.local` file:

```bash
# GitHub OAuth (for repository integration)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. Restart Development Server

```bash
npm run dev
```

## Usage

### Connecting to GitHub

1. Open a chat and create a code artifact
2. Click "Connect GitHub" in the file explorer
3. Authorize the application
4. Your repositories will appear in the dropdown

### Working with Files

1. **Select Repository**: Choose from your GitHub repositories
2. **Browse Files**: Navigate through folders and files
3. **Edit Files**: Click on a file to open it in the editor
4. **Save Changes**: Click "Save to GitHub" to commit changes
5. **Run Code**: Execute individual files or entire applications

### App Runner

The system can detect and run different types of applications:

- **Python Web Apps**: Flask, FastAPI, Streamlit
- **Python CLI**: Command-line scripts with output capture
- **Static HTML**: HTML/CSS/JavaScript websites
- **React Apps**: JSX components with live preview

### Supported File Types

- Python (`.py`)
- JavaScript/TypeScript (`.js`, `.jsx`, `.ts`, `.tsx`)
- HTML (`.html`)
- CSS (`.css`)
- Markdown (`.md`)
- JSON (`.json`)
- And more...

## Security

- **Sandboxed Execution**: Python runs in Pyodide (WebAssembly) sandbox
- **Limited Permissions**: Only repository access, no system-level permissions
- **OAuth Tokens**: Stored securely in NextAuth session
- **No Server Execution**: All code runs client-side in the browser

## Troubleshooting

### "GitHub not connected" Error

1. Ensure environment variables are set correctly
2. Restart the development server
3. Clear browser cache and cookies
4. Try connecting again

### Repository Not Loading

1. Check that you have access to the repository
2. Ensure the repository is not empty
3. Try refreshing the repository list

### Code Execution Issues

1. Check that dependencies are available in Pyodide
2. Review the terminal output for error messages
3. Ensure file paths are correct

## Limitations

- **Pyodide Packages**: Not all Python packages are available
- **File Size**: Large files may take time to load
- **Network Dependent**: Requires internet connection for GitHub API
- **Browser Resources**: Complex apps may consume significant memory

## Example Projects

### Python Flask App

```python
# app.py
from flask import Flask

app = Flask(__name__)

@app.route('/')
def hello():
    return '<h1>Hello from PaprChat!</h1>'

if __name__ == '__main__':
    app.run(debug=True)
```

### Static HTML Site

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head>
    <title>My App</title>
</head>
<body>
    <h1>Welcome to My App</h1>
    <script src="script.js"></script>
</body>
</html>
```

### React Component

```jsx
// App.js
function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>Counter: {count}</h1>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}
```

## Contributing

To contribute to the GitHub integration:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues or questions about GitHub integration:

1. Check the troubleshooting section
2. Review the console logs
3. Create an issue in the repository
4. Contact the development team 