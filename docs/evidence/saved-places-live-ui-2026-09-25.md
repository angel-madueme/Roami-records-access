# Saved Places live-flow evidence — 2026-09-25

The live API-backed flow was run against the local Next.js server at `http://localhost:3000` using a real account created through the signup endpoint. The local browser automation surface was unavailable, so no screenshots were captured.

## Observed live flow

```text
SIGNUP 201
PHOTO_CREATE 201 {"publicId":"1HZWmoVaPPdZ","destination":"Paris, France","note":"Live photo enrichment evidence","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"PLANNED"}
PHOTO_POLL_1 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
PHOTO_POLL_2 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
PHOTO_POLL_3 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
PHOTO_POLL_4 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
PHOTO_POLL_5 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
PHOTO_POLL_6 200 {"unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null}
NO_PHOTO_CREATE 201 {"publicId":"D6FsvpLc3nuC","destination":"zzzz-no-unsplash-result-1790326817314","note":"Fallback evidence","unsplashImageUrl":null,"unsplashPhotographerName":null,"unsplashPhotographerUrl":null,"status":"WISHLIST"}
POPULATED_LIST 200 [Paris record, no-result record]
PHOTO_DETAIL 200 [Paris record with all Unsplash fields null]
DELETE_PHOTO 204
AFTER_DELETE_LIST 200 [no-result record only]
```

The Paris record appeared immediately with the fallback fields null, remained saved, and completed all six individual detail polls without blocking the save. The no-result destination also returned 201 and remained available with null photo fields. Deleting the Paris record returned 204 and removed it from the subsequent list.

## UI evidence status

- Empty state: not visually captured; the component renders the shipped empty-state illustration and Save a place action.
- Create modal: not visually captured; URL state and form implementation are present.
- Populated card: not visually captured; live list data was returned.
- Immediate fallback: API response showed null photo fields immediately after save.
- Photo transition: not observed because Unsplash returned no usable result in this environment for the tested destinations.
- Card attribution: source implementation passes `attribution={false}` for card previews.
- Detail attribution: source implementation retains attribution by default in `PhotoPanel`.
- Delete confirmation: not visually captured; delete endpoint returned 204.
- Post-delete list: live response omitted the deleted Paris record.
- No-result fallback: live creation succeeded with all three photo fields null.
