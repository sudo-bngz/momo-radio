services:
  # 1. The Ingester (Organizer)
  ingester:
    build:
      context: .. # Point to project root
      dockerfile: docker/Dockerfile.ingest
    container_name: radio_ingester
    restart: unless-stopped
    #volumes:
      # Mount config.yaml so you can edit it on the host
    #  - ../config.yaml:/app/config.yaml:ro
    environment:
      - RADIO_B2_KEY_ID=XXX
      - RADIO_B2_APP_KEY=XXX
      - RADIO_B2_ENDPOINT=https://s3.us-east-005.backblazeb2.com
      - RADIO_B2_REGION=us-east-005
      - RADIO_B2_BUCKET_INGEST=bucket_ingest
      - RADIO_B2_BUCKET_PROD=bucket_ingest
      - RADIO_SERVER_POLLING_INTERVAL_SECONDS=10
      - RADIO_SERVER_TEMP_DIR==/tmp/

  # 2. The Radio Engine (Streamer)
  radio:
    build:
      context: .. # Point to project root
      dockerfile: docker/Dockerfile.radio
    container_name: radio_engine
    restart: unless-stopped
    ports:
      - "8080:8080" # VLC Helper
    volumes:
      - ../config.yaml:/app/config.yaml:ro
    environment:
      - RADIO_B2_KEY_ID=${B2_KEY_ID}
      - RADIO_B2_APP_KEY=${B2_APP_KEY}
    depends_on:
      - ingester
  postgres:
    image: postgres:15-alpine
    container_name: radio_db
    restart: unless-stopped
    environment:
      - POSTGRES_USER=radio
      - POSTGRES_PASSWORD=radiopassword
      - POSTGRES_DB=radio
    volumes:
      - db_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U radio"]
      interval: 5s
      timeout: 5s
      retries: 5
  api:
    build:
      context: ..
      dockerfile: docker/Dockerfile.api
    container_name: "radio_api"
    restart: always
    ports:
      - "8081:8081"
    environment:
      - RADIO_DATABASE_HOST=postgres
      - RADIO_DATABASE_PORT=5432
      - RADIO_DATABASE_USER=radio
      - RADIO_DATABASE_PASSWORD=radiopassword
      - RADIO_DATABASE_NAME=radio
      - RADIO_SERVER_METRICS_PORT=:9091
    volumes:
      - "${HOME}/radio/volume/config/config.yaml:/app/config.yaml:z"
    networks:
      - default
volumes:
  db_data: