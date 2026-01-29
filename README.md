# WhatsApp Chat Visualizer

A lightweight, browser-based tool designed to render WhatsApp chat exports into a readable, familiar interface. View your chat history, including media attachments, as if you were scrolling through the app itself.

The project runs entirely on the client side using vanilla HTML, CSS, and JavaScript. No data is uploaded to any server; everything is processed locally within your browser using the File API.

## Features

### Core Functionality
* **Offline Parsing:** Reads the standard `_chat.txt` file exported from WhatsApp
* **Media Support:** Automatically links photos, videos, voice notes, and stickers to their messages
* **Virtual Scrolling:** Custom virtual scroll engine handles 50,000+ messages without browser crashes
* **Search:** Built-in search to filter messages by text or date with navigation
* **Theming:** Light and Dark mode toggle with persistent preferences
* **Perspective Switching:** Change the "Viewpoint" to determine which participant appears on the right side

### Mobile Optimization
* **Floating Date Pill:** iOS-style sticky date indicator appears while scrolling, showing the current date context
* **Responsive Design:** Fully optimized for smartphones with touch-friendly controls
* **Mobile Search Bar:** Search functionality visible and accessible on all screen sizes
* **Touch Scrolling:** Smooth native scrolling with `-webkit-overflow-scrolling: touch`

### Smart Media Matching
* **Fuzzy Matching:** When exact media isn't found, the system searches adjacent dates (±1 day)
* **Time-Based Matching:** Uses message timestamps to find the closest matching media file
* **Uncertainty Indicator:** Displays "⚠️ Approximate" badge on media matched through fuzzy logic
* **Debug Mode:** Click "🔍 Debug" on missing media to see detailed matching information

### Performance Optimizations
* **CSS Containment:** Uses `contain: layout style paint` to isolate rendering
* **Async Image Decoding:** Images use `decoding="async"` to prevent scroll blocking
* **Optimized Rendering:** Minimized layout thrashing with pre-cached object URLs
* **Smooth Scrolling:** `will-change: scroll-position` for GPU-accelerated scrolling

### Customization
* **Custom Chat Background:** Upload any image as your conversation background
* **Dark Mode Overlay:** Background automatically dims in dark mode for readability
* **Persistent Settings:** Theme and background preferences saved to localStorage
* **iOS-Style Bubbles:** Message styling matches WhatsApp iOS with accurate padding, margins, and border radius

## How to Use

### 1. Exporting Data

To use this tool, you first need a WhatsApp chat export:

1. Open a chat in WhatsApp on your phone
2. Go to **More > Export Chat**
3. Select **"Attach Media"**
4. Save the resulting ZIP file to your computer and extract it into a folder

You should see a `_chat.txt` file and various media files.

### 2. Running the Viewer

Open `index.html` in any modern web browser.

1. Click **"Choose Chat File"** and select the `_chat.txt` file from your export
2. (Optional) Click **"Add Media Folder"** and select the folder containing the extracted media
   * *Note: You must select the directory itself, not individual files*
3. Click **"Visualize Chat"**

### 3. Customizing Your View

* **Toggle Theme:** Settings > Click the theme button to switch between Light/Dark modes
* **Change Perspective:** Settings > Select which participant's messages appear on the right
* **Set Background:** Settings > Choose Image to upload a custom background

## Technical Implementation

### Message Parsing

The parser uses regular expressions to handle various WhatsApp export formats (iOS vs Android, different date formats). It structures messages into a JSON-like array with date, time, sender, text, and media references.

### Media Linking Strategy

WhatsApp exports replace media with `<Media omitted>`. The script indexes uploaded media files based on naming conventions (e.g., `0000-PHOTO-2026-01-03-12-30-45.jpg`) and matches them to messages by:
1. Exact date matching
2. Fuzzy matching (±1 day) with time-based proximity scoring
3. Media type detection (photo, video, audio, sticker)

### Virtual DOM / Virtual Scrolling

Renders only visible messages plus a buffer zone:
1. Calculates total height based on fixed item height estimate
2. Listens for scroll events with passive listeners
3. Renders only the visible slice of messages
4. Uses spacer divs to simulate full scroll height

### Floating Date Pill

Tracks the first visible message's date during scroll and displays it in a floating pill that:
- Fades in on scroll start
- Updates as you pass different dates
- Fades out after 1.5 seconds of inactivity

## Project Structure

* `index.html` - Layout skeleton with upload screen, chat view, and settings panel
* `main.css` - WhatsApp-like styling, CSS variables for theming, responsive layout
* `main.js` - Application logic: parsing, virtual scrolling, media matching, preferences

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Optimized for both desktop and mobile devices.
# chat-visualiser
# chat-visualiser
# chat-visualiser
