import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { requirePermission } from '../../middleware/rbac';
import { resolveTenant } from '../../middleware/tenant';
import { validate } from '../../middleware/validate';
import * as controller from './users.controller';
import {
	deactivateUserSchema,
	getUserSchema,
	inviteUserSchema,
	listUsersSchema,
	reactivateUserSchema,
	updateMyProfileSchema,
	updateUserSchema
} from './users.schema';

const router = Router();

router.use(authenticate, resolveTenant);

router.get('/me', controller.getMyProfile);
router.patch('/me', validate(updateMyProfileSchema), controller.updateMyProfile);

router.get('/', validate(listUsersSchema), requirePermission('user.view'), controller.listUsers);
router.get('/:userId', validate(getUserSchema), requirePermission('user.view'), controller.getOne);
router.post('/', validate(inviteUserSchema), requirePermission('user.invite'), controller.invite);
router.patch('/:userId', validate(updateUserSchema), requirePermission('user.update'), controller.update);
router.delete(
	'/:userId',
	validate(deactivateUserSchema),
	requirePermission('user.deactivate'),
	controller.deactivate
);
router.post(
	'/:userId/reactivate',
	validate(reactivateUserSchema),
	requirePermission('user.deactivate'),
	controller.reactivate
);

export default router;
