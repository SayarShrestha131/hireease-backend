# Admin Panel Setup Guide

## Overview
The admin panel is a web-based interface for managing vehicles in the rental system. Admins can add, view, and manage vehicles that will be displayed in the mobile app.

## Setup Instructions

### 1. Create Admin User

Run the following command in the backend directory:

```bash
npm run create-admin
```

This will create an admin user with the following credentials:
- **Email:** admin@vehiclerental.com
- **Password:** admin123456

**⚠️ IMPORTANT:** Change these credentials after first login in production!

### 2. Access Admin Panel

Once the backend server is running, access the admin panel at:

```
http://localhost:5000/admin.html
```

Or if accessing from another device on the same network:

```
http://YOUR_LOCAL_IP:5000/admin.html
```

### 3. Login

Use the admin credentials created in step 1 to login.

## Features

### Admin Panel Features:
- ✅ Secure admin-only login
- ✅ Add new vehicles with complete details
- ✅ View all vehicles in the system
- ✅ Real-time updates
- ✅ Responsive design

### Vehicle Information:
- Basic Info: Name, Brand, Model, Year
- Type: Sedan, SUV, Hatchback, Truck, Van, Sports, Electric
- Fuel Type: Petrol, Diesel, Electric, Hybrid
- Transmission: Manual, Automatic
- Specifications: Engine, Power, Mileage, Color
- Pricing: Price per day in Rupees
- Availability: Location and availability status
- Features: AC, GPS, Bluetooth, etc.

## How It Works

1. **Admin Login:** Admin logs in with credentials
2. **Add Vehicle:** Admin fills out the vehicle form
3. **Save to Database:** Vehicle is saved to MongoDB
4. **Mobile App:** Users see the vehicle in the mobile app immediately
5. **Search & Filter:** Users can search and filter vehicles

## Security

- Admin routes are protected with JWT authentication
- Only users with `role: 'admin'` can add vehicles
- Regular users cannot access admin endpoints
- Token-based authentication for all admin operations

## API Endpoints

### Admin Protected:
- `POST /api/vehicles` - Create new vehicle (Admin only)

### Public:
- `GET /api/vehicles` - Get all vehicles with filters
- `GET /api/vehicles/:id` - Get single vehicle
- `GET /api/vehicles/filters/options` - Get filter options

## Troubleshooting

### Cannot Login
- Ensure admin user is created (`npm run create-admin`)
- Check that backend server is running
- Verify credentials are correct

### Cannot Add Vehicle
- Ensure you're logged in as admin
- Check browser console for errors
- Verify all required fields are filled

### Vehicles Not Showing in Mobile App
- Check that backend server is running
- Verify mobile app is connected to correct API URL
- Check network connectivity

## Production Notes

1. **Change Admin Credentials:** Update default admin password
2. **Enable HTTPS:** Use SSL certificates in production
3. **Environment Variables:** Store sensitive data in .env
4. **Rate Limiting:** Add rate limiting to prevent abuse
5. **Input Validation:** Already implemented with express-validator
