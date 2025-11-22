# Express TypeScript Backend

A production-ready backend server built with Express.js, TypeScript, and MongoDB Atlas. This project provides a solid foundation for building RESTful APIs with type safety, proper error handling, and cloud database integration.

## Features

- **TypeScript**: Full type safety and modern JavaScript features
- **Express.js**: Fast and minimalist web framework
- **MongoDB Atlas**: Cloud-hosted database with Mongoose ODM
- **Hot Reload**: Automatic recompilation during development
- **Error Handling**: Centralized error handling middleware
- **Environment Configuration**: Secure configuration management with dotenv

## Prerequisites

Before you begin, ensure you have the following installed:

- Node.js (v16 or higher)
- npm (v7 or higher)
- A MongoDB Atlas account (free tier available)

## MongoDB Atlas Setup

### 1. Create a MongoDB Atlas Account

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account or log in
3. Create a new project

### 2. Create a Database Cluster

1. Click "Build a Database"
2. Choose the FREE tier (M0 Sandbox)
3. Select your preferred cloud provider and region
4. Click "Create Cluster" (this may take a few minutes)

### 3. Configure Database Access

1. Go to "Database Access" in the left sidebar
2. Click "Add New Database User"
3. Choose "Password" authentication
4. Create a username and secure password (save these for later)
5. Set user privileges to "Read and write to any database"
6. Click "Add User"

### 4. Configure Network Access

1. Go to "Network Access" in the left sidebar
2. Click "Add IP Address"
3. For development, click "Allow Access from Anywhere" (0.0.0.0/0)
   - **Note**: For production, restrict to specific IP addresses
4. Click "Confirm"

### 5. Get Your Connection String

1. Go to "Database" in the left sidebar
2. Click "Connect" on your cluster
3. Choose "Connect your application"
4. Select "Node.js" as the driver and version 5.5 or later
5. Copy the connection string (it looks like):
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add your database name after `.net/` (e.g., `.net/myapp?retryWrites=true`)

## Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment configuration:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your configuration:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb+srv://your-username:your-password@cluster.mongodb.net/your-database?retryWrites=true&w=majority
   ```

## Environment Variables

The application requires the following environment variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Application environment | `development`, `production`, or `test` |
| `PORT` | Port number for the server | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/db?retryWrites=true&w=majority` |

### Important Notes:

- Never commit the `.env` file to version control
- Use `.env.example` as a template for required variables
- Ensure your MongoDB URI includes the database name
- Keep your database credentials secure

## Running the Application

### Development Mode

Development mode includes hot-reloading, which automatically restarts the server when you make changes to the code:

```bash
npm run dev
```

The server will start on the port specified in your `.env` file (default: 5000).

You should see output similar to:
```
[INFO] Server is running on port 5000
[INFO] MongoDB connected successfully
```

### Production Mode

For production deployment, first build the TypeScript code:

```bash
npm run build
```

This compiles TypeScript files from `src/` to JavaScript in `dist/`.

Then start the production server:

```bash
npm start
```

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.ts       # MongoDB connection logic
│   ├── routes/
│   │   └── index.ts          # API route definitions
│   ├── middleware/
│   │   └── errorHandler.ts   # Global error handling
│   ├── types/
│   │   └── environment.d.ts  # TypeScript environment types
│   └── server.ts             # Main application entry point
├── dist/                     # Compiled JavaScript (generated)
├── node_modules/             # Dependencies (generated)
├── .env                      # Environment variables (not in git)
├── .env.example              # Environment variable template
├── .gitignore               # Git ignore patterns
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
└── README.md                # This file
```

## API Endpoints

### Health Check

Check if the server and database are running:

```
GET /health
```

**Response:**
```json
{
  "success": true,
  "message": "Server is running",
  "database": "connected"
}
```

## Development Workflow

1. Make changes to TypeScript files in the `src/` directory
2. The development server automatically recompiles and restarts
3. Test your changes using the API endpoints
4. Check the console for any errors or logs

## Troubleshooting

### Server won't start

- Verify all environment variables are set in `.env`
- Check that the PORT is not already in use
- Ensure Node.js and npm are installed correctly

### Database connection fails

- Verify your MongoDB Atlas connection string is correct
- Check that your IP address is whitelisted in MongoDB Atlas Network Access
- Ensure your database username and password are correct
- Confirm your database user has proper permissions

### TypeScript compilation errors

- Run `npm run build` to see detailed error messages
- Check that all dependencies are installed: `npm install`
- Verify your `tsconfig.json` configuration

### Hot reload not working

- Ensure you're running `npm run dev` (not `npm start`)
- Check that ts-node-dev is installed in devDependencies
- Try stopping the server and running `npm run dev` again

## Scripts Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Compile TypeScript to JavaScript |
| `npm start` | Start production server (requires build first) |

## Next Steps

Now that your backend is set up, you can:

1. Add new routes in `src/routes/`
2. Create Mongoose models for your data
3. Implement authentication and authorization
4. Add input validation middleware
5. Set up logging with Winston or Pino
6. Configure CORS for frontend integration
7. Add rate limiting for API protection

## License

ISC
