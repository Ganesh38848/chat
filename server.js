/*
Node server (Express + ws) — persistent messages with SQLite
Run: node server.js
*/
const express = require('express')
const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose()

const DB_FILE = path.join(__dirname, 'chat.db')
const db = new sqlite3.Database(DB_FILE)

// initialize DB
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room TEXT NOT NULL,
    sender TEXT NOT NULL,
    text TEXT NOT NULL,
    ts INTEGER NOT NULL
  )`)
})

const app = express()
const server = http.createServer(app)
const wss = new WebSocket.Server({ server, path: '/ws' })

app.use(express.static(path.join(__dirname)))
app.use(express.json())

// In-memory room clients map: roomId -> Set(ws)
const rooms = new Map()

function safeSend(ws, data){ if(ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data)) }

wss.on('connection', (ws, req) => {
  ws._room = null
  ws._name = null

  ws.on('message', (msg) => {
    let data
    try{ data = JSON.parse(msg) }catch(e){ return }

    if(data.type === 'join'){
      const roomId = data.room
      const name = data.name
      ws._room = roomId
      ws._name = name

      if(!rooms.has(roomId)) rooms.set(roomId, new Set())
      const set = rooms.get(roomId)
      set.add(ws)

      // broadcast user list
      const users = [...set].map(c => c._name).filter(Boolean)
      set.forEach(c => safeSend(c, {type:'system', event:'users', users}))
      return
    }

    if(data.type === 'chat'){
      // persist to sqlite then broadcast
      const stmt = db.prepare('INSERT INTO messages (room, sender, text, ts) VALUES (?, ?, ?, ?)')
      stmt.run(data.room, data.sender, data.text, data.ts, function(err){
        if(err){ console.error('db insert err', err); return }
        // include id assigned by DB
        const out = {type:'chat', id: this.lastID, room:data.room, sender:data.sender, text:data.text, ts:data.ts}
        const set = rooms.get(data.room)
        if(set){
          set.forEach(c => safeSend(c, out))
        }
      })
      stmt.finalize()
      return
    }

    if(data.type === 'typing'){
      const set = rooms.get(data.room)
      if(set){
        set.forEach(c => {
          if(c !== ws) safeSend(c, {type:'typing', from:data.from, active:data.active})
        })
      }
      return
    }
  })

  ws.on('close', () => {
    const roomId = ws._room
    if(!roomId) return
    const set = rooms.get(roomId)
    if(!set) return
    set.delete(ws)
    // update user list
    const users = [...set].map(c => c._name).filter(Boolean)
    set.forEach(c => safeSend(c, {type:'system', event:'users', users}))
    if(set.size === 0) rooms.delete(roomId)
  })
})

// REST: get last N messages for room
app.get('/api/rooms/:id/messages', (req, res) => {
  const room = req.params.id
  const limit = parseInt(req.query.limit) || 200
  db.all('SELECT id, room, sender, text, ts FROM messages WHERE room = ? ORDER BY ts ASC LIMIT ?', [room, limit], (err, rows) => {
    if(err) return res.status(500).json({error: 'db error'})
    res.json(rows)
  })
})

const PORT = process.env.PORT || 3000
server.listen(PORT, ()=> console.log('Server listening on', PORT))
