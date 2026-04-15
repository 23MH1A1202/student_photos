# Student Photos

A fast, mobile-friendly **Progressive Web App (PWA)** that lets you search and view student photos from Aditya Group of Engineering Colleges (AEC/ACET) by entering a roll number or a roll-number prefix.

Live site: [https://23mh1a1202.github.io/student_photos/](https://23mh1a1202.github.io/student_photos/)

---

## Features

- 🔍 **Search by roll number** – enter a full 10-digit roll number to instantly view a student's photo and name.
- 🗂️ **Search by prefix** – enter a partial roll number (e.g. a batch or branch prefix) to see all matching student photos with pagination.
- 🏷️ **Branch detection** – automatically identifies and displays the student's branch/department from the roll number.
- 🎉 **Confetti animation** – a celebratory effect plays when a photo is found.
- 📲 **Installable PWA** – can be added to the home screen on Android and iOS for an app-like experience.
- 📴 **Offline fallback** – a friendly offline page is shown when there is no internet connection.
- 📱 **Responsive design** – works on desktop, tablet, and mobile.

---

## Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Page structure and content |
| CSS3 | Styling, animations, responsive layout |
| JavaScript (Vanilla) | Search logic, image loading, pagination, PWA registration |
| Web App Manifest | PWA metadata (name, icons, display mode) |
| Service Worker | Offline caching and fallback |

External resources used at runtime:
- Student photo CDN: `https://info.aec.edu.in/`
- Student name API: `https://student-name-api.onrender.com/`
- Confetti library: `canvas-confetti` via jsDelivr CDN

---

## Getting Started

### Requirements

- A modern web browser (Chrome, Edge, Firefox, Safari).
- No build tools, Node.js, or package manager is required — this is a plain static site.

### Download / Clone

```bash
git clone https://github.com/23MH1A1202/student_photos.git
cd student_photos
```

Or [download the ZIP](https://github.com/23MH1A1202/student_photos/archive/refs/heads/main.zip) and extract it.

### Run Locally

**Option 1 – Open directly in the browser (simplest)**

Double-click `index.html` or open it with your browser:

```
file:///path/to/student_photos/index.html
```

> **Note:** The Service Worker will not register over `file://`. For full PWA functionality, use Option 2.

**Option 2 – Serve with a simple local server (recommended)**

Using Python (comes pre-installed on most systems):

```bash
# Python 3
python -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) in your browser.

Alternatively, with [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) in VS Code: right-click `index.html` → **Open with Live Server**.

---

## Project Structure

```
student_photos/
├── index.html          # Main application – all HTML, CSS, and JavaScript
├── offline.html        # Fallback page shown when the user is offline
├── manifest.json       # PWA manifest (name, icons, display settings)
├── service-worker.js   # Service worker for offline caching
├── banner.png          # Header banner image displayed at the top of the page
├── down_image.gif      # Animated scroll-indicator GIF
├── down_image1.gif     # Alternative animated scroll-indicator GIF
├── icon-192.png        # PWA icon (192 × 192 px)
└── icon-512.png        # PWA icon (512 × 512 px)
```

---

## Usage

1. Open the app in your browser.
2. In the search box, enter one of the following:
   - **Full roll number** (10 characters, e.g. `22MH1A0501`) – displays the single matching photo and the student's name.
   - **Prefix** (fewer than 10 characters, e.g. `22MH1A05`) – displays all photos whose roll numbers start with that prefix, with pagination.
3. Press **Search** (or hit **Enter**).
4. Click any photo card to view it in full size.

---

## How to Add / Update Student Photos

Student photos are served directly from the college's remote server and are **not stored in this repository**. The app constructs image URLs using the pattern:

```
https://info.aec.edu.in/acet/studentPhotos/<ROLL_NUMBER>.jpg
```

For AEC students (roll numbers where characters 3–4 are `A9`):

```
https://info.aec.edu.in/AEC/studentPhotos/<ROLL_NUMBER>.jpg
```

**Naming convention:** The image file name must exactly match the student's roll number (uppercase), with a `.jpg` extension.

To make a new batch of photos available, upload them to the college server following the same naming convention. No changes to this repository are required.

---

## Troubleshooting

| Problem | Possible cause & fix |
|---|---|
| **"Photo not found" error** | The roll number may be incorrect, or the photo has not been uploaded to the college server yet. Double-check the roll number and try again. |
| **Student name shows a loading spinner indefinitely** | The name-lookup API (`student-name-api.onrender.com`) may be sleeping (free-tier cold start). Wait ~30 seconds, then press **Search** again to retry the request. |
| **App shows the offline page** | You are not connected to the internet. Connect and refresh the page. |
| **Service Worker not registering** | The page must be served over `http://` or `https://`, not the `file://` protocol. Use a local server (see [Run Locally](#run-locally)). |
| **Images not loading on localhost** | The college image CDN may block cross-origin requests from `localhost`. Try the live GitHub Pages URL instead. |
| **PWA install prompt not appearing** | Ensure you are on Chrome/Edge over HTTPS (or localhost) and have not already installed the app. |

---

## License

This project is licensed under the **MIT License**.  
See the [LICENSE](LICENSE) file for details (if present), or refer to the standard MIT License terms:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software.