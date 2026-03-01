# RSS Summarizer

A self-hosted tool that takes RSS feeds, pulls the full article content, summarizes each one using a local LLM (via Ollama), and re-publishes everything as new RSS feeds you can subscribe to in your favorite reader.

Basically: your existing feeds, but with AI-generated summaries instead of (or alongside) the original content.

## How it works

1. You configure a list of RSS feeds in `config.yaml`
2. The app fetches them on a schedule, extracts the full article text using Readability
3. Each article gets summarized by a local Ollama model
4. Results are cached in SQLite so you're not re-summarizing things constantly
5. New RSS feeds are served at `/feed/<name>` — point your reader there

## Setup

You'll need [Bun](https://bun.sh) and [Ollama](https://ollama.ai) running locally.

```bash
bun install
cp config.example.yaml config.yaml
# edit config.yaml with your feeds and Ollama settings
bun start
```

Then add `http://localhost:3000/feed/hacker-news` (or whatever you named your feed) to your RSS reader.

## Config

```yaml
server:
  port: 3000
  host: "0.0.0.0"

llm:
  host: "http://localhost:11434"
  model: "gemma3:12b"
  maxTokens: 500

cache:
  dbPath: "./data/cache.sqlite"
  articleTtlDays: 30

feeds:
  - name: "hacker-news"
    url: "https://hnrss.org/frontpage"
    refreshMinutes: 15
    maxItems: 20
```

## Docker

A pre-built image is published to GitHub Container Registry on every push to `main` and on tags.

### Using the pre-built image

```bash
docker pull ghcr.io/sergiomendolia/rsssummarizer:main
```

Create your `config.yaml` somewhere on the host (you can start from `config.example.yaml`), then run:

```bash
docker run -d \
  --name rss-summarizer \
  -p 3000:3000 \
  -v /path/to/your/config.yaml:/app/config.yaml \
  -v /path/to/data:/app/data \
  ghcr.io/sergiomendolia/rsssummarizer:main
```

The `/app/data` volume is where the SQLite cache lives — mount it so you don't lose your summaries between restarts.

### Building it yourself

```bash
docker build -t rss-summarizer .
docker run -d \
  --name rss-summarizer \
  -p 3000:3000 \
  -v ./config.yaml:/app/config.yaml \
  -v ./data:/app/data \
  rss-summarizer
```

### Docker Compose

The easiest way to get everything running — this spins up both the summarizer and Ollama together:

```yaml
services:
  rss-summarizer:
    image: ghcr.io/sergiomendolia/rsssummarizer:main
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config.yaml
      - rss-data:/app/data
    depends_on:
      - ollama
    restart: unless-stopped

  ollama:
    image: ollama/ollama
    volumes:
      - ollama-data:/root/.ollama
    restart: unless-stopped
    # Uncomment the following to use a GPU:
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - capabilities: [gpu]

volumes:
  rss-data:
  ollama-data:
```

Set `llm.host` in your `config.yaml` to point at the Ollama container:

```yaml
llm:
  host: "http://ollama:11434"
```

Then:

```bash
docker compose up -d
# Pull the model on first run
docker compose exec ollama ollama pull gemma3:12b
```

### Connecting to an existing Ollama

If you already have Ollama running outside Docker, `localhost` inside the container won't point to your host. A few options:

- **Docker Desktop (Mac/Windows):** use `host.docker.internal` as the LLM host
  ```yaml
  llm:
    host: "http://host.docker.internal:11434"
  ```
- **Linux:** run with `--network host`, or use your machine's LAN IP

## Endpoints

- `/feed/:name` — the summarized RSS feed
- `/health` — status check with per-feed article counts

## Stack

Bun, Hono, Ollama, SQLite, TypeScript. No frameworks, no frills.
