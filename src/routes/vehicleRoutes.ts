import { Router } from 'express';
import {
  getVehicles,
  getVehicleById,
  getFilterOptions,
  createVehicle,
} from '../controllers/vehicleController';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/adminAuth';

const router = Router();

/**
 * @route   GET /api/vehicles
 * @desc    Get all vehicles with search and filtering
 * @access  Public
 */
router.get('/', getVehicles);

/**
 * @route   GET /api/vehicles/filters/options
 * @desc    Get filter options
 * @access  Public
 */
router.get('/filters/options', getFilterOptions);

/**
 * @route   GET /api/vehicles/:id
 * @desc    Get single vehicle by ID
 * @access  Public
 */
router.get('/:id', getVehicleById);

/**
 * @route   POST /api/vehicles
 * @desc    Create a new vehicle
 * @access  Admin only
 */
router.post('/', authenticate, requireAdmin, createVehicle);

export default router;
