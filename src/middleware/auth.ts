import { createMiddleware } from 'hono/factory';
import { eq, and, gt } from 'drizzle-orm';
import { createDbClient } from '../db/client';
import * as schema from '../db/schema';
import { canPerformAction, canViewModule, isAdminRole, type CrudAction, type Module } from '../lib/permissions';

type Bindings = { DB: D1Database };
type AuthUser = { id: string; email: string; name: string; role: schema.User['role'] };
type Variables = { authUser: AuthUser };

/**
 * Verifies the Authorization: Bearer <token> header against a live,
 * unexpired session row (rather than trusting whatever role the client
 * claims) and attaches the resolved user to the request context.
 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const authHeader = c.req.header('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!token) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  const db = createDbClient(c.env.DB);
  const session = await db.query.sessions.findFirst({
    where: and(eq(schema.sessions.token, token), gt(schema.sessions.expiresAt, new Date().toISOString())),
    with: { user: true },
  });

  if (!session || !session.user || !session.user.isActive) {
    return c.json({ success: false, error: 'Invalid or expired session' }, 401);
  }

  c.set('authUser', {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  });

  await next();
});

/** Gate a route group behind ADMIN only (e.g. /api/admin/*). Must run after authMiddleware. */
export const requireAdmin = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  const user = c.get('authUser');
  if (!user || !isAdminRole(user.role)) {
    return c.json({ success: false, error: 'Administrator access required' }, 403);
  }
  await next();
});

/**
 * Gate a route group behind the editable CRUD role_permissions matrix.
 * Automatically infers CRUD action from HTTP method (GET -> read, POST -> create, PUT/PATCH -> update, DELETE -> delete)
 * or uses explicit action if specified.
 */
export function requireModule(mod: Module, explicitAction?: CrudAction) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const user = c.get('authUser');
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    if (isAdminRole(user.role)) {
      return await next();
    }

    let action: CrudAction = explicitAction || 'read';
    if (!explicitAction) {
      const method = c.req.method.toUpperCase();
      if (method === 'POST') action = 'create';
      else if (method === 'PUT' || method === 'PATCH') action = 'update';
      else if (method === 'DELETE') action = 'delete';
      else action = 'read';
    }

    const db = createDbClient(c.env.DB);
    const allowed = await canPerformAction(db, user.role, mod, action);
    if (!allowed) {
      return c.json(
        {
          success: false,
          error: `Access Denied: You do not have permission to ${action.toUpperCase()} in the ${mod} module`,
        },
        403
      );
    }
    await next();
  });
}
