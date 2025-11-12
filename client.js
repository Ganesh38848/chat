/* Enhanced client:
 - Fetches message history from REST API
 - Persists messages on server (SQLite)
 - Shows timestamps, typing indicator, and users list
 - Uses WebSocket for realtime updates and typing notices
*/
(() => {
  const joinBtn = document.getElementById('joinBtn')
  const roomInput = document.getElementById('roomId')
  const nameInput = document.getElementById('name')
  const status = document.getElementById('status')
  const roomLabel = document.getElementById('roomLabel')
  const messagesEl = document.getElementById('messages')
  const msgForm = document.getElementById('msgForm')
  const msgInput = document.getElementById('msgInput')
  const sendBtn = document.getElementById('sendBtn')
  const typingEl = document.getElementById('typing')
  const usersEl = document.getElementById('users')

  let ws = null
  let room = null
  let name = null
  let typingTimer = null

  function fmtTime(ts){
    const d = new Date(ts)
    return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
  }

  function addMessage(item, who='them'){
    const div = document.createElement('div')
    div.className = 'message ' + (who === 'me' ? 'me' : 'them')
    const txt = document.createElement('div')
    txt.textContent = item.sender + ': ' + item.text
    const meta = document.createElement('div')
    meta.className = 'meta'
    meta.textContent = fmtTime(item.ts)
    div.appendChild(txt)
    div.appendChild(meta)
    messagesEl.appendChild(div)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function setStatus(s){ status.textContent = s }

  async function fetchHistory(roomId){
    try{
      const res = await fetch(`/api/rooms/${encodeURIComponent(roomId)}/messages`)
      if(!res.ok) return []
      const data = await res.json()
      messagesEl.innerHTML = ''
      data.forEach(msg => addMessage(msg, msg.sender === name ? 'me' : 'them'))
      if(data.length === 0){
        const p = document.createElement('div'); p.className='muted'; p.textContent='No messages yet.'; messagesEl.appendChild(p)
      }
    }catch(e){
      console.error('history fetch failed', e)
    }
  }

  function updateUsers(list){
    usersEl.textContent = 'Users: ' + (list.join(', ') || '—')
  }

  function connectWS(){
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws')

    ws.addEventListener('open', ()=> {
      setStatus('Connected')
      ws.send(JSON.stringify({type:'join', room, name}))
    })
    ws.addEventListener('close', ()=> setStatus('Disconnected'))

    ws.addEventListener('message', (ev) => {
      const data = JSON.parse(ev.data)
      if(data.type === 'chat'){
        addMessage(data, data.sender === name ? 'me' : 'them')
      }
      if(data.type === 'system'){
        if(data.event === 'users') updateUsers(data.users)
      }
      if(data.type === 'typing'){
        if(data.from !== name){
          typingEl.textContent = data.active ? (data.from + ' is typing...') : ''
        }
      }
    })
  }

  joinBtn.addEventListener('click', async ()=>{
    room = roomInput.value.trim() || ('room-' + Math.floor(Math.random()*9000+1000))
    name = nameInput.value.trim() || 'User' + Math.floor(Math.random()*90+10)
    roomLabel.textContent = `Room: ${room} — You: ${name}`
    setStatus('Connecting...')
    connectWS()
    await fetchHistory(room)
    sendBtn.disabled = false
  })

  msgForm.addEventListener('submit', async ()=>{
    const text = msgInput.value.trim()
    if(!text || !ws || ws.readyState !== WebSocket.OPEN) return
    const payload = {type:'chat', room, sender:name, text, ts: Date.now()}
    ws.send(JSON.stringify(payload))
    msgInput.value = ''
    typingEl.textContent = ''
  })

  // typing indicator (debounced)
  msgInput.addEventListener('input', ()=>{
    if(!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({type:'typing', room, from:name, active:true}))
    if(typingTimer) clearTimeout(typingTimer)
    typingTimer = setTimeout(()=>{
      ws.send(JSON.stringify({type:'typing', room, from:name, active:false}))
    }, 1200)
  })

})();
