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

Developer:- Ambati Lalitha Sagar
Email:- alalithasagar355@gmail.com
