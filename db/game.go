package db

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
	"time"
)

type GameStatus string

const (
	GameWaiting  GameStatus = "waiting"  // 等待加入
	GameRolling  GameStatus = "rolling"  // rolling中
	GameInGame   GameStatus = "inGame"   // 游戏中
	GameFinished GameStatus = "finished" // 已结束
)

type Game struct {
	Id        int32         `json:"id"`        // 游戏Id, 主键唯一
	Name      string        `json:"name"`      // 游戏房间名
	Creator   int32         `json:"creator"`   // 创建者Id
	Players   []*TeamPlayer `json:"players"`   // 玩家Id列表
	Status    GameStatus    `json:"status"`    // 游戏状态
	Winner    int32         `json:"winner"`    // 胜利方, 1表示Team1胜利, 2表示Team2胜利
	CreatedAt time.Time     `json:"createdAt"` // 创建时间
}

type Position string

const (
	Top     Position = "上单"
	Jungle  Position = "打野"
	Mid     Position = "中单"
	ADC     Position = "ADC"
	Support Position = "辅助"
)

type TeamPlayer struct {
	Id          int32    `json:"id"`          // 玩家Id
	Name        string   `json:"name"`        // 玩家名称
	Team        int32    `json:"team"`        // 队伍编号, 1表示Team1, 2表示Team2
	Position    Position `json:"position"`    // 玩家位置
	UsePosition bool     `json:"usePosition"` // 是否使用位置卡
	DiceCnt     int32    `json:"diceCnt"`     // 本次游戏使用的骰子数量
	Hero        string   `json:"hero"`        // 英雄
}

func LoadAllGames() (map[int32]*Game, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := gamesCol.Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	games := make(map[int32]*Game)
	for cursor.Next(ctx) {
		var game Game
		if err = cursor.Decode(&game); err != nil {
			return nil, err
		}
		games[game.Id] = &game
	}

	return games, nil
}

func SaveGame(game *Game) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	filter := bson.M{"id": game.Id}
	update := bson.M{"$set": game}
	opts := options.Update().SetUpsert(true)

	_, err := gamesCol.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		log.Printf("Failed to save game %d: %v", game.Id, err)
	}
}

func DeleteGame(id int32) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := gamesCol.DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		log.Printf("Failed to delete game %d: %v", id, err)
	}
}
