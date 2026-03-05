import { Hono } from 'hono'

type Bindings = { DB: D1Database }

export const clientPortalRoutes = new Hono<{ Bindings: Bindings }>()

// Client portal API routes are handled by main api.ts with client auth
// This file handles client-specific page rendering and data
