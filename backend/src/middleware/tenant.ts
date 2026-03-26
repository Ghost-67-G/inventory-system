import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { CACHE_KEYS, redis } from '../config/redis';
import { TenantModel } from '../models/Tenant';
import { ApiError } from '../utils/ApiError';

const SELF_HOSTED_CACHE_TTL = 60 * 60; // 1 hour in seconds

export const resolveTenant = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
	if (config.DEPLOYMENT_MODE === 'saas') {
		if (!req.user?.tenantId) {
			next(new ApiError(401, 'Unauthorized'));
			return;
		}
		req.tenantId = req.user.tenantId;
		next();
		return;
	}

	// SELF_HOSTED: use Redis-cached single tenantId
	try {
		const cached = await redis.get(CACHE_KEYS.selfHostedTenantId);
		if (cached) {
			req.tenantId = cached;
			next();
			return;
		}

		const tenant = await TenantModel.findOne().select('_id isActive').lean();
		if (!tenant) {
			next(new ApiError(404, 'Tenant not found'));
			return;
		}
		if (!tenant.isActive) {
			next(new ApiError(403, 'Tenant account is suspended'));
			return;
		}

		const tenantId = String(tenant._id);
		await redis.set(CACHE_KEYS.selfHostedTenantId, tenantId, 'EX', SELF_HOSTED_CACHE_TTL);
		req.tenantId = tenantId;
		next();
	} catch (err) {
		next(err);
	}
};

// Backward-compatible alias
export const tenantResolver = resolveTenant;
