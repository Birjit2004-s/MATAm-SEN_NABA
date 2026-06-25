# MATAM SEN-NABA — Android app

Your personal study + habit + reminder tracker, wrapped as an installable Android app.
The whole app lives in `app/src/main/assets/index.html`, so it runs fully offline and
saves all your data on the phone.

## Get the APK without installing anything (recommended)

You don't need Android Studio or any developer tools. GitHub builds the APK for you.

1. Create a free account at https://github.com if you don't have one.
2. Click **New repository** → give it any name → **Create repository**.
3. On the new repo page, click **uploading an existing file**.
4. Drag in **all the files and folders** from this project (keep the folder
   structure exactly as-is), then **Commit changes**.
5. Go to the **Actions** tab. A job called **Build APK** starts automatically
   (takes ~3–5 minutes). Wait for the green check.
6. Open that finished run → scroll to **Artifacts** → download
   **matam-sen-naba-apk**. Inside is `app-debug.apk`.

## Install it on your phone

1. Send `app-debug.apk` to your phone (email, Google Drive, USB, etc.).
2. Tap it. Android will ask to **allow installing unknown apps** — allow it for
   your browser/Files app.
3. Install. The app appears as **Matam Sen-Naba** in your app drawer.

This is a *debug* APK — perfect for personal use. It isn't on the Play Store and
doesn't need a paid developer account.

## What's inside

- `app/src/main/assets/index.html` — the full app (edit this to change anything)
- `app/src/main/java/.../MainActivity.java` — thin WebView wrapper
- `.github/workflows/build-apk.yml` — the auto-build recipe

## Updating the app later

Edit `index.html`, bump `versionCode`/`versionName` in `app/build.gradle`, upload
the changed files to GitHub again, and download the new APK from Actions.

## Notes

- Weather needs internet; everything else works offline.
- The 📍 location button asks for permission the first time. Typing a city always works.
- Your data is stored only on your device. Uninstalling clears it.
