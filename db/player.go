package db

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"time"
)

type Role string

const (
	RoleUser  Role = "user"
	RoleAdmin Role = "admin"
	RoleRoot  Role = "root"
)

type Player struct {
	Id           int32     `json:"id"`       // 0表示root用户, 按注册顺序递增,主键唯一
	Username     string    `json:"username"` // 主键唯一
	Password     string    `json:"password"`
	Role         Role      `json:"role"`
	Wins         int32     `json:"wins"`          // 胜场
	Losses       int32     `json:"losses"`        // 负场
	PositionCard int32     `json:"position_card"` // 位置卡数量
	Dice         int32     `json:"dice"`          // 骰子数量
	CurGameId    int32     `json:"cur_game_id"`   // 当前游戏ID, 0表示未在游戏中
	CreatedAt    time.Time `json:"created_at"`
}

func LoadAllPlayers() (map[int32]*Player, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := playersCol.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	players := make(map[int32]*Player)
	for cursor.Next(ctx) {
		var player Player
		if err = cursor.Decode(&player); err != nil {
			return nil, err
		}
		players[player.Id] = &player
	}

	return players, nil
}

func SavePlayer(player *Player) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"id": player.Id}
	update := bson.M{"$set": player}
	opts := options.Update().SetUpsert(true)

	_, err := playersCol.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		log.Printf("Failed to save player %d: %v", player.Id, err)
	}
}
