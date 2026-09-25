# Saved Places access-control evidence — 2026-09-25

The two accounts below were created through the actual `POST /api/auth/signup` flow. They are synthetic test accounts.

- User A: `records.a.1790325589098@example.com`
- User B: `records.b.1790325589098@example.com`
- User A saved-place publicId: `cDkFAxnG26e3`

## Signup and creation

```text
SIGNUP records.a.1790325589098@example.com 201 {"userId":"cmugpmpvr000gt4i8mj8rzuxw","email":"records.a.1790325589098@example.com"} cookie= true
SIGNUP records.b.1790325589098@example.com 201 {"userId":"cmugpmrmq000kt4i8pd89fopn","email":"records.b.1790325589098@example.com"} cookie= true
CREATE_A 201 {"publicId":"cDkFAxnG26e3","destination":"Test Destination for Access Control","note":"User A private record","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"WISHLIST","createdAt":"2026-09-25T08:39:51.776Z","updatedAt":"2026-09-25T08:39:51.776Z"}
```

## User B mismatch tests

```text
LIST_B 200 [] contains= false
DETAIL_B 403 {"error":"You do not have access to this saved place."}
DELETE_B 403 {"error":"You do not have access to this saved place."}
```

Interpretation: User B cannot see User A's record in the list and cannot retrieve or delete it by publicId. The server returns 403 for both direct ownership mismatches, as required by the PRD.

## Browser URL substitution

Not captured in this environment. The browser automation surface reported no available browser and could not open the local app, so a direct browser navigation to `/dashboard?view=saved-places&action=detail&ref=cDkFAxnG26e3` while authenticated as User B could not be performed or represented as completed evidence.
