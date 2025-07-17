package routes

import (
	"lgglol/db"
	"lgglol/logic"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func SetupRoutes(router *gin.Engine, g *logic.Global) {
	// Auth routes
	auth := router.Group("/api/auth")
	{
		auth.POST("/register", func(c *gin.Context) {
			var req struct {
				Username string `json:"username"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			player, err := g.Register(req.Username, req.Password)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, player)
		})
		auth.POST("/login", func(c *gin.Context) {
			var req struct {
				Username string `json:"username"`
				Password string `json:"password"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			player, err := g.Login(req.Username, req.Password)
			if err != nil {
				c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
				return
			}

			token, err := logic.GenerateJWT(player.Id)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
				return
			}

			c.JSON(http.StatusOK, gin.H{
				"token":  token,
				"player": player,
			})
		})
	}

	// Player routes
	player := router.Group("/api/player")
	player.GET("/all", func(c *gin.Context) {
		players := g.GetAllPlayers()
		c.JSON(http.StatusOK, players)
	})
	player.Use(AuthMiddleware(g))
	{
		player.POST("/change_role", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")
			var req struct {
				TargetId int32   `json:"targetId"`
				Role     db.Role `json:"role"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.ChangeRole(int32(playerId), req.TargetId, req.Role); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "role changed successfully"})
		})
	}

	// Game routes
	game := router.Group("/api/game")
	// 获取所有比赛，包括历史记录
	game.GET("/all", func(c *gin.Context) {
		games := g.GetAllGames()
		c.JSON(http.StatusOK, games)
	})
	game.Use(AuthMiddleware(g))
	{
		game.POST("/create", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")
			var req struct {
				Name string `json:"name"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			game, err := g.CreateGame(int32(playerId), req.Name)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, game)

		})
		game.POST("/join", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			var req struct {
				GameId int32 `json:"gameId"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.JoinGame(int32(playerId), req.GameId); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "joined game successfully"})
		})
		game.POST("/leave", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			if err := g.LeaveGame(int32(playerId)); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "left game successfully"})
		})
		//game.DELETE("/delete", func(c *gin.Context) {
		//	playerId := c.GetInt64("playerId")
		//
		//	var req struct {
		//		GameId int32 `json:"gameId"`
		//	}
		//	if err := c.ShouldBindJSON(&req); err != nil {
		//		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		//		return
		//	}
		//
		//	if err := g.DeleteGame(int32(playerId), req.GameId); err != nil {
		//		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		//		return
		//	}
		//
		//	c.JSON(http.StatusOK, gin.H{"message": "game deleted successfully"})
		//})
		// 使用位置卡
		game.POST("/use_position", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")
			var req struct {
				Position db.Position `json:"position"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.UsePositionCard(int32(playerId), req.Position); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "position card used successfully"})
		})

		// 开始ROLL队伍
		game.POST("/roll", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			var req struct {
				GameId int32 `json:"gameId"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.RollTeams(int32(playerId), req.GameId); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "teams rolled successfully"})
		})

		// 重ROLL英雄
		game.POST("/reroll", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			if err := g.ReRollHero(int32(playerId)); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "hero rerolled successfully"})
		})

		// 开始游戏
		game.POST("/start", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			var req struct {
				GameId int32 `json:"gameId"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.StartGame(int32(playerId), req.GameId); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "game started successfully"})
		})

		// 结束游戏并指定胜者
		game.POST("/end", func(c *gin.Context) {
			playerId := c.GetInt64("playerId")

			var req struct {
				GameId int32 `json:"gameId"`
				Winner int32 `json:"winner"` // 1 or 2
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			if err := g.EndGame(int32(playerId), req.GameId, req.Winner); err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			c.JSON(http.StatusOK, gin.H{"message": "game ended successfully"})
		})
	}

	// WebSocket route
	router.GET("/ws", func(c *gin.Context) {
		playerId := c.GetInt64("playerId")
		conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		g.AddClient(int32(playerId), conn)

		// Send initial data
		g.SendToPlayer(int32(playerId), "players_update", g.GetAllPlayers())
		g.SendToPlayer(int32(playerId), "games_update", g.GetAllGames())

		// 不需要单独的处理协程，因为现在由Client.handleConnection管理
	})
}

func AuthMiddleware(g *logic.Global) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authorization header required"})
			c.Abort()
			return
		}

		// 格式应为 "Bearer <token>"
		tokenString := authHeader
		if len(tokenString) > 7 && tokenString[:7] == "Bearer " {
			tokenString = tokenString[7:]
		}

		claims, err := logic.ParseJWT(tokenString)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// 检查玩家是否存在
		if _, err = g.GetPlayer(claims.PlayerId); err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid player"})
			c.Abort()
			return
		}

		// 使用GetInt64代替GetInt32
		c.Set("playerId", int64(claims.PlayerId))
		c.Next()
	}
}

// 辅助函数：从路径参数获取int32
func getInt32Param(c *gin.Context, param string) (int32, error) {
	val, err := strconv.ParseInt(c.Param(param), 10, 32)
	if err != nil {
		return 0, err
	}
	return int32(val), nil
}
