package logic

import (
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// 心跳间隔
	heartbeatInterval = 30 * time.Second
	// 等待心跳响应的超时时间
	heartbeatTimeout = 10 * time.Second
	// 写操作超时
	writeTimeout = 5 * time.Second
)

type Client struct {
	conn        *websocket.Conn
	mu          sync.Mutex
	closeChan   chan struct{}
	playerId    int32
	lastActive  time.Time
	isConnected bool
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

// 添加WebSocket客户端
func (g *Global) AddClient(playerId int32, conn *websocket.Conn) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// 关闭现有连接（如果存在）
	if oldClient, ok := g.clients[playerId]; ok {
		oldClient.Close()
	}

	client := &Client{
		conn:        conn,
		playerId:    playerId,
		closeChan:   make(chan struct{}),
		lastActive:  time.Now(),
		isConnected: true,
	}

	g.clients[playerId] = client

	// 启动心跳和消息处理协程
	go client.handleConnection(g)
}

// 关闭客户端连接
func (c *Client) Close() {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return
	}

	c.isConnected = false
	close(c.closeChan)
	c.conn.Close()
}

// 处理连接和心跳
func (c *Client) handleConnection(g *Global) {
	defer c.Close()

	// 启动心跳协程
	heartbeatTicker := time.NewTicker(heartbeatInterval)
	defer heartbeatTicker.Stop()

	// 启动读协程
	readDone := make(chan struct{})
	go c.readPump(g, readDone)

	for {
		select {
		case <-heartbeatTicker.C:
			if !c.sendHeartbeat() {
				log.Printf("Heartbeat failed for player %d", c.playerId)
				return
			}

		case <-readDone:
			return

		case <-c.closeChan:
			return
		}
	}
}

// 发送心跳
func (c *Client) sendHeartbeat() bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return false
	}

	// 设置写超时
	c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	err := c.conn.WriteJSON(Message{
		Type: "heartbeat",
		Data: time.Now().Unix(),
	})
	if err != nil {
		log.Printf("Failed to send heartbeat to player %d: %v", c.playerId, err)
		return false
	}

	return true
}

// 读取消息
func (c *Client) readPump(g *Global, done chan struct{}) {
	defer close(done)

	c.conn.SetReadLimit(512) // 限制消息大小
	c.conn.SetReadDeadline(time.Now().Add(heartbeatInterval * 2))

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket read error for player %d: %v", c.playerId, err)
			}
			return
		}

		// 更新最后活动时间
		c.mu.Lock()
		c.lastActive = time.Now()
		c.mu.Unlock()

		// 处理心跳响应
		if string(message) == "heartbeat_ack" {
			continue
		}

		// 其他消息处理可以在这里添加
	}
}

// 移除WebSocket客户端
func (g *Global) RemoveClient(playerId int32) {
	g.mu.Lock()
	defer g.mu.Unlock()

	if client, ok := g.clients[playerId]; ok {
		client.Close()
		delete(g.clients, playerId)
	}
}

// 启动广播协程
func (g *Global) StartBroadcasting() {
	for msg := range g.broadcast {
		g.mu.RLock()
		clients := make([]*Client, 0, len(g.clients))
		for _, client := range g.clients {
			clients = append(clients, client)
		}
		g.mu.RUnlock()

		for _, client := range clients {
			client.sendMessage(msg)
		}
	}
}

// 发送消息
func (c *Client) sendMessage(msg Message) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	if !c.isConnected {
		return false
	}

	c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
	err := c.conn.WriteJSON(msg)
	if err != nil {
		log.Printf("Failed to send message to player %d: %v", c.playerId, err)
		return false
	}
	return true
}

// 广播消息给所有客户端
func (g *Global) Broadcast(msgType string, data interface{}) {
	g.broadcast <- Message{
		Type: msgType,
		Data: data,
	}
}

// 发送消息给特定玩家
func (g *Global) SendToPlayer(playerId int32, msgType string, data interface{}) {
	g.mu.RLock()
	client, ok := g.clients[playerId]
	g.mu.RUnlock()

	if !ok {
		return
	}

	client.sendMessage(Message{
		Type: msgType,
		Data: data,
	})
}
