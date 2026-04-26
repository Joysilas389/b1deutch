#!/data/data/com.termux/files/usr/bin/bash
# Sprechen SQLite Server Setup Script
# Run once: bash setup-db.sh

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Sprechen SQLite Server Setup        ║"
echo "╚═══════════════════════════════════════╝"
echo ""

cd ~/sprechen-v3

echo "→ Installing better-sqlite3..."
npm install better-sqlite3 --save

echo ""
echo "→ Creating auto-start script..."
cat > ~/start-sprechen-db.sh << 'STARTEOF'
#!/data/data/com.termux/files/usr/bin/bash
cd ~/sprechen-v3
node server.js
STARTEOF
chmod +x ~/start-sprechen-db.sh

echo ""
echo "→ Adding auto-start to .bashrc..."
# Only add if not already there
if ! grep -q "start-sprechen-db" ~/.bashrc; then
  echo "" >> ~/.bashrc
  echo "# Auto-start Sprechen DB server" >> ~/.bashrc
  echo "node ~/sprechen-v3/server.js &" >> ~/.bashrc
  echo "Added to .bashrc"
else
  echo "Already in .bashrc"
fi

echo ""
echo "╔═══════════════════════════════════════╗"
echo "║   Setup Complete!                     ║"
echo "║                                       ║"
echo "║   To start server now:                ║"
echo "║   node server.js                      ║"
echo "║                                       ║"
echo "║   Auto-starts next time you           ║"
echo "║   open Termux.                        ║"
echo "╚═══════════════════════════════════════╝"
echo ""
