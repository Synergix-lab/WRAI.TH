.PHONY: build run stop clean test

BIN := burnmeter
PORT ?= 8080

build:
	cd backend && go build -o $(BIN) .

run: build
	cd backend && ./$(BIN) &

stop:
	-pkill -f $(BIN)

clean: stop
	rm -f backend/$(BIN)

test:
	curl -sf http://localhost:$(PORT)/stats && echo " OK"
