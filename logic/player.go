package logic

import (
	"errors"
	"golang.org/x/crypto/bcrypt"
	"lgglol/db"
	"time"
)

var (
	ErrPlayerNotFound         = errors.New("player not found")
	ErrUsernameExists         = errors.New("username already exists")
	ErrPermissionDenied       = errors.New("permission denied")
	ErrInvalidCredentials     = errors.New("invalid credentials")
	ErrPlayerInGame           = errors.New("player already in a game")
	ErrPlayerNotInGame        = errors.New("player not in a game")
	ErrGameNotFound           = errors.New("game not found")
	ErrGameFull               = errors.New("game is full")
	ErrGameNotWaiting         = errors.New("game is not in waiting state")
	ErrPositionTaken          = errors.New("position already taken")
	ErrInvalidPosition        = errors.New("invalid position")
	ErrNotEnoughDice          = errors.New("not enough dice")
	ErrNotEnoughPositionCards = errors.New("not enough position cards")
	ErrNotGameOwner           = errors.New("only game owner can perform this action")
)

func (g *Global) Register(username, password string) (*db.Player, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	// 检查用户名是否存在
	for _, p := range g.Players {
		if p.Username == username {
			return nil, ErrUsernameExists
		}
	}

	// 哈希密码
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	// 创建新玩家
	newID, err := db.GetNextID("player_id")
	if err != nil {
		return nil, err
	}
	player := &db.Player{
		Id:           newID,
		Username:     username,
		Password:     string(hashedPassword),
		Role:         db.RoleUser,
		PositionCard: 3,
		Dice:         5,
		CreatedAt:    time.Now(),
	}

	g.Players[newID] = player
	db.SavePlayer(player)

	return player, nil
}

func (g *Global) Login(username, password string) (*db.Player, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	for _, p := range g.Players {
		if p.Username == username {
			if err := bcrypt.CompareHashAndPassword([]byte(p.Password), []byte(password)); err != nil {
				return nil, ErrInvalidCredentials
			}
			return p, nil
		}
	}

	return nil, ErrPlayerNotFound
}

func (g *Global) ChangeRole(requesterID, targetID int32, role db.Role) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	requester, ok := g.Players[requesterID]
	if !ok {
		return ErrPlayerNotFound
	}

	if requester.Role != db.RoleRoot {
		return ErrPermissionDenied
	}

	target, ok := g.Players[targetID]
	if !ok {
		return ErrPlayerNotFound
	}

	target.Role = role
	g.innerPlayerChange(target)
	return nil
}

func (g *Global) GetPlayer(id int32) (*db.Player, error) {
	g.mu.RLock()
	defer g.mu.RUnlock()

	player, ok := g.Players[id]
	if !ok {
		return nil, ErrPlayerNotFound
	}

	return player, nil
}

func (g *Global) GetAllPlayers() []*db.Player {
	g.mu.RLock()
	defer g.mu.RUnlock()

	players := make([]*db.Player, 0, len(g.Players))
	for _, p := range g.Players {
		players = append(players, p)
	}

	return players
}
