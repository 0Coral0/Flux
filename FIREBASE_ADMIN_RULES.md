# Firebase admin access

`admin.html` now signs in with Firebase Authentication and Electron retains that signed-in session for later launches. Firestore still has to grant that signed-in account permission to change protected documents.

In the Firebase Console, open **Firestore Database → Rules** and merge this helper into the existing ruleset:

```rules
function isFluxAdmin() {
  return request.auth != null
    && request.auth.token.email == "YOUR_ADMIN_EMAIL";
}
```

Then add the admin actions to the existing blocks for these collections. Keep any current rules that let normal visitors submit requests or view memorial entries.

```rules
match /game_requests/{requestId} {
  allow read, update, delete: if isFluxAdmin();
  // Keep the project's existing visitor create/vote rules here.
}

match /memorial_entries/{entryId} {
  allow read, delete: if isFluxAdmin();
  // Keep the project's existing visitor rules here.
}
```

Do not replace the complete ruleset with this snippet: it is deliberately only the protected admin part. Paste the actual Firebase Authentication email into `YOUR_ADMIN_EMAIL`, publish the merged rules, then sign in once from Electron. The page will restore the session automatically on later launches until you use **Sign out**.
