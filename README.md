# MiniChat — Persistent Chat Demo

This enhanced demo persists messages using SQLite and offers:
- Message history retrieval
- Timestamps
- Typing indicator
- Simple users list per room

## Files
- index.html
- styles.css
- client.js
- server.js
- package.json

## Run locally
1. Save files (already provided in this ZIP).
2. Install dependencies:

```bash
npm install
```

3. Start server:

```bash
npm start
```

4. Open `http://localhost:3000` in two browser windows (or devices on the same network). Enter the same Room ID in both and different names. You will see message history, real-time messages, typing indicator, and users list.

## Notes
- The database file `chat.db` will be created in the project folder.
- This project is a learning prototype — add authentication and HTTPS before deploying.
