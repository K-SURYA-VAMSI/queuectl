# QueueCTL Docker Usage

## Build
```bash
docker build -t queuectl .
```

## Run Interactive Shell
```bash
docker run -it queuectl /bin/bash
```

Then inside the container:
```bash
# Start workers
queuectl worker start --count 2

# Enqueue jobs
queuectl enqueue '{"command":"echo Hello"}'
queuectl enqueue '{"command":"sleep 1 && echo Done"}'

# Check status
queuectl status

# Stop workers
queuectl worker stop
```

## Run Demo Script
```bash
docker run -it queuectl npm run demo
```

## Run Tests
```bash
docker run queuectl npm test
```

## Persist Data with Volume
```bash
docker run -it -v queuectl-data:/root/.queuectl queuectl /bin/bash
```
