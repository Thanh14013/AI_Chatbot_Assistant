/**
 * CodeBlock Demo/Example
 * This file demonstrates how the CodeBlock component works
 */

import React from "react";
import { App } from "antd";
import CodeBlock from "./CodeBlock";

/**
 * Example messages showing different code blocks
 */
export const codeBlockExamples = {
  javascript: `function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}


  python: `def quick_sort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    middle = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quick_sort(left) + middle + quick_sort(right)

print(quick_sort([3, 6, 8, 10, 1, 2, 1]))`,

  typescript: `interface User {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

const createUser = (userData: Omit<User, 'id'>): User => {
  return {
    id: Date.now(),
    ...userData,
  };
};`,

  html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beautiful Form</title>
</head>
<body>
  <form class="contact-form">
    <input type="text" placeholder="Name" required />
    <input type="email" placeholder="Email" required />
    <textarea placeholder="Message"></textarea>
    <button type="submit">Send</button>
  </form>
</body>
</html>`,

  css: `.card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}`,

  json: `{
  "name": "ai-chatbot",
  "version": "1.0.0",
  "description": "AI-powered chatbot with code highlighting",
  "dependencies": {
    "react": "^18.3.1",
    "react-syntax-highlighter": "^15.5.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  }
}`,

  bash: `#!/bin/bash

# Deploy script
echo "Starting deployment..."

# Build the project
npm run build

# Run tests
npm test

# Deploy to production
if [ $? -eq 0 ]; then
  echo "Tests passed! Deploying..."
  npm run deploy
else
  echo "Tests failed! Aborting deployment."
  exit 1
fi`,

  sql: `-- Create users table
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- Insert sample data
INSERT INTO users (username, email, password_hash)
VALUES ('john_doe', 'john@example.com', 'hashed_password_here');`,
};

/**
 * Demo component showing CodeBlock usage
 */
const CodeBlockDemo: React.FC = () => {
  return (
    <App>
      <div style={{ padding: "24px", maxWidth: "800px", margin: "0 auto" }}>
        <h1>Code Block Examples</h1>

        <h2>JavaScript</h2>
        <CodeBlock code={codeBlockExamples.javascript} language="javascript" />

        <h2>Python</h2>
        <CodeBlock code={codeBlockExamples.python} language="python" />

        <h2>TypeScript</h2>
        <CodeBlock code={codeBlockExamples.typescript} language="typescript" />

        <h2>HTML</h2>
        <CodeBlock code={codeBlockExamples.html} language="html" />

        <h2>CSS</h2>
        <CodeBlock code={codeBlockExamples.css} language="css" />

        <h2>JSON</h2>
        <CodeBlock code={codeBlockExamples.json} language="json" />

        <h2>Bash</h2>
        <CodeBlock code={codeBlockExamples.bash} language="bash" />

        <h2>SQL</h2>
        <CodeBlock code={codeBlockExamples.sql} language="sql" />

        <h2>User Message Example</h2>
        <CodeBlock
          code={codeBlockExamples.javascript}
          language="javascript"
          isUserMessage={true}
        />
      </div>
    </App>
  );
};

export default CodeBlockDemo;
