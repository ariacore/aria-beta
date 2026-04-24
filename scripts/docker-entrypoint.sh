#!/bin/bash
set -e

# Start Xvfb (Virtual Framebuffer)
Xvfb :99 -screen 0 $RESOLUTION &
sleep 2

# Start Window Manager
fluxbox &
sleep 1

# Start x11vnc
x11vnc -display :99 -nopw -listen localhost -xkb -ncache 10 -ncache_cr -forever &
sleep 2

# Start noVNC
websockify --web=/usr/share/novnc/ --wrap-mode=ignore 8080 localhost:5900 &

echo "noVNC is running at http://localhost:8080/vnc.html"
echo "ARIA Sandboxed Environment Ready."

# Keep container alive or execute passed command
if [ "$#" -eq 0 ]; then
    tail -f /dev/null
else
    exec "$@"
fi
