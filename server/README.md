# Server (Backend)

This folder contains the backend server for the AI Chatbot Assistant.

## Quick setup

1. Copy `.env.example` to `.env` and fill the values (DATABASE_URL, JWT secrets, etc.).

2. Install dependencies:

```powershell
cd server
npm install
```

3. Run migrations (requires a running Postgres instance):

```powershell
npm run migrate
```

4. Start development server:

```powershell
npm run dev
```

The server will run on the port defined in `.env` (default 3000). Health check: http://localhost:3000/health

## Swagger API docs

After starting the server, API docs are available at:

http://localhost:3000/docs

The docs include all authentication endpoints with examples.

## Auth endpoints

Base path: `/api/auth`

- POST /api/auth/register
  - Body JSON: { name, email, password, confirmPassword? }
  - Success 201: { success: true, message: "User registered successfully" }

- POST /api/auth/login
  - Body JSON: { email, password }
  - Success 200: Sets HttpOnly cookie `refreshToken`; response body includes `data.accessToken` and `data.user`.

- POST /api/auth/refresh
  - Body JSON (optional): { refreshToken }
  - Can also read refresh token from HttpOnly cookie `refreshToken`.
  - Success 200: { success: true, message: "Token refreshed successfully", data: { accessToken } }

- POST /api/auth/logout
  - Body JSON (optional): { refreshToken }
  - Clears refresh token cookie and revokes tokens server-side.

## Notes

- The server expects `refreshToken` to be stored as an HttpOnly cookie named `refreshToken` for normal flows. The refresh endpoint also accepts a `refreshToken` in the body for non-browser clients.
- See `/src/swagger.json` for the OpenAPI spec used by the docs.
