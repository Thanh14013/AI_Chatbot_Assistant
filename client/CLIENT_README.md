# AI Chatbot Assistant - Frontend Client

React + TypeScript + Vite frontend application for AI Chatbot Assistant.

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server
- **Ant Design 5** - UI component library
- **Axios** - HTTP client with interceptors
- **React Router 7** - Client-side routing
- **Socket.io Client** - Real-time communication

## Features

- ✅ JWT Authentication with auto-refresh
- ✅ Protected routes
- ✅ Axios interceptors for token management
- ✅ Light theme configuration
- ✅ Development proxy to backend
- ✅ TypeScript strict mode
- ✅ Path aliases (@/ for src/)

## Project Structure

```
src/
├── components/       # Reusable React components
│   ├── ProtectedRoute.tsx
│   └── index.ts
├── config/          # Configuration files
│   ├── env.config.ts
│   └── index.ts
├── hooks/           # Custom React hooks
│   ├── useAuth.ts
│   ├── useAuthContext.tsx
│   └── index.ts
├── pages/           # Page components
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── NotFoundPage.tsx
│   └── index.ts
├── services/        # API services
│   ├── axios.service.ts
│   ├── auth.service.ts
│   └── index.ts
├── stores/          # State management (future)
├── types/           # TypeScript type definitions
│   ├── auth.type.ts
│   ├── api.type.ts
│   └── index.ts
├── utils/           # Utility functions
│   ├── token.util.ts
│   └── index.ts
├── App.tsx          # Main app component with routes
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Setup & Installation

### Prerequisites

- Node.js 18+ and npm/yarn
- Backend server running on `http://localhost:3000`

### Install Dependencies

```bash
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Key Features Implementation

### 1. Axios Instance with Interceptors

Located in `src/services/axios.service.ts`:

- **Request Interceptor**: Automatically attaches JWT access token to every request
- **Response Interceptor**:
  - Handles 401 errors (unauthorized)
  - Automatically refreshes expired access tokens
  - Retries failed requests with new token
  - Queues requests during token refresh
  - Redirects to login on refresh failure

### 2. Authentication Flow

- **Login/Register**: Saves tokens to localStorage
- **Auto Token Refresh**: Transparent to user, happens automatically
- **Protected Routes**: Redirects to login if not authenticated
- **Logout**: Clears tokens and redirects to login

### 3. React Router Configuration

Routes configured in `App.tsx`:

- `/login` - Login page (public)
- `/register` - Register page (public)
- `/` - Home page (protected)
- `*` - 404 Not Found page

### 4. Development Proxy

Configured in `vite.config.ts`:

- Proxies `/api/*` requests to `http://localhost:3000`
- Eliminates CORS issues in development
- Seamless API calls without hardcoding backend URL

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## API Integration

The frontend communicates with the backend API:

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/logout` - Logout user

### Usage Example

```typescript
import { login } from "@/services/auth.service";

// Login user
const response = await login({
  email: "user@example.com",
  password: "password123",
});

// Tokens are automatically saved to localStorage
// Subsequent API calls will include the access token
```

## Custom Hooks

### useAuth

Main authentication hook:

```typescript
import { useAuth } from "@/hooks";

function Component() {
  const { user, isAuthenticated, login, logout } = useAuth();

  // Use authentication state and methods
}
```

### useAuthContext

Lower-level context hook:

```typescript
import { useAuthContext } from "@/hooks";

function Component() {
  const { user, isAuthenticated, isLoading } = useAuthContext();

  // Access authentication state
}
```

## Type Safety

All API responses and requests are fully typed:

- `AuthResponse` - Login/Register response
- `RefreshTokenResponse` - Token refresh response
- `User` - User object structure
- `ApiResponse<T>` - Generic API response
- `ApiErrorResponse` - Error response structure

## Next Steps

- [ ] Implement Login/Register UI forms
- [ ] Add chat interface
- [ ] Implement real-time messaging with Socket.io
- [ ] Add user settings page
- [ ] Implement conversation management
- [ ] Add loading skeletons
- [ ] Error boundary components
- [ ] Toast notifications

## License

MIT
