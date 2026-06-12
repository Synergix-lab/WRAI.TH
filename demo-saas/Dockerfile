FROM golang:1.22 AS build
WORKDIR /src
COPY backend/ ./backend/
RUN cd backend && CGO_ENABLED=0 go build -o /out/burnmeter .

FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/burnmeter /app/burnmeter
COPY frontend/ /app/frontend/
ENV PORT=8080
EXPOSE 8080
CMD ["/app/burnmeter"]
