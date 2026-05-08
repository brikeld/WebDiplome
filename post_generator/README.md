# Post Generator (LM Studio)

This standalone module generates short, judgmental productivity posts from the locally collected profile data using a local LM Studio instance (OpenAI-compatible API).

## How to run

From the project root:

```bash
python python/post_generator/generate_posts.py
```

## What to configure

Edit the config block at the top of `generate_posts.py`:

- `LM_STUDIO_IP` – set to the IP of the PC running LM Studio (e.g., `192.168.1.42`)
- `LM_STUDIO_PORT` – LM Studio HTTP port (default 1234)
- `LM_STUDIO_MODEL` – model name shown in LM Studio
- `DATA_PATH` / `USER_PATH` – paths to `data/data.json` and `data/user.json` (defaults are correct if you run from project root)
- `OUTPUT_PATH` – where generated posts are appended (`data/generated_posts.json`)

## What it does

1. Loads `data/data.json` (collector output) and `data/user.json` (user identity). Missing files are handled gracefully.
2. Builds a **snapshot** dictionary with the relevant fields (user, activity, behavior, device, social, predictions). Missing values are set to `null`.
3. Sends a chat-completions request to LM Studio using a system + user prompt to produce a short productivity post (cold, analytical, passive-aggressive).
4. Prints the generated post to the console and appends it to `data/generated_posts.json` with a timestamp and category.

## Output

- Console: the generated post, clearly labeled.
- File: `data/generated_posts.json` — an array of entries:
  ```json
  {
    "timestamp": "2024-01-01T12:00:00Z",
    "category": "productivity",
    "post": "..."
  }
  ```
