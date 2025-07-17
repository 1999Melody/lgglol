package logic

import (
	"errors"
	"lgglol/db"
	"math/rand"
	"sort"
	"time"
)

func (g *Global) CreateGame(creatorID int32, name string) (*db.Game, error) {
	g.mu.Lock()
	defer g.mu.Unlock()

	creator, ok := g.Players[creatorID]
	if !ok {
		return nil, ErrPlayerNotFound
	}

	if creator.Role == db.RoleUser {
		return nil, ErrPermissionDenied
	}

	if creator.CurGameId != 0 {
		return nil, ErrPlayerInGame
	}

	newID, err := db.GetNextID("game_id")
	if err != nil {
		return nil, err
	}
	game := &db.Game{
		Id:        newID,
		Name:      name,
		Creator:   creatorID,
		Players:   []*db.TeamPlayer{},
		Status:    db.GameWaiting,
		CreatedAt: time.Now(),
	}
	game.Players = append(game.Players, &db.TeamPlayer{
		Id:   creatorID,
		Name: creator.Username,
	})

	g.Games[newID] = game
	creator.CurGameId = newID

	g.innerPlayerChange(creator)
	g.innerGameChange(game)
	return game, nil
}

func (g *Global) GetAllGames() []*db.Game {
	g.mu.RLock()
	defer g.mu.RUnlock()

	games := make([]*db.Game, 0, len(g.Games))
	for _, game := range g.Games {
		games = append(games, game)
	}
	sort.Slice(games, func(i, j int) bool {
		return games[i].CreatedAt.After(games[j].CreatedAt)
	})
	return games
}

func (g *Global) JoinGame(playerID, gameID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerID]
	if !ok {
		return ErrPlayerNotFound
	}

	if player.CurGameId == gameID {
		return nil // already in the game
	}

	if player.CurGameId != 0 {
		return ErrPlayerInGame
	}

	game, ok := g.Games[gameID]
	if !ok {
		return ErrGameNotFound
	}

	if game.Status != db.GameWaiting {
		return ErrGameNotWaiting
	}

	if len(game.Players) >= 10 {
		return ErrGameFull
	}

	// Add player to game
	game.Players = append(game.Players, &db.TeamPlayer{
		Id:   playerID,
		Name: player.Username,
	})
	player.CurGameId = gameID

	g.innerPlayerChange(player)
	g.innerGameChange(game)
	return nil
}

func (g *Global) LeaveGame(playerID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerID]
	if !ok {
		return ErrPlayerNotFound
	}

	if player.CurGameId == 0 {
		return ErrPlayerNotInGame
	}

	game, ok := g.Games[player.CurGameId]
	if !ok {
		player.CurGameId = 0
		g.innerPlayerChange(player)
		return nil
	}

	if game.Status != db.GameWaiting {
		return ErrGameNotWaiting
	}

	// Remove player from game
	game.Players = removePlayerFromSlice(game.Players, playerID)
	player.CurGameId = 0

	g.innerPlayerChange(player)

	if len(game.Players) == 0 {
		delete(g.Games, game.Id)
		g.innerGameDel(game.Id)
		return nil
	}

	if game.Creator == playerID {
		game.Creator = game.Players[0].Id
	}

	g.innerGameChange(game)
	return nil
}

func (g *Global) DeleteGame(requesterID, gameID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	requester, ok := g.Players[requesterID]
	if !ok {
		return ErrPlayerNotFound
	}

	game, ok := g.Games[gameID]
	if !ok {
		return ErrGameNotFound
	}

	// Check permission
	if requester.Role == db.RoleUser && game.Creator != requesterID {
		return ErrPermissionDenied
	}

	players := make([]*db.Player, len(game.Players))
	// Update all players in the game
	for _, player := range game.Players {
		if p, ok := g.Players[player.Id]; ok {
			p.CurGameId = 0
			players = append(players, p)
		}
	}

	g.innerPlayersChange(players)

	delete(g.Games, gameID)
	g.innerGameDel(gameID)
	return nil
}

func (g *Global) UsePositionCard(playerID int32, position db.Position) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerID]
	if !ok {
		return ErrPlayerNotFound
	}

	if player.CurGameId == 0 {
		return ErrPlayerNotFound
	}

	game, ok := g.Games[player.CurGameId]
	if !ok {
		player.CurGameId = 0
		g.innerPlayerChange(player)
		return nil
	}

	if game.Status != db.GameWaiting {
		return ErrGameNotWaiting
	}

	if !isValidPosition(position) {
		return ErrInvalidPosition
	}

	if player.PositionCard <= 0 {
		return ErrNotEnoughPositionCards
	}

	// Check if position is already taken by 2 players
	count := 0
	for _, p := range game.Players {
		if p.Position == position {
			count++
		}
	}
	if count >= 2 {
		return ErrPositionTaken
	}

	// Find player in game
	var teamPlayer *db.TeamPlayer
	for _, p := range game.Players {
		if p.Id == playerID {
			teamPlayer = p
			break
		}
	}
	if teamPlayer == nil {
		return ErrPlayerNotFound
	}

	player.PositionCard--
	teamPlayer.Position = position
	teamPlayer.UsePosition = true

	g.innerPlayerChange(player)
	g.innerGameChange(game)
	return nil
}

func (g *Global) RollTeams(playerId, gameID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerId]
	if !ok {
		return ErrPlayerNotFound
	}

	game, ok := g.Games[gameID]
	if !ok {
		return ErrGameNotFound
	}

	if player.Id != game.Creator && player.Role == db.RoleUser {
		return ErrPermissionDenied
	}

	if game.Status != db.GameWaiting {
		return ErrGameNotWaiting
	}

	if len(game.Players) != 10 {
		return errors.New("need exactly 10 players to roll teams")
	}

	// 1. 处理使用位置卡的玩家
	positionGroups := make(map[db.Position][]*db.TeamPlayer)
	for _, p := range game.Players {
		if p.UsePosition {
			positionGroups[p.Position] = append(positionGroups[p.Position], p)
		}
	}

	// 确保相同位置不超过2人
	for pos, players := range positionGroups {
		if len(players) > 2 {
			return errors.New("too many players for position: " + string(pos))
		}
	}

	// 分配队伍给使用位置卡的玩家
	for _, players := range positionGroups {
		switch len(players) {
		case 1:
			// 随机分配到一队
			if rand.Intn(2) == 0 {
				players[0].Team = 1
			} else {
				players[0].Team = 2
			}
		case 2:
			// 确保分配到不同队伍
			players[0].Team = 1
			players[1].Team = 2
		}
	}

	// 2. 处理未使用位置卡的玩家
	var nonPositionedPlayers []*db.TeamPlayer
	for _, p := range game.Players {
		if !p.UsePosition {
			nonPositionedPlayers = append(nonPositionedPlayers, p)
		}
	}

	// 随机打乱顺序
	rand.Shuffle(len(nonPositionedPlayers), func(i, j int) {
		nonPositionedPlayers[i], nonPositionedPlayers[j] = nonPositionedPlayers[j], nonPositionedPlayers[i]
	})

	// 分配队伍和位置
	for _, p := range nonPositionedPlayers {
		// 平衡队伍人数
		team1Count := countPlayersInTeam(game.Players, 1)
		team2Count := countPlayersInTeam(game.Players, 2)

		if team1Count <= team2Count {
			p.Team = 1
		} else {
			p.Team = 2
		}

		// 分配可用位置
		p.Position = getRandomAvailablePosition(game.Players, p.Team)
	}

	// 3. 分配随机英雄
	allHeroes := getLOLHeroes()
	usedHeroes := make(map[string]bool)
	for _, p := range game.Players {
		for {
			hero := allHeroes[rand.Intn(len(allHeroes))]
			if !usedHeroes[hero] {
				p.Hero = hero
				usedHeroes[hero] = true
				break
			}
		}
	}

	game.Status = db.GameRolling

	g.innerGameChange(game)
	return nil
}

func (g *Global) ReRollHero(playerID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerID]
	if !ok {
		return ErrPlayerNotFound
	}

	if player.CurGameId == 0 {
		return ErrPlayerNotInGame
	}

	game, ok := g.Games[player.CurGameId]
	if !ok {
		player.CurGameId = 0
		g.innerPlayerChange(player)
		return nil
	}

	if game.Status != db.GameRolling {
		return errors.New("can only reroll during rolling phase")
	}

	if player.Dice <= 0 {
		return ErrNotEnoughDice
	}

	// Find player in game
	var teamPlayer *db.TeamPlayer
	for _, p := range game.Players {
		if p.Id == playerID {
			teamPlayer = p
			break
		}
	}
	if teamPlayer == nil {
		return ErrPlayerNotFound
	}

	player.Dice--
	teamPlayer.DiceCnt++

	// Get new hero that's not already assigned
	allHeroes := getLOLHeroes()
	currentHeroes := make(map[string]bool)
	for _, p := range game.Players {
		currentHeroes[p.Hero] = true
	}

	var availableHeroes []string
	for _, hero := range allHeroes {
		if !currentHeroes[hero] && hero != teamPlayer.Hero {
			availableHeroes = append(availableHeroes, hero)
		}
	}

	// Assign random new hero
	teamPlayer.Hero = availableHeroes[rand.Intn(len(availableHeroes))]

	g.innerPlayerChange(player)
	g.innerGameChange(game)
	return nil
}

func (g *Global) StartGame(playerId, gameID int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	player, ok := g.Players[playerId]
	if !ok {
		return ErrPlayerNotFound
	}

	game, ok := g.Games[gameID]
	if !ok {
		return ErrGameNotFound
	}

	if game.Creator != playerId && player.Role == db.RoleUser {
		return ErrNotGameOwner
	}

	if game.Status != db.GameRolling {
		return errors.New("can only start game from rolling phase")
	}

	// Check team sizes
	team1Count := countPlayersInTeam(game.Players, 1)
	team2Count := countPlayersInTeam(game.Players, 2)
	if team1Count != 5 || team2Count != 5 {
		return errors.New("both teams must have 5 players")
	}

	game.Status = db.GameInGame
	g.innerGameChange(game)
	return nil
}

func (g *Global) EndGame(creatorID, gameID int32, winner int32) error {
	g.mu.Lock()
	defer g.mu.Unlock()

	creator, ok := g.Players[creatorID]
	if !ok {
		return ErrPlayerNotFound
	}

	game, ok := g.Games[gameID]
	if !ok {
		return ErrGameNotFound
	}

	if game.Creator != creatorID && creator.Role == db.RoleUser {
		return ErrNotGameOwner
	}

	if game.Status != db.GameInGame {
		return errors.New("game is not in progress")
	}

	if winner != 1 && winner != 2 {
		return errors.New("winner must be 1 (team1) or 2 (team2)")
	}

	game.Winner = winner
	game.Status = db.GameFinished

	// Update player stats
	for _, player := range game.Players {
		p, ok := g.Players[player.Id]
		if !ok {
			continue
		}

		if player.Team == winner {
			p.Wins++
		} else {
			p.Losses++
		}
		p.CurGameId = 0
		g.innerPlayerChange(p)
	}

	g.innerGameChange(game)
	return nil
}

// Helper functions
func removePlayerFromSlice(slice []*db.TeamPlayer, playerID int32) []*db.TeamPlayer {
	for i, player := range slice {
		if player.Id == playerID {
			return append(slice[:i], slice[i+1:]...)
		}
	}
	return slice
}

func isValidPosition(position db.Position) bool {
	switch position {
	case db.Top, db.Jungle, db.Mid, db.ADC, db.Support:
		return true
	default:
		return false
	}
}

func countPlayersInTeam(players []*db.TeamPlayer, team int32) int {
	count := 0
	for _, p := range players {
		if p.Team == team {
			count++
		}
	}
	return count
}

func getRandomAvailablePosition(players []*db.TeamPlayer, team int32) db.Position {
	teamPositions := make(map[db.Position]bool)
	for _, p := range players {
		if p.Team == team && p.Position != "" {
			teamPositions[p.Position] = true
		}
	}

	allPositions := []db.Position{db.Top, db.Jungle, db.Mid, db.ADC, db.Support}
	var available []db.Position
	for _, pos := range allPositions {
		if !teamPositions[pos] {
			available = append(available, pos)
		}
	}

	return available[rand.Intn(len(available))]
}

func getLOLHeroes() []string {
	return []string{
		"亚托克斯", "阿狸", "阿卡丽", "阿克尚", "阿利斯塔", "阿木木", "艾尼维亚", "安妮", "厄斐琉斯", "艾希",
		"奥瑞利安·索尔", "阿兹尔", "巴德", "布里茨", "布兰德", "布隆", "凯特琳", "卡蜜尔", "卡西奥佩娅",
		"科加斯", "库奇", "德莱厄斯", "黛安娜", "蒙多医生", "德莱文", "艾克", "伊莉丝", "伊芙琳", "伊泽瑞尔",
		"费德提克", "菲奥娜", "菲兹", "加里奥", "普朗克", "盖伦", "纳尔", "古拉加斯", "格雷福斯", "格温",
		"赫卡里姆", "黑默丁格", "俄洛伊", "艾瑞莉娅", "艾翁", "迦娜", "嘉文四世", "贾克斯", "杰斯", "烬",
		"金克丝", "卡莎", "卡莉丝塔", "卡尔玛", "卡尔萨斯", "卡萨丁", "卡特琳娜", "凯尔", "凯隐", "凯南",
		"卡兹克", "千珏", "克烈", "克格莫", "乐芙兰", "李青", "蕾欧娜", "莉莉娅", "丽桑卓", "卢锡安",
		"璐璐", "拉克丝", "墨菲特", "玛尔扎哈", "茂凯", "易大师", "厄运小姐", "莫德凯撒", "莫甘娜",
		"娜美", "内瑟斯", "诺提勒斯", "妮蔻", "奈德丽", "魔腾", "努努和威朗普", "奥拉夫", "奥莉安娜",
		"奥恩", "潘森", "波比", "派克", "奇亚娜", "奎因", "洛", "拉莫斯", "雷克塞", "芮尔",
		"雷克顿", "雷恩加尔", "锐雯", "兰博", "瑞兹", "萨米拉", "瑟庄妮", "赛娜", "萨勒芬妮", "瑟提",
		"萨科", "慎", "希瓦娜", "辛吉德", "赛恩", "希维尔", "斯卡纳", "娑娜", "索拉卡", "斯维因",
		"塞拉斯", "辛德拉", "塔姆", "塔莉垭", "泰隆", "塔里克", "提莫", "锤石", "崔丝塔娜", "特朗德尔",
		"泰达米尔", "崔斯特", "图奇", "乌迪尔", "厄加特", "韦鲁斯", "薇恩", "维迦", "维克兹", "薇古丝",
		"蔚", "佛耶戈", "维克托", "弗拉基米尔", "沃利贝尔", "沃里克", "悟空", "霞", "泽拉斯", "赵信",
		"亚索", "永恩", "约里克", "悠米", "扎克", "劫", "泽丽", "吉格斯", "基兰", "佐伊", "婕拉",
	}
}
