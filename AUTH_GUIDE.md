# JWT Authentication Implementation

## Overview

Secure JWT-based authentication with HTTP-only cookies for the US Music API.

## Features Implemented

✅ **User Registration** - Hash passwords with bcrypt (12 rounds)  
✅ **User Login** - JWT token generation  
✅ **HTTP-Only Cookies** - Secure token storage  
✅ **Token Refresh** - Automatic token renewal  
✅ **Protected Routes** - Middleware authentication  
✅ **Role-Based Access** - Authorization by user roles  
✅ **Logout** - Clear cookies and invalidate tokens  

## Security Best Practices

### Password Security
- **bcrypt hashing** with 12 salt rounds
- Passwords never stored in plain text
- Passwords excluded from queries by default
- Password validation on registration (min 8 characters)

### JWT Security
- **Access Token**: 7 days expiration
- **Refresh Token**: 30 days expiration
- Tokens stored in HTTP-only cookies
- Secure flag enabled in production (HTTPS only)
- SameSite policy (strict in production)
- Token verification on every protected route

### Cookie Security
```javascript
{
  httpOnly: true,        // Cannot be accessed by JavaScript
  secure: true,          // HTTPS only (production)
  sameSite: 'strict',    // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
}
```

## API Endpoints

### 1. Register User

**POST** `/api/v1/auth/register`

**Request Body:**
```json
{
  "username": "johndoe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "user": {
      "_id": "65abc123...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "createdAt": "2026-01-06T..."
    }
  }
}
```

**Cookies Set:**
- `accessToken` (HTTP-only, 7 days)
- `refreshToken` (HTTP-only, 30 days)

---

### 2. Login User

**POST** `/api/v1/auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "65abc123...",
      "username": "johndoe",
      "email": "john@example.com",
      "role": "user",
      "lastLogin": "2026-01-06T..."
    }
  }
}
```

**Cookies Set:**
- `accessToken` (HTTP-only, 7 days)
- `refreshToken` (HTTP-only, 30 days)

---

### 3. Get Current User

**GET** `/api/v1/auth/me`

**Headers:**
- Cookie: `accessToken=<token>`

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "65abc123...",
    "username": "johndoe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

---

### 4. Refresh Token

**POST** `/api/v1/auth/refresh`

Automatically reads `refreshToken` from cookie.

**Response:**
```json
{
  "success": true,
  "message": "Token refreshed successfully"
}
```

**New Cookies Set:**
- Fresh `accessToken` (7 days)
- Fresh `refreshToken` (30 days)

---

### 5. Logout

**POST** `/api/v1/auth/logout`

**Headers:**
- Cookie: `accessToken=<token>`

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Cookies Cleared:**
- `accessToken` removed
- `refreshToken` removed

## Middleware Usage

### Protect Routes (Authentication Required)

```javascript
import { authenticate } from './middleware/auth.js';

// Protected route
router.get('/profile', authenticate, getUserProfile);
```

### Role-Based Authorization

```javascript
import { authenticate, authorize } from './middleware/auth.js';

// Only artists can upload songs
router.post('/songs', 
  authenticate, 
  authorize('artist', 'admin'), 
  createSong
);
```

### Optional Authentication

```javascript
import { optionalAuth } from './middleware/auth.js';

// Public route with optional user context
router.get('/songs', optionalAuth, getSongs);
// req.user will be set if token is valid, undefined otherwise
```

## Frontend Integration

### Using Fetch API

```javascript
// Login
const login = async (email, password) => {
  const response = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Important: Include cookies
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();
  return data;
};

// Protected request
const getProfile = async () => {
  const response = await fetch('http://localhost:5000/api/v1/auth/me', {
    credentials: 'include', // Include cookies
  });

  const data = await response.json();
  return data;
};

// Logout
const logout = async () => {
  const response = await fetch('http://localhost:5000/api/v1/auth/logout', {
    method: 'POST',
    credentials: 'include',
  });

  const data = await response.json();
  return data;
};
```

### Using Axios

```javascript
import axios from 'axios';

// Configure axios to include cookies
axios.defaults.withCredentials = true;

// Login
const login = async (email, password) => {
  const { data } = await axios.post(
    'http://localhost:5000/api/v1/auth/login',
    { email, password }
  );
  return data;
};

// Protected request
const getProfile = async () => {
  const { data } = await axios.get('http://localhost:5000/api/v1/auth/me');
  return data;
};

// Logout
const logout = async () => {
  const { data } = await axios.post('http://localhost:5000/api/v1/auth/logout');
  return data;
};
```

## Error Handling

### Common Error Responses

**401 Unauthorized** - Invalid or expired token
```json
{
  "success": false,
  "error": "Token expired"
}
```

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "error": "Password must be at least 8 characters"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "success": false,
  "error": "You do not have permission to perform this action"
}
```

## Testing with cURL

### Register
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

### Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123"
  }'
```

### Protected Request
```bash
curl -X GET http://localhost:5000/api/v1/auth/me \
  -b cookies.txt
```

### Logout
```bash
curl -X POST http://localhost:5000/api/v1/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

## Database Schema

### User Model

```javascript
{
  username: String,      // Unique, 3-30 characters
  email: String,         // Unique, validated
  password: String,      // Hashed with bcrypt
  role: String,          // 'user', 'artist', 'admin'
  profile: {
    displayName: String,
    avatar: String,
    bio: String
  },
  isActive: Boolean,     // Account status
  lastLogin: Date,       // Last login timestamp
  refreshToken: String,  // Current refresh token
  createdAt: Date,
  updatedAt: Date
}
```

## Token Structure

### Access Token Payload
```json
{
  "userId": "65abc123...",
  "iat": 1704556800,
  "exp": 1705161600
}
```

### Refresh Token Payload
```json
{
  "userId": "65abc123...",
  "iat": 1704556800,
  "exp": 1707148800
}
```

## Environment Variables

```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-token-secret-change-this
JWT_REFRESH_EXPIRES_IN=30d
```

## Security Checklist

✅ Passwords hashed with bcrypt (12 rounds)  
✅ JWT tokens with expiration  
✅ HTTP-only cookies  
✅ Secure flag in production  
✅ SameSite protection  
✅ CORS configured  
✅ Rate limiting enabled  
✅ Input validation (Joi)  
✅ MongoDB sanitization  
✅ Helmet security headers  
✅ Error handling middleware  
✅ Token refresh mechanism  
✅ Logout functionality  

## Production Deployment

### HTTPS Required

In production, ensure:
1. SSL/TLS certificate installed
2. `secure: true` cookie flag active
3. `sameSite: 'strict'` enabled
4. CORS restricted to your domain

### Environment Setup

```bash
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
JWT_REFRESH_SECRET=<strong-random-secret>
FRONTEND_URL=https://yourdomain.com
```

### Generate Strong Secrets

```bash
# Generate random secret (32 bytes)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Troubleshooting

### "Token expired" Error
- Use `/api/v1/auth/refresh` to get new token
- Check if access token expiration is too short

### Cookies Not Sent
- Ensure `credentials: 'include'` in fetch/axios
- Check CORS configuration
- Verify cookie domain matches

### "User not found" After Login
- Check if user exists in database
- Verify token payload contains correct userId
- Check if user is marked as active

## Additional Resources

- [JWT Best Practices](https://jwt.io/introduction)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
