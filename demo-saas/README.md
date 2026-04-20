# BurnMeter 🔥

A shared meeting-cost ticker. Enter attendees + hourly rates, hit Start, and watch the dollars burn in real time. Red-alarm mode kicks in once the meeting crosses your "ouch line."

## Quickstart

```
make build   # compile the Go backend
make run     # start on :8080 (override with PORT=9090)
make test    # curl /stats to verify
make stop    # kill the running process
make clean   # stop + remove the binary
```

Then open http://localhost:8080 in a browser.

### Docker

```
docker build -t burnmeter .
docker run --rm -p 8080:8080 burnmeter
```

## Project structure

```
demo-saas/
├── backend/          # Go stdlib HTTP server + SSE ticker
│   ├── main.go
│   └── go.mod
├── frontend/         # vanilla JS/HTML/CSS
│   ├── index.html
│   ├── app.js
│   └── styles.css
├── Makefile
├── Dockerfile
├── DESIGN.md         # build brief
├── PRODUCT.md
└── README.md
```

Port: `8080` (env `PORT`). Go 1.22, stdlib only. No persistence — meetings live in memory.
