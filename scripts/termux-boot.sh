#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot auto-start script for FutureBox
# Place in ~/.termux/boot/

# Wait for network
sleep 5

# Start Ollama in background
ollama serve &

# Wait for Ollama to be ready
for i in $(seq 1 30); do
  curl -s http://127.0.0.1:11434/api/tags > /dev/null 2>&1 && break
  sleep 1
done

# Start FutureBox server
cd /data/data/com.termux/files/home/futurebox/server
NODE_ENV=production DATA_DIR=$HOME/futurebox-data node dist/index.js &

echo "FutureBox started at $(date)" >> $HOME/futurebox-boot.log
