#!/data/data/com.termux/files/usr/bin/bash
# Sprechen DB Server Setup — no dependencies needed!
# Run once: bash setup-db.sh

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Sprechen DB Server Setup            ║"
echo "╚═══════════════════════════════════════╝"
echo ""

cd ~/sprechen-v3

# No npm install needed — server.js uses only built-in Node.js modules

echo "→ Setting up auto-start..."

# Create .bashrc if it doesn't exist
touch ~/.bashrc

# Add auto-start only if not already there
if ! grep -q "sprechen-v3/server.js" ~/.bashrc 2>/dev/null; then
  echo "" >> ~/.bashrc
  echo "# Auto-start Sprechen DB server" >> ~/.bashrc
  echo "if ! curl -s http://localhost:3001/ping > /dev/null 2>&1; then" >> ~/.bashrc
  echo "  node ~/sprechen-v3/server.js &" >> ~/.bashrc
  echo "  echo '[Sprechen] DB server started in background'" >> ~/.bashrc
  echo "fi" >> ~/.bashrc
  echo "✅ Auto-start added to .bashrc"
else
  echo "✅ Auto-start already configured"
fi

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Setup Complete! No install needed.  ║"
echo "║                                       ║"
echo "║   Start server now:                   ║"
echo "║   node server.js                      ║"
echo "║                                       ║"
echo "║   Data saved to: sprechen.db.json     ║"
echo "║   Auto-starts when you open Termux    ║"
echo "╚═══════════════════════════════════════╝"
echo ""
