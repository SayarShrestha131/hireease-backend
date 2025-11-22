# Authentication API Documentation for React Native

## Overview

This document provides comprehensive guidance for integrating the authentication API endpoints into your React Native application. The API uses JWT (JSON Web Token) based authentication with email and password credentials.

**Base URL:** `http://your-server-url/api/auth`

---

## Endpoints

### 1. Register New User

**Endpoint:** `POST /api/auth/register`

**Description:** Creates a new user account with email and password.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "yourpassword123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | Valid email address (will be converted to lowercase) |
| password | string | Yes | Minimum 6 characters |

#### Response Codes

| Code | Description |
|------|-------------|
| 201 | User successfully created |
| 400 | Validation error (invalid email format or password too short) |
| 409 | Conflict - email already exists |
| 500 | Server error |

#### Success Response (201)

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Response Examples

**Validation Error (400)**
```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "statusCode": 400,
    "errors": [
      {
        "field": "email",
        "message": "Please provide a valid email"
      }
    ]
  }
}
```

**Conflict Error (409)**
```json
{
  "success": false,
  "error": {
    "message": "User with this email already exists",
    "statusCode": 409
  }
}
```

---

### 2. Login User

**Endpoint:** `POST /api/auth/login`

**Description:** Authenticates an existing user and returns a JWT token.

#### Request Body

```json
{
  "email": "user@example.com",
  "password": "yourpassword123"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User's email address |
| password | string | Yes | User's password |

#### Response Codes

| Code | Description |
|------|-------------|
| 200 | Login successful |
| 400 | Validation error (missing email or password) |
| 401 | Authentication failed (invalid credentials) |
| 500 | Server error |

#### Success Response (200)

```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Error Response Examples

**Authentication Error (401)**
```json
{
  "success": false,
  "error": {
    "message": "Invalid credentials",
    "statusCode": 401
  }
}
```

---

## React Native Integration

### Using Fetch API

#### Register Example

```javascript
const register = async (email, password) => {
  try {
    const response = await fetch('http://your-server-url/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error.message || 'Registration failed');
    }

    // Store the token
    await AsyncStorage.setItem('authToken', data.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.data.user));

    return data.data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};
```

#### Login Example

```javascript
const login = async (email, password) => {
  try {
    const response = await fetch('http://your-server-url/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error.message || 'Login failed');
    }

    // Store the token
    await AsyncStorage.setItem('authToken', data.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(data.data.user));

    return data.data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};
```

---

### Using Axios

First, install axios:
```bash
npm install axios
```

#### Register Example

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://your-server-url/api/auth';

const register = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/register`, {
      email,
      password,
    });

    // Store the token
    await AsyncStorage.setItem('authToken', response.data.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));

    return response.data.data;
  } catch (error) {
    if (error.response) {
      // Server responded with error
      throw new Error(error.response.data.error.message);
    } else if (error.request) {
      // Request made but no response
      throw new Error('No response from server');
    } else {
      throw new Error('Request failed');
    }
  }
};
```

#### Login Example

```javascript
const login = async (email, password) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/login`, {
      email,
      password,
    });

    // Store the token
    await AsyncStorage.setItem('authToken', response.data.data.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.data.data.user));

    return response.data.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error.message);
    } else if (error.request) {
      throw new Error('No response from server');
    } else {
      throw new Error('Request failed');
    }
  }
};
```

---

## Token Storage with AsyncStorage

### Installing AsyncStorage

```bash
npm install @react-native-async-storage/async-storage
```

### Storing the Token

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Store token after successful login/register
const storeAuthData = async (token, user) => {
  try {
    await AsyncStorage.setItem('authToken', token);
    await AsyncStorage.setItem('user', JSON.stringify(user));
  } catch (error) {
    console.error('Error storing auth data:', error);
  }
};
```

### Retrieving the Token

```javascript
const getAuthToken = async () => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    return token;
  } catch (error) {
    console.error('Error retrieving token:', error);
    return null;
  }
};
```

### Removing the Token (Logout)

```javascript
const logout = async () => {
  try {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('user');
  } catch (error) {
    console.error('Error during logout:', error);
  }
};
```

---

## Making Authenticated Requests

Once a user is logged in, include the JWT token in the `Authorization` header for all authenticated requests.

### Using Fetch API

```javascript
const makeAuthenticatedRequest = async (endpoint) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    
    if (!token) {
      throw new Error('No authentication token found');
    }

    const response = await fetch(`http://your-server-url/api${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error.message || 'Request failed');
    }

    return data;
  } catch (error) {
    console.error('Authenticated request error:', error);
    throw error;
  }
};
```

### Using Axios with Interceptors

Create an axios instance with automatic token injection:

```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const apiClient = axios.create({
  baseURL: 'http://your-server-url/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle 401 errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid - logout user
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      // Navigate to login screen
    }
    return Promise.reject(error);
  }
);

export default apiClient;
```

Usage:
```javascript
// Now you can make authenticated requests easily
const getUserProfile = async () => {
  try {
    const response = await apiClient.get('/user/profile');
    return response.data;
  } catch (error) {
    console.error('Error fetching profile:', error);
    throw error;
  }
};
```

---

## Complete Authentication Context Example

Here's a complete example of an authentication context for React Native:

```javascript
import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const AuthContext = createContext();

const API_BASE_URL = 'http://your-server-url/api/auth';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('user');
      
      if (token && userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const register = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/register`, {
        email,
        password,
      });

      const { user, token } = response.data.data;

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      setUser(user);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Registration failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      const response = await axios.post(`${API_BASE_URL}/login`, {
        email,
        password,
      });

      const { user, token } = response.data.data;

      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      setUser(user);
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error?.message || 'Login failed';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('user');
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        register,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
```

Usage in a component:
```javascript
import React, { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { useAuth } from './AuthContext';

const LoginScreen = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, error, loading } = useAuth();

  const handleLogin = async () => {
    const result = await login(email, password);
    if (result.success) {
      // Navigate to home screen
    }
  };

  return (
    <View>
      <TextInput
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <TextInput
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      <Button title="Login" onPress={handleLogin} disabled={loading} />
    </View>
  );
};
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. Network Request Failed

**Problem:** `TypeError: Network request failed`

**Solutions:**
- **iOS Simulator:** Use `http://localhost:3000` or your computer's local IP
- **Android Emulator:** Use `http://10.0.2.2:3000` (maps to host machine's localhost)
- **Physical Device:** Use your computer's IP address on the same network (e.g., `http://192.168.1.100:3000`)
- Ensure your backend server is running and accessible
- Check that you're not using `https` if your server doesn't have SSL

#### 2. CORS Errors

**Problem:** Cross-Origin Resource Sharing errors

**Solution:** Ensure your Express backend has CORS enabled:
```javascript
import cors from 'cors';
app.use(cors());
```

#### 3. AsyncStorage Not Found

**Problem:** `Cannot read property 'setItem' of undefined`

**Solution:** Install AsyncStorage:
```bash
npm install @react-native-async-storage/async-storage
cd ios && pod install
```

#### 4. Token Not Being Sent

**Problem:** Authenticated requests return 401

**Solutions:**
- Verify token is stored: `console.log(await AsyncStorage.getItem('authToken'))`
- Check Authorization header format: `Bearer <token>`
- Ensure token hasn't expired (default: 7 days)
- Verify backend middleware is checking for Authorization header

#### 5. Email Validation Fails

**Problem:** Registration returns 400 with "invalid email"

**Solutions:**
- Ensure email is properly formatted
- Check for extra whitespace (use `.trim()`)
- Verify email contains `@` and domain

#### 6. Password Too Short Error

**Problem:** Registration returns 400 with "password too short"

**Solution:** Ensure password is at least 6 characters long

#### 7. Connection Timeout

**Problem:** Requests timeout without response

**Solutions:**
- Check backend server is running
- Verify firewall isn't blocking connections
- Ensure correct IP address/port
- Try increasing axios timeout:
```javascript
axios.post(url, data, { timeout: 10000 })
```

#### 8. JSON Parse Error

**Problem:** `Unexpected token < in JSON`

**Solutions:**
- Server might be returning HTML error page instead of JSON
- Check server logs for errors
- Verify endpoint URL is correct
- Ensure Content-Type header is set to `application/json`

---

## Best Practices

1. **Store Sensitive Data Securely**
   - Use AsyncStorage for tokens (or consider more secure options like react-native-keychain for production)
   - Never log tokens in production

2. **Handle Token Expiration**
   - Implement token refresh logic
   - Redirect to login on 401 responses
   - Clear stored data on logout

3. **Validate Input**
   - Validate email format on client side
   - Check password length before sending
   - Provide clear error messages to users

4. **Error Handling**
   - Always wrap API calls in try-catch
   - Provide user-friendly error messages
   - Log errors for debugging

5. **Loading States**
   - Show loading indicators during API calls
   - Disable buttons while requests are in progress
   - Provide feedback on success/failure

6. **Network Resilience**
   - Implement retry logic for failed requests
   - Handle offline scenarios gracefully
   - Show appropriate messages when network is unavailable

---

## Environment Configuration

Create a config file for different environments:

```javascript
// config.js
const ENV = {
  dev: {
    apiUrl: 'http://10.0.2.2:3000/api',
  },
  staging: {
    apiUrl: 'https://staging-api.example.com/api',
  },
  prod: {
    apiUrl: 'https://api.example.com/api',
  },
};

const getEnvVars = () => {
  if (__DEV__) {
    return ENV.dev;
  }
  return ENV.prod;
};

export default getEnvVars();
```

Usage:
```javascript
import config from './config';

const response = await fetch(`${config.apiUrl}/auth/login`, {
  // ...
});
```

---

## Additional Resources

- [React Native AsyncStorage Documentation](https://react-native-async-storage.github.io/async-storage/)
- [Axios Documentation](https://axios-http.com/docs/intro)
- [JWT.io - Learn about JWT](https://jwt.io/)
- [React Navigation - Authentication Flow](https://reactnavigation.org/docs/auth-flow)

---

## Support

For issues or questions about the API, please contact the backend team or refer to the main project documentation.
