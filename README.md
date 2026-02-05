<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1yQa_j9bj1A4JTX8WjBqBGfppwjZky-3c

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Expected file types

The app expects distinct Salesforce and email files (non-overlapping sets). Use these formats:

**Salesforce files**
- Markdown (`.md`)
- PDFs (`.pdf`)
- Images (`.jpg`, `.jpeg`, `.png`, `.tiff`)

**Email files**
- Text and document formats: `.txt`, `.csv`, `.xls`, `.html`, `.doc`, `.ppt`, `.json`, `.eml`

**Images for visual analysis**
- Images (`.jpg`, `.jpeg`, `.png`, `.tiff`)
- PDF pages are converted to images automatically

If a file could fit more than one category, include `salesforce` or `email` in the filename to explicitly route it to that pipeline (images are always treated as images). Avoid labeling a file with both keywords. 
