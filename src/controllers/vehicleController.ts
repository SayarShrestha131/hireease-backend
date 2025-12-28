import { Request, Response, NextFunction } from 'express';
import Vehicle from '../models/Vehicle';

/**
 * Get all vehicles with search and filtering
 * @route GET /api/vehicles
 */
export const getVehicles = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const {
      search,
      type,
      fuelType,
      transmission,
      minPrice,
      maxPrice,
      seats,
      available,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 10,
    } = req.query;

    // Build filter query
    const filter: any = {};

    // Search by name, brand, model, or description
    if (search) {
      filter.$text = { $search: search as string };
    }

    // Filter by type
    if (type) {
      filter.type = type;
    }

    // Filter by fuel type
    if (fuelType) {
      filter.fuelType = fuelType;
    }

    // Filter by transmission
    if (transmission) {
      filter.transmission = transmission;
    }

    // Filter by price range
    if (minPrice || maxPrice) {
      filter.pricePerDay = {};
      if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
      if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
    }

    // Filter by seats
    if (seats) {
      filter.seats = Number(seats);
    }

    // Filter by availability
    if (available !== undefined) {
      filter['availability.isAvailable'] = available === 'true';
    }

    // Build sort object
    const sortOrder = order === 'asc' ? 1 : -1;
    const sort: any = { [sortBy as string]: sortOrder };

    // Pagination
    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Execute query
    const vehicles = await Vehicle.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const total = await Vehicle.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        vehicles,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single vehicle by ID
 * @route GET /api/vehicles/:id
 */
export const getVehicleById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { id } = req.params;

    const vehicle = await Vehicle.findById(id);

    if (!vehicle) {
      res.status(404).json({
        success: false,
        error: 'Vehicle not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get filter options (for filter UI)
 * @route GET /api/vehicles/filters/options
 */
export const getFilterOptions = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get unique values for filters
    const types = await Vehicle.distinct('type');
    const fuelTypes = await Vehicle.distinct('fuelType');
    const transmissions = await Vehicle.distinct('transmission');
    const seats = await Vehicle.distinct('seats');
    const locations = await Vehicle.distinct('availability.location');

    // Get price range
    const priceRange = await Vehicle.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: '$pricePerDay' },
          maxPrice: { $max: '$pricePerDay' },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        types,
        fuelTypes,
        transmissions,
        seats: seats.sort((a, b) => a - b),
        locations,
        priceRange: priceRange[0] || { minPrice: 0, maxPrice: 100000 },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new vehicle (Admin only - for now public for testing)
 * @route POST /api/vehicles
 */
export const createVehicle = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const vehicle = await Vehicle.create(req.body);

    res.status(201).json({
      success: true,
      message: 'Vehicle created successfully',
      data: {
        vehicle,
      },
    });
  } catch (error) {
    next(error);
  }
};
