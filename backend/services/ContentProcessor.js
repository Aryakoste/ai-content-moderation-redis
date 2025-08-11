const VectorService = require('./VectorService');
const { v4: uuidv4 } = require('uuid');

class ContentProcessor {
    constructor(redisService, io) {
        this.redis = redisService;
        this.io = io;
        this.vectorService = new VectorService(redisService);
        this.streamKey = 'content:stream';
        this.groupName = 'content-processors';
        this.consumerName = `processor-${Date.now()}`;
        this.isProcessing = false;
        this.processingStats = {
            totalProcessed: 0,
            totalFlagged: 0,
            totalApproved: 0,
            averageProcessingTime: 0
        };
    }

    async submitContent(contentData) {
        try {
            const contentId = uuidv4();
            const timestamp = Date.now();

            const streamData = {
                contentId,
                text: contentData.text,
                category: contentData.category || 'general',
                userId: contentData.userId || 'anonymous',
                timestamp: timestamp.toString(),
                source: contentData.source || 'web'
            };

            // Add to Redis Stream for processing
            const streamId = await this.redis.addToStream(this.streamKey, streamData);

            // Store initial content data in JSON
            await this.redis.setJSON(`content:${contentId}`, '$', {
                id: contentId,
                text: contentData.text,
                category: streamData.category,
                userId: streamData.userId,
                timestamp,
                status: 'pending',
                source: streamData.source,
                streamId
            });

            // Add to unique visitors tracking
            await this.redis.addToHyperLogLog('visitors:unique', [streamData.userId]);

            console.log(`Content submitted: ${contentId}`);
            return { contentId, streamId };

        } catch (error) {
            console.error('Content submission error:', error);
            throw error;
        }
    }

    async startStreamConsumer() {
        try {
            // Create consumer group if it doesn't exist
            await this.redis.createConsumerGroup(this.streamKey, this.groupName);

            console.log(`✅ Content processor consumer started: ${this.consumerName}`);
            this.isProcessing = true;

            // Start consuming in background
            this.consumeLoop();

        } catch (error) {
            console.error('Failed to start stream consumer:', error);
            throw error;
        }
    }

    async consumeLoop() {
        while (this.isProcessing) {
            try {
                const messages = await this.redis.consumeFromGroup(
                    this.streamKey, 
                    this.groupName, 
                    this.consumerName, 
                    1
                );

                if (messages && messages.length > 0) {
                    for (const stream of messages) {
                        for (const message of stream.messages) {
                            await this.processContent(message);
                        }
                    }
                } else {
                    // No new messages, wait before next poll
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

            } catch (error) {
                console.error('Consumer loop error:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    async processContent(message) {
        const startTime = Date.now();
        const { contentId, text, category, userId, timestamp } = message.message;

        try {
            console.log(`Processing content: ${contentId}`);

            // AI-powered content analysis
            const analysis = await this.analyzeContent(text, category);

            // Store vector embedding for semantic search
            await this.vectorService.storeContentVector(contentId, text, analysis);

            // Update content with analysis results
            const contentUpdate = {
                analysis,
                status: analysis.isToxic ? 'flagged' : 'approved',
                processedAt: Date.now(),
                processingTime: Date.now() - startTime
            };

            await this.redis.setJSON(`content:${contentId}`, '$', contentUpdate);

            // Update time series metrics
            const currentTime = Date.now();
            await this.redis.addTimeSeriesPoint('metrics:content:processed', currentTime, 1);

            if (analysis.isToxic) {
                await this.redis.addTimeSeriesPoint('metrics:content:flagged', currentTime, 1);
                this.processingStats.totalFlagged++;
            } else {
                await this.redis.addTimeSeriesPoint('metrics:content:approved', currentTime, 1);
                this.processingStats.totalApproved++;
            }

            await this.redis.addTimeSeriesPoint('metrics:processing:time', currentTime, contentUpdate.processingTime);
            await this.redis.addTimeSeriesPoint('metrics:accuracy:rate', currentTime, analysis.confidence * 100);

            // Check for duplicate content using Bloom filter
            const textHash = this.hashContent(text);
            const isDuplicate = await this.redis.checkBloomFilter('content_hashes', textHash);
            if (!isDuplicate) {
                await this.redis.addToBloomFilter('content_hashes', textHash);
            }

            // Update processing stats
            this.processingStats.totalProcessed++;
            this.processingStats.averageProcessingTime = 
                (this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - 1) + 
                 contentUpdate.processingTime) / this.processingStats.totalProcessed;

            // Publish results via Pub/Sub
            await this.redis.publish('content:processed', {
                contentId,
                status: contentUpdate.status,
                analysis,
                processingTime: contentUpdate.processingTime,
                timestamp: currentTime,
                isDuplicate
            });

            // Emit to WebSocket clients
            this.io.emit('content_processed', {
                contentId,
                text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
                status: contentUpdate.status,
                analysis,
                processingTime: contentUpdate.processingTime,
                category,
                timestamp: currentTime
            });

            console.log(`✅ Content processed: ${contentId} - ${contentUpdate.status}`);

        } catch (error) {
            console.error(`❌ Content processing failed for ${contentId}:`, error);

            // Update content with error status
            await this.redis.setJSON(`content:${contentId}`, '$', {
                status: 'error',
                error: error.message,
                processedAt: Date.now(),
                processingTime: Date.now() - startTime
            });
        }
    }

    async analyzeContent(text, category) {
        try {
            // Simulate AI-powered content analysis
            // In production, this would call actual AI services

            const textLower = text.toLowerCase();
            const toxicWords = ['hate', 'stupid', 'terrible', 'awful', 'horrible', 'disgusting'];
            const positiveWords = ['great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'love'];

            // Toxicity detection
            let toxicityScore = 0;
            let positiveScore = 0;

            toxicWords.forEach(word => {
                if (textLower.includes(word)) {
                    toxicityScore += 0.3;
                }
            });

            positiveWords.forEach(word => {
                if (textLower.includes(word)) {
                    positiveScore += 0.2;
                }
            });

            toxicityScore = Math.min(toxicityScore, 1.0);
            positiveScore = Math.min(positiveScore, 1.0);

            // Sentiment analysis
            let sentiment = 'neutral';
            if (positiveScore > toxicityScore && positiveScore > 0.3) {
                sentiment = 'positive';
            } else if (toxicityScore > positiveScore && toxicityScore > 0.3) {
                sentiment = 'negative';
            }

            // Content categorization based on keywords
            const categories = {
                review: ['product', 'service', 'quality', 'recommend', 'buy'],
                support: ['help', 'problem', 'issue', 'bug', 'error'],
                feedback: ['suggest', 'improve', 'feature', 'idea'],
                general: []
            };

            let detectedCategory = category || 'general';
            for (const [cat, keywords] of Object.entries(categories)) {
                if (keywords.some(keyword => textLower.includes(keyword))) {
                    detectedCategory = cat;
                    break;
                }
            }

            // Calculate confidence based on text length and keyword matches
            const confidence = Math.min(0.5 + (text.length / 200) * 0.3 + 
                               (toxicityScore > 0 ? 0.2 : 0) + 
                               (positiveScore > 0 ? 0.1 : 0), 0.95);

            const isToxic = toxicityScore > 0.5;

            return {
                toxicityScore: Math.round(toxicityScore * 100) / 100,
                positiveScore: Math.round(positiveScore * 100) / 100,
                sentiment,
                category: detectedCategory,
                isToxic,
                confidence: Math.round(confidence * 100) / 100,
                keywords: this.extractKeywords(text),
                wordCount: text.split(' ').length,
                language: 'en' // Simulate language detection
            };

        } catch (error) {
            console.error('Content analysis error:', error);
            return {
                toxicityScore: 0,
                positiveScore: 0,
                sentiment: 'neutral',
                category: category || 'general',
                isToxic: false,
                confidence: 0.1,
                keywords: [],
                wordCount: text.split(' ').length,
                language: 'en',
                error: error.message
            };
        }
    }

    extractKeywords(text) {
        // Simple keyword extraction
        const words = text.toLowerCase()
            .replace(/[^a-zA-Z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 3);

        const wordCount = {};
        words.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });

        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([word]) => word);
    }

    hashContent(text) {
        // Simple hash function for duplicate detection
        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString();
    }

    async getContentById(contentId) {
        try {
            const content = await this.redis.getJSON(`content:${contentId}`);
            return content;
        } catch (error) {
            console.error('Get content error:', error);
            return null;
        }
    }

    async searchContent(query, limit = 10) {
        try {
            // Use vector similarity search
            const vector = await this.vectorService.generateEmbedding(query);
            const results = await this.redis.searchVectors(vector, limit);

            return results;
        } catch (error) {
            console.error('Content search error:', error);
            return { total: 0, documents: [] };
        }
    }

    async getProcessingStats() {
        try {
            const uniqueVisitors = await this.redis.countHyperLogLog('visitors:unique');

            return {
                ...this.processingStats,
                uniqueVisitors,
                isProcessing: this.isProcessing
            };
        } catch (error) {
            console.error('Get processing stats error:', error);
            return this.processingStats;
        }
    }

    async submitFeedback(contentId, feedback) {
        try {
            const feedbackData = {
                contentId,
                feedback,
                timestamp: Date.now(),
                id: uuidv4()
            };

            // Store feedback
            await this.redis.setJSON(`feedback:${feedbackData.id}`, '$', feedbackData);

            // Add to feedback stream for processing
            await this.redis.addToStream('feedback:stream', {
                feedbackId: feedbackData.id,
                contentId,
                feedback: feedback.toString(),
                timestamp: feedbackData.timestamp.toString()
            });

            console.log(`Feedback submitted for content: ${contentId}`);
            return feedbackData;

        } catch (error) {
            console.error('Feedback submission error:', error);
            throw error;
        }
    }

    stopProcessing() {
        this.isProcessing = false;
        console.log('Content processor stopped');
    }
}

module.exports = ContentProcessor;
