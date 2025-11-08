# Quick Fix: Use GitHub Codespaces (Easiest!)

## ❌ Issue with WSL

Your WSL has sudo disabled and is using Windows Node.js, which won't work.

## ✅ SOLUTION: GitHub Codespaces (2 Minutes, Free!)

This runs everything in the cloud - no installation needed!

### Step 1: Push Your Code to GitHub

In your **Git Bash** terminal (not WSL):

```bash
cd /c/Users/Asus/Downloads/queuectl-node

# Initialize git
git init

# Add all files
git add .

# Commit
git commit -m "QueueCTL implementation"

# Create repo on GitHub (go to github.com, create new repo called 'queuectl-node')
# Then add remote (replace YOUR_USERNAME):
git remote add origin https://github.com/YOUR_USERNAME/queuectl-node.git

# Push
git branch -M main
git push -u origin main
```

### Step 2: Open in Codespaces

1. Go to your GitHub repository
2. Click green **"Code"** button
3. Click **"Codespaces"** tab
4. Click **"Create codespace on main"**

### Step 3: In the Codespace Terminal

```bash
# Install dependencies (will work!)
npm install

# Run tests
npm test

# Run demo
npm run demo

# Try commands
node bin/queuectl.js --help
node bin/queuectl.js worker start --count 2
node bin/queuectl.js enqueue '{"command":"echo Hello"}'
node bin/queuectl.js status
node bin/queuectl.js worker stop
```

### Step 4: Record Demo

In Codespaces terminal:

```bash
# Clean start
rm -rf ~/.queuectl

# Run full demo
node bin/queuectl.js config set max_retries 2
node bin/queuectl.js worker start --count 2
node bin/queuectl.js enqueue '{"command":"echo Success"}'
node bin/queuectl.js enqueue '{"command":"bash -c exit 1"}'
sleep 8
node bin/queuectl.js status
node bin/queuectl.js dlq list
node bin/queuectl.js worker stop
```

Record your screen while running these commands.

### Step 5: Upload Video

- Upload to Google Drive
- Set sharing to "Anyone with link"
- Add link to README.md
- Commit and push

---

## 🎥 Screen Recording Options

**Windows Built-in:**
- Press **Win + G** (Game Bar)
- Click record button
- Run your demo in Codespaces browser

**Free Tools:**
- OBS Studio: https://obsproject.com/
- ShareX: https://getsharex.com/

---

## ✅ Why Codespaces is Better

- ✅ No setup needed
- ✅ Works in browser
- ✅ Linux environment (everything just works)
- ✅ Free for 60 hours/month
- ✅ Can record screen while using it

---

## 📋 Quick Checklist

1. [ ] Push code to GitHub
2. [ ] Create Codespace
3. [ ] Run `npm install` in Codespace
4. [ ] Run `npm test` and `npm run demo`
5. [ ] Record screen while running commands
6. [ ] Upload video to Google Drive
7. [ ] Add link to README.md
8. [ ] Submit!

**Your code is perfect - let's just run it in the cloud!** ☁️🚀
