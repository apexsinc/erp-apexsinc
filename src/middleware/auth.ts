import { createMiddleware } from 'hono/factory';
import { eq, and, gt } from 'drizzle-orm';
import { createDbClient } from '../db/client';
import * as schema from '../db/schema';
import { canViewModule, isAdminRole, type Module } from '../lib/permissions';

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

/** Gate a route group behind the editable role_permissions matrix for the given sidebar module. Must run after authMiddleware. */
export function requireModule(mod: Module) {
  return createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
    const user = c.get('authUser');
    const db = createDbClient(c.env.DB);
    const allowed = user && (await canViewModule(db, user.role, mod));
    if (!allowed) {
      return c.json({ success: false, error: 'You do not have access to this module' }, 403);
    }
    await next();
  });
}
