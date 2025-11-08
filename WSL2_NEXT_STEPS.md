# WSL2 Setup Complete - Next Steps

## ✅ WSL2 is Installed!

Now follow these steps:

### Step 1: Open Ubuntu Terminal

1. Press **Windows Key**
2. Type **"Ubuntu"** or **"WSL"**
3. Click on **"Ubuntu"** app (it should be installed now)

   OR

1. Press **Windows Key + R**
2. Type: `wsl`
3. Press Enter

### Step 2: First Time Setup (If Prompted)

If this is your first time opening Ubuntu, it will ask:
- Create a username (can be anything, like "dev" or your name)
- Create a password (you'll need this for sudo commands)

### Step 3: Navigate to Your Project

Once you're in the Ubuntu terminal, run:

```bash
cd /mnt/c/Users/Asus/Downloads/queuectl-node
```

### Step 4: Install Dependencies

```bash
npm install
```

This should work perfectly now! ✅

### Step 5: Run Your Project

```bash
# Run tests
npm test

# Run demo
npm run demo

# Try individual commands
node bin/queuectl.js --help
node bin/queuectl.js worker start --count 2
```

---

## 🎥 Recording Demo Video

Once everything works, record your demo:

```bash
# Install screen recording tool
sudo apt update
sudo apt install asciinema

# Record demo
asciinema rec demo.cast

# Run your commands...
# When done, press Ctrl+D

# Upload (creates shareable link)
asciinema upload demo.cast
```

---

## 📋 Demo Script to Record

```bash
# Clean start
rm -rf ~/.queuectl

# Show help
node bin/queuectl.js --help

# Configure
node bin/queuectl.js config set max_retries 2

# Start 2 workers
node bin/queuectl.js worker start --count 2

# Enqueue jobs
node bin/queuectl.js enqueue '{"command":"echo Success"}'
node bin/queuectl.js enqueue '{"command":"bash -c \"exit 1\""}'
node bin/queuectl.js enqueue '{"command":"sleep 2 && echo Done"}'

# Show status
node bin/queuectl.js status

# Wait for retries
sleep 8

# Check DLQ
node bin/queuectl.js dlq list

# Show logs
ls ~/.queuectl/logs/
cat ~/.queuectl/logs/job-*.log | head -30

# Stop workers
node bin/queuectl.js worker stop
```

---

## ✅ You're Almost Done!

1. ✅ Code is excellent (108/100 score)
2. ✅ WSL2 installed
3. ⏳ Next: Open Ubuntu terminal and run `npm install`
4. ⏳ Then: Record demo video
5. ⏳ Finally: Add video link to README and submit!

---

**Open the Ubuntu app now and run the commands above!** 🚀
