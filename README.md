# SyncPlayer

A local-network peer-to-peer audio streaming application designed to synchronize playback across desktop and mobile devices. Built with React, WebRTC DataChannels, and Socket.io.

## Architecture & Features

### Core P2P

* **WebRTC DataChannels:** Direct, serverless media transfer utilizing 16KB chunking.
* **Trickle ICE:** Iterative connection routing to handle local Wi-Fi and cellular hotspot topologies.
* **Role-Based UI:** Distinct control layers for the broadcasting host and synchronized guests.

### Synchronization Engine

* **Clock Offset Calculation:** A ping-pong handshake calculates exact network latency and hardware clock discrepancies upon initial connection.
* **Hysteresis Loop:** Prevents audio buffer stuttering on mobile hardware. The engine corrects drift using subtle `1.02x` or `0.98x` playback rates and settles within a 40ms dead-zone.
* **Desync Snapping:** Forces a hard seek if drift exceeds a 2-second threshold.

### Device Compatibility

* **Autoplay Handling:** Silently initializes the audio context upon the initial user interaction to comply with mobile browser autoplay restrictions.
* **Buffer Management:** Dynamically flushes the browser's audio buffer during track changes to prevent metadata bleed.
* **Clipboard Fallback:** Implements a legacy text-selection fallback for copying room IDs over non-HTTPS local IP addresses.

## Local Development

The application requires network access to facilitate cross-device communication.

1. **Signaling Server (Node.js):**
   Ensure the backend server binds to all network interfaces.
   ```
   node server.js
   ```

2. **Frontend (React/Vite):**
   Expose the development server to the local network.
   ```
   npm run dev -- --host
   ```

3. **Connection Setup:**
   * Identify the host machine's local IPv4 address (e.g., `192.168.1.75`).
   * Update the socket connection string in `App.tsx` (`socketRef.current`) to point to this IP.
   * Access the Vite network URL on your mobile device.

*Note: Verify that your operating system's firewall permits incoming traffic on ports 3000 and 5173.*

## Roadmap

* **Graceful Disconnections:** Proper cleanup of WebRTC data channels and socket connections when a peer leaves the session.
* **Dropout Recovery:** Implementation of reconnection logic for temporary packet loss or Wi-Fi drops.
* **Host UI/UX Overhaul:** Improved party management, lobby controls, and monitoring for multiple connected guests.
* **Diagnostic Overlay:** Real-time visual metrics for latency, drift, and buffer health.
* **Live Streaming Architecture:** Transitioning from fixed file transfers to real-time audio streaming.
* **Spatial & DJ Controls:** Advanced routing features, such as assigning specific audio segments, stems, or channels to individual guest devices.
* **Video Synchronization:** Expanding the playback engine to support and synchronize video elements.