package main

import (
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"lgglol/db"
	"lgglol/logic"
	"lgglol/routes"
	"log"
	"os"
)

func main() {
	err := godotenv.Load()
	if err != nil {
		log.Fatal("Error loading .env file")
	}
	
	// Initialize MongoDB
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	dbName := os.Getenv("DB_NAME")
	if dbName == "" {
		dbName = "lgglol"
	}

	if err := db.InitDB(mongoURI, dbName); err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer db.CloseDB()

	// Load data from DB
	players, err := db.LoadAllPlayers()
	if err != nil {
		log.Fatalf("Failed to load players: %v", err)
	}

	games, err := db.LoadAllGames()
	if err != nil {
		log.Fatalf("Failed to load games: %v", err)
	}

	// Initialize global state
	g := logic.NewGlobal(players, games)
	go g.StartBroadcasting()

	// Setup Gin router
	router := gin.Default()

	// 添加 CORS 中间件
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "Content-Length")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400") // 24 hours

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	routes.SetupRoutes(router, g)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("Server starting on port %s", port)
	if err = router.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
