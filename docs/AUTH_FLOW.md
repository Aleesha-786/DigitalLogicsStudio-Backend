# Backend Authentication Flow

The backend uses cookie-based JWT sessions. The browser stores the token as an httpOnly cookie, while the frontend only stores sanitized user state in React context.

> **This revision adds** the password-reset (OTP) flow and the notification-preference
> toggle, both of which are fully implemented but weren't documented before, and flags
> two controller functions that exist in code but aren't exposed via any route yet.

## Registration Flow

1. Frontend submits `name`, `email`, and `password` to `POST /api/auth/register`.
2. Controller validates required fields, name length, email format, and password length.
3. Email is trimmed and lowercased.
4. Backend checks for an existing user with the same email.
5. Mongoose creates the user (`role` defaults to `"student"` — there is no way to
   request a different role at signup).
6. `pre("save")` hashes the password with bcrypt.
7. Backend signs a JWT containing `{ userId }`.
8. Backend sets the `token` cookie.
9. A welcome email is enqueued (fire-and-forget — never blocks the response; see
   `EMAIL_NOTIFICATIONS.md`).
10. Backend returns sanitized user data.

## Login Flow

1. Frontend submits `email` and `password` to `POST /api/auth/login`.
2. Backend lowercases the email and fetches the user with `select("+password")`.
3. `matchPassword` compares the submitted password with the bcrypt hash.
4. Backend signs a JWT and sets the auth cookie.
5. Backend returns sanitized user data.

## Session Restore Flow

1. Frontend calls `GET /api/auth/me` on app boot.
2. Browser sends the `token` cookie if CORS and cookie settings allow credentials.
3. `protect` verifies the JWT with `JWT_SECRET`.
4. Backend loads the user by `decoded.userId` (selecting `_id name email createdAt
   solvedProblems notifications role`) and excludes `password`.
5. Backend attaches the user document to `req.user`.
6. Controller returns sanitized user data.

## Logout Flow

1. Frontend calls `POST /api/auth/logout`.
2. Backend clears the `token` cookie using matching cookie options.
3. Frontend clears in-memory auth state.

## Password Reset Flow (OTP-based) — Implemented

Three-step flow, unauthenticated (the user isn't logged in yet, by definition):

1. **`POST /api/auth/forgot-password`** — `{ email }`. Rate-limited (5 requests / 15 min
   per IP via `otpRequestLimiter`). If the account exists, generates a 6-digit OTP,
   stores its SHA-256 hash + a 10-minute expiry on `user.resetPassword`, and emails it
   via `sendPasswordResetOTP`. **Always returns the same 200 message regardless of
   whether the email exists**, to avoid leaking account existence. If the email fails
   to send, the OTP state is rolled back and a `502` is returned instead.
2. **`POST /api/auth/verify-reset-otp`** — `{ email, otp }`. Rate-limited (15 requests /
   15 min via `otpVerifyLimiter`). Checks the OTP hash and expiry, and enforces a max of
   5 incorrect attempts (`MAX_OTP_ATTEMPTS`) before forcing a fresh
   `forgot-password` request. On success, issues a random 32-byte `resetToken`, stores
   its hash + a 15-minute expiry, and returns the **plaintext** `resetToken` to the
   client (it's a bearer-style credential for the next step, not something re-checked
   against a hash on the client side).
3. **`POST /api/auth/reset-password`** — `{ email, resetToken, password }`. Also behind
   `otpVerifyLimiter`. Validates the reset token hash + expiry, sets the new password
   (re-hashed by the `pre("save")` hook), clears all `resetPassword` state, clears the
   auth cookie (forcing a fresh login), and returns success.

Note the naming: this reset-token exchange step is handled by `otpVerifyLimiter` in the
route file, reusing the same limiter instance as OTP verification rather than a
dedicated one.

## Notification Preference Toggle — Implemented

**`PATCH /api/auth/notifications`** — `{ optedOut: boolean }`. Requires `protect`.
Flips `req.user.notifications.optedOut` and saves. Every scheduled/triggered
notification (`sendWelcomeNotification`, `checkMilestones`, `runInactivityCheck`,
`runWeeklyDigest`) checks this flag before enqueueing anything. See
`EMAIL_NOTIFICATIONS.md`.

## Implemented in Code, Not Yet Routed

`src/controllers/authController.js` also exports `changePassword` and
`deleteAccount` — both fully implemented (current-password re-verification,
password-length validation for the former; password confirmation +
cascading delete of `UserProgress`/`EmailQueue`/the user document for the latter) —
but **`authRoutes.js` does not import or mount either one.** There is currently no way
to reach this logic over HTTP. If you need these, add routes such as:

```js
router.patch("/change-password", protect, changePassword);
router.post("/delete-account", protect, deleteAccount);
```

and import the two functions in `authRoutes.js`.

## Cookie Settings

Development:

```js
{
  httpOnly: true,
  secure: false,
  sameSite: "lax"
}
```

Production:

```js
{
  httpOnly: true,
  secure: true,
  sameSite: "none"
}
```

Production uses `sameSite: "none"` because the frontend and backend may be deployed on different domains.

## Security Properties

- JavaScript cannot read the token because the cookie is httpOnly.
- HTTPS is required for production cookie delivery.
- The backend never returns password hashes or reset-token/OTP hashes.
- Invalid, missing, expired, or orphaned tokens return `401`.
- The forgot-password endpoint returns an identical response whether or not the email
  exists, and OTP verification is capped at 5 attempts before requiring a new code.

## Operational Requirements

- `JWT_SECRET` must be long, random, and unique per environment.
- Rotating `JWT_SECRET` invalidates all active sessions.
- Frontend requests must use `withCredentials: true`.
- Backend CORS must allow the exact frontend origin.
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` must be configured for the password-reset OTP
  email (and all other notification emails) to actually send — see `.env.example`.

## Known Improvement Areas

- Add login rate limiting (currently only the OTP routes are rate-limited; register/login are not).
- Add account lockout or progressive delay after repeated failures.
- Add email verification before enabling sensitive actions.
- Wire up `changePassword` and `deleteAccount` to routes, or remove them if not needed.
- Add a way to change `role` (see `RBAC_FLOW.md`) if RBAC is going to be used for anything beyond the current Problems write-gate.
- Add CSRF protection if adding state-changing cookie-authenticated browser forms outside the current JSON API pattern.
