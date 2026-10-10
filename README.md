# SyncPlayer (Under Development)

A local-network peer-to-peer audio streaming application designed to synchronize playback across desktop and mobile devices. Built with React, WebRTC DataChannels, and Socket.io.

## Features

### Core P2P

* **WebRTC DataChannels:** Direct media transfer using 16KB chunks.

* **Trickle ICE:** Reliable connections across complex Wi-Fi and cellular networks.

* **Role-Based UI:** Separate interfaces for the host and guests.

### Synchronization Engine

* **Clock Sync:** A ping-pong handshake calculates exact hardware clock differences.

* **Smooth Drift Correction:** Uses subtle 1.02x/0.98x speed adjustments to fix minor desyncs without mobile stuttering.

* **Desync Snapping:** Forces a hard playback reset if devices drift over 2 seconds apart.

### Device Compatibility

* **Autoplay Handling:** Bypasses mobile autoplay blocks via silent initialization.

* **Buffer Management:** Flushes old audio data between tracks to prevent overlap.

* **Clipboard Fallback:** Allows copying Room IDs over local HTTP networks.

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