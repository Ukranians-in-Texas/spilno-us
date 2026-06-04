# Google Drive Image Setup

## Problem

Google Drive URLs submitted via Google Form (`drive.google.com/open?id=...`) require:

1. Files to be publicly accessible
2. URL to be converted to a direct-embed format

## URL Conversion Fix

`src/utils/imageUrl.js` handles two Google Drive URL formats and converts both to the thumbnail embed format:

- `/file/d/FILE_ID/...` → `drive.google.com/thumbnail?id=FILE_ID&sz=w1000`
- `open?id=FILE_ID` → `drive.google.com/thumbnail?id=FILE_ID&sz=w1000`

> Note: `uc?export=view` was deprecated by Google and no longer works in `<img>` tags. The `thumbnail` endpoint is the reliable alternative.

## Making Files Publicly Accessible

### One-time bulk fix (Google Apps Script)

1. Go to [script.google.com](https://script.google.com) → **New project**
2. Paste the script below, replacing `YOUR_FOLDER_ID` with the folder ID from Google Drive:
   - Open the folder in Google Drive
   - The URL looks like `drive.google.com/drive/folders/`**`1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs`**
   - Copy that last segment — that's the folder ID
3. Click **Run** (▶) → Google will ask to authorize → click through the permissions
4. Check **View → Logs** to confirm files were made public

```js
function makeFilesPublic() {
  var folderId = 'YOUR_FOLDER_ID';
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();

  while (files.hasNext()) {
    var file = files.next();
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    Logger.log('Made public: ' + file.getName());
  }
}
```

### Automate for future uploads

Add a time-driven trigger so new images are made public automatically:

1. In Apps Script → **Triggers** (clock icon on the left)
2. **Add Trigger** → select `makeFilesPublic`
3. Event source: **Time-driven** → Hour timer → **Every hour**

New images uploaded via Google Form will be made public within an hour automatically.
