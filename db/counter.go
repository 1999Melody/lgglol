package db

import (
	"context"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
	"log"
)

func GetNextId(name string) (int32, error) {
	filter := bson.M{"id": name}
	update := bson.M{"$inc": bson.M{"seq": 1}}
	opts := options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After)

	var result struct {
		Seq int32 `bson:"seq"`
	}
	err := counterCol.FindOneAndUpdate(
		context.Background(),
		filter,
		update,
		opts,
	).Decode(&result)
	if err != nil {
		log.Printf("Failed to get next Id for %s: %v", name, err)
		return 0, err
	}
	return result.Seq, nil
}
