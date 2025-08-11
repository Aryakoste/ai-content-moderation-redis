const { createClient } = require('redis');

class RedisService {
    constructor() {
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.isConnectedFlag = false;
    }

    async connect() {
        try {
            // Main Redis client
            this.client = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (times) => Math.min(times * 50, 2000)
            });

            // Subscriber client for Pub/Sub
            this.subscriber = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            // Publisher client for Pub/Sub
            this.publisher = createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            // Connect all clients
            await Promise.all([
                this.client.connect(),
                this.subscriber.connect(),
                this.publisher.connect()
            ]);

            this.isConnectedFlag = true;
            console.log('✅ Redis connections established');

            // Initialize data structures
            await this.initializeDataStructures();

        } catch (error) {
            console.error('❌ Redis connection failed:', error);
            throw error;
        }
    }

    async initializeDataStructures() {
        try {
            // Create vector index for semantic search
            try {
                await this.client.ft.create('idx:content_vectors', {
                    '$.vector': {
                        type: 'VECTOR',
                        ALGORITHM: 'FLAT',
                        TYPE: 'FLOAT32',
                        DIM: 384,
                        DISTANCE_METRIC: 'COSINE'
                    },
                    '$.text': 'TEXT',
                    '$.status': 'TAG',
                    '$.category': 'TAG'
                }, {
                    ON: 'JSON',
                    PREFIX: 'content:'
                });
                console.log('✅ Vector index created');
            } catch (error) {
                if (!error.message.includes('Index already exists')) {
                    console.error('Vector index creation error:', error);
                }
            }

            // Initialize time series for metrics
            const metrics = [
                'metrics:content:processed',
                'metrics:content:flagged',
                'metrics:content:approved',
                'metrics:processing:time',
                'metrics:accuracy:rate'
            ];

            for (const metric of metrics) {
                try {
                    await this.client.ts.create(metric, {
                        RETENTION: 86400000, // 24 hours
                        LABELS: { type: 'content_moderation' }
                    });
                } catch (error) {
                    if (!error.message.includes('key already exists')) {
                        console.error(`Time series creation error for ${metric}:`, error);
                    }
                }
            }
            console.log('✅ Time series initialized');

        } catch (error) {
            console.error('Data structure initialization error:', error);
        }
    }

    // Streams operations
    async addToStream(streamKey, data) {
        try {
            const id = await this.client.xAdd(streamKey, '*', data);
            return id;
        } catch (error) {
            console.error('Stream add error:', error);
            throw error;
        }
    }

    async readFromStream(streamKey, count = 10, startId = '0') {
        try {
            const messages = await this.client.xRange(streamKey, startId, '+', {
                COUNT: count
            });
            return messages;
        } catch (error) {
            console.error('Stream read error:', error);
            throw error;
        }
    }

    async createConsumerGroup(streamKey, groupName, startId = '$') {
        try {
            await this.client.xGroupCreate(streamKey, groupName, startId, {
                MKSTREAM: true
            });
            return true;
        } catch (error) {
            if (!error.message.includes('BUSYGROUP')) {
                console.error('Consumer group creation error:', error);
                return false;
            }
            return true;
        }
    }

    async consumeFromGroup(streamKey, groupName, consumerName, count = 1) {
        try {
            const messages = await this.client.xReadGroup(
                groupName,
                consumerName,
                [{ key: streamKey, id: '>' }],
                { COUNT: count, BLOCK: 1000 }
            );
            return messages;
        } catch (error) {
            console.error('Group consume error:', error);
            throw error;
        }
    }

    // JSON operations
    async setJSON(key, path, value) {
        try {
            await this.client.json.set(key, path, value);
            return true;
        } catch (error) {
            console.error('JSON set error:', error);
            throw error;
        }
    }

    async getJSON(key, path = '$') {
        try {
            const result = await this.client.json.get(key, { path });
            return result;
        } catch (error) {
            console.error('JSON get error:', error);
            return null;
        }
    }

    // Vector operations
    async storeVector(key, vector, metadata) {
        try {
            const document = {
                vector: this.floatArrayToBuffer(vector),
                ...metadata
            };
            await this.client.json.set(key, '$', document);
            return true;
        } catch (error) {
            console.error('Vector store error:', error);
            throw error;
        }
    }

    async searchVectors(vector, limit = 10) {
        try {
            const vectorBuffer = this.floatArrayToBuffer(vector);

            const results = await this.client.ft.search('idx:content_vectors', 
                `*=>[KNN ${limit} @vector $BLOB AS score]`, {
                PARAMS: {
                    BLOB: vectorBuffer
                },
                RETURN: ['score', 'text', 'status', 'category'],
                SORTBY: {
                    BY: 'score'
                },
                DIALECT: 2
            });

            return results;
        } catch (error) {
            console.error('Vector search error:', error);
            return { total: 0, documents: [] };
        }
    }

    // Time Series operations
    async addTimeSeriesPoint(key, timestamp, value) {
        try {
            await this.client.ts.add(key, timestamp, value);
            return true;
        } catch (error) {
            console.error('Time series add error:', error);
            return false;
        }
    }

    async getTimeSeriesRange(key, fromTimestamp, toTimestamp, aggregation = null) {
        try {
            const options = {};
            if (aggregation) {
                options.AGGREGATION = {
                    type: aggregation.type,
                    timeBucket: aggregation.timeBucket
                };
            }

            const result = await this.client.ts.range(key, fromTimestamp, toTimestamp, options);
            return result;
        } catch (error) {
            console.error('Time series range error:', error);
            return [];
        }
    }

    // Probabilistic data structures
    async addToHyperLogLog(key, elements) {
        try {
            await this.client.pfAdd(key, elements);
            return true;
        } catch (error) {
            console.error('HyperLogLog add error:', error);
            return false;
        }
    }

    async countHyperLogLog(key) {
        try {
            const count = await this.client.pfCount(key);
            return count;
        } catch (error) {
            console.error('HyperLogLog count error:', error);
            return 0;
        }
    }

    async addToBloomFilter(key, item) {
        try {
            // Using regular sets as bloom filter simulation
            await this.client.sAdd(`bloom:${key}`, item);
            return true;
        } catch (error) {
            console.error('Bloom filter add error:', error);
            return false;
        }
    }

    async checkBloomFilter(key, item) {
        try {
            const exists = await this.client.sIsMember(`bloom:${key}`, item);
            return exists;
        } catch (error) {
            console.error('Bloom filter check error:', error);
            return false;
        }
    }

    // Pub/Sub operations
    async publish(channel, message) {
        try {
            await this.publisher.publish(channel, JSON.stringify(message));
            return true;
        } catch (error) {
            console.error('Publish error:', error);
            return false;
        }
    }

    createSubscriber() {
        return this.subscriber;
    }

    // Utility functions
    floatArrayToBuffer(array) {
        const float32Array = new Float32Array(array);
        return Buffer.from(float32Array.buffer);
    }

    isConnected() {
        return this.isConnectedFlag && this.client && this.client.isOpen;
    }

    async disconnect() {
        try {
            if (this.client) await this.client.disconnect();
            if (this.subscriber) await this.subscriber.disconnect();
            if (this.publisher) await this.publisher.disconnect();
            this.isConnectedFlag = false;
            console.log('✅ Redis connections closed');
        } catch (error) {
            console.error('Redis disconnect error:', error);
        }
    }
}

module.exports = RedisService;
