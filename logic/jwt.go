package logic

import (
	"errors"
	"github.com/golang-jwt/jwt/v5"
	"time"
)

var (
	ErrInvalidToken = errors.New("invalid token")
	jwtSecret       = []byte("your-secret-key") // 在生产环境中应从配置中获取
)

type Claims struct {
	PlayerId int32 `json:"playerId"`
	jwt.RegisteredClaims
}

func GenerateJWT(playerId int32) (string, error) {
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		PlayerId: playerId,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}

func ParseJWT(tokenString string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, ErrInvalidToken
	}

	return claims, nil
}
