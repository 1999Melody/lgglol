package logic

import (
	"golang.org/x/crypto/bcrypt"
	"lgglol/db"
	"sync"
	"time"
)

type Global struct {
	Players   map[int32]*db.Player // 玩家列表, key为玩家ID
	Games     map[int32]*db.Game   // 游戏列表, key为游戏ID
	mu        sync.RWMutex
	clients   map[int32]*Client
	broadcast chan Message
}

func NewGlobal(players map[int32]*db.Player, games map[int32]*db.Game) *Global {
	g := &Global{
		Players:   players,
		Games:     games,
		clients:   make(map[int32]*Client),
		broadcast: make(chan Message, 100),
	}
	if _, ok := g.Players[0]; !ok {
		hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("root"), bcrypt.DefaultCost)
		root := &db.Player{
			Id:           0,
			Username:     "root",
			Password:     string(hashedPassword),
			Role:         db.RoleRoot,
			PositionCard: 999,
			Dice:         999,
			CreatedAt:    time.Now(),
		}
		g.Players[0] = root
		db.SavePlayer(root)
	}
	return g
}

func (g *Global) innerPlayerChange(player *db.Player) {
	db.SavePlayer(player)
	g.Broadcast("player_change", player)
}

func (g *Global) innerPlayersChange(players []*db.Player) {
	for _, p := range players {
		db.SavePlayer(p)
	}
	g.Broadcast("players_change", players)
}

func (g *Global) innerGameChange(game *db.Game) {
	db.SaveGame(game)
	g.Broadcast("game_change", game)
}

func (g *Global) innerGameDel(gameId int32) {
	db.DeleteGame(gameId)
	g.Broadcast("game_del", gameId)
}
