# Desktop assets

Drop the following files here before building a release. Code paths and
electron-builder config already reference them.

- `tray-icon.png`  — 16x16 (and ideally 32x32 / 64x64 ICO variants)
- `icon.png`       — 512x512 application icon
- `icon.ico`       — combined Windows icon (multiple sizes inside)

If `tray-icon.png` is missing, the app falls back to a small generated
placeholder so the tray still appears in development.
