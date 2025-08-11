const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import services (with fallbacks for missing Redis)
let RedisService, ContentProcessor, AnalyticsService, VectorService;

try {
    RedisService = require('./services/RedisService');
    ContentProcessor = require('./services/ContentProcessor');
    AnalyticsService = require('./services/AnalyticsService');
    VectorService = require('./services/VectorService');
} catch (error) {
    console.log('Redis services not available, running in demo mode');
}

// Import routes
const contentRoutes = require('./routes/content');
const analyticsRoutes = require('./routes/analytics');
const streamRoutes = require('./routes/stream');

class StreamlinAIServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: [
                    "http://localhost:3000",
                    "https://streamlinai.vercel.app",
                    process.env.CLIENT_URL
                ].filter(Boolean),
                methods: ["GET", "POST"],
                credentials: true
            }
        });
        this.port = process.env.PORT || 5000;
        this.redisService = null;
        this.contentProcessor = null;
        this.analyticsService = null;
        this.vectorService = null;
        this.demoMode = !process.env.REDIS_URL;
    }

    async init() {
        try {
            if (!this.demoMode && RedisService) {
                // Initialize Redis connection
                this.redisService = new RedisService();
                await this.redisService.connect();

                // Initialize services
                this.contentProcessor = new ContentProcessor(this.redisService, this.io);
                this.analyticsService = new AnalyticsService(this.redisService);
                this.vectorService = new VectorService(this.redisService);

                // Start background services
                await this.startBackgroundServices();
            } else {
                console.log('🚀 Running in demo mode without Redis');
                this.initDemoMode();
            }

            // Setup middleware
            this.setupMiddleware();

            // Setup routes
            this.setupRoutes();

            // Setup WebSocket handlers
            this.setupWebSocket();

            console.log('✅ StreamlinAI Server initialized successfully');
        } catch (error) {
            console.error('❌ Failed to initialize server:', error);
            console.log('🚀 Falling back to demo mode');
            this.demoMode = true;
            this.initDemoMode();

            this.setupMiddleware();
            this.setupRoutes();
            this.setupWebSocket();
        }
    }

    initDemoMode() {
        // Initialize demo services with mock data
        this.contentProcessor = {
            submitContent: async (data) => ({ 
                contentId: 'demo-' + Date.now(), 
                streamId: 'demo-stream-id' 
            }),
            getContentById: async (id) => ({
                id,
                text: 'This is demo content',
                status: 'approved',
                analysis: { sentiment: 'positive', toxicity: 0.1 }
            }),
            getProcessingStats: async () => ({
                totalProcessed: 1247,
                totalFlagged: 89,
                uniqueVisitors: 2341
            }),
            submitFeedback: async (id, feedback) => ({ id: Date.now(), feedback })
        };

        this.analyticsService = {
            getDashboardData: async () => ({
                realtime: {
                    totalProcessed: 1247,
                    totalFlagged: 89,
                    totalApproved: 1058,
                    avgProcessingTime: 45,
                    currentAccuracy: 94.2,
                    uniqueVisitors: 2341
                },
                content: {
                    sentimentDistribution: { positive: 65.2, neutral: 22.8, negative: 12.0 }
                },
                system: {
                    cpu: { current: 23.5, average: 28.7 },
                    memory: { current: 67.8, average: 72.1 }
                },
                trends: { processed: [], flagged: [] }
            }),
            getRealtimeMetrics: async () => ({
                totalProcessed: 1247,
                totalFlagged: 89,
                avgProcessingTime: 45
            })
        };

        this.vectorService = {
            semanticSearch: async (query) => ({
                query,
                total: 5,
                results: [
                    { id: 'demo1', text: 'Demo result 1', score: 0.9 },
                    { id: 'demo2', text: 'Demo result 2', score: 0.8 }
                ]
            }),
            findSimilarContent: async () => [],
            getVectorStats: async () => ({ totalVectors: 1247 })
        };
    }

    setupMiddleware() {
        // Security and performance
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));
        this.app.use(compression());

        // CORS configuration
        this.app.use(cors({
            origin: [
                "http://localhost:3000",
                "https://streamlinai.vercel.app",
                process.env.CLIENT_URL
            ].filter(Boolean),
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
        }));

        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));

        // Serve static files in production
        if (process.env.NODE_ENV === 'production') {
            this.app.use(express.static(path.join(__dirname, '../frontend/dist')));
        }

        // Global error handler
        this.app.use((error, req, res, next) => {
            console.error('Global error:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'OK', 
                timestamp: new Date().toISOString(),
                mode: this.demoMode ? 'demo' : 'production',
                redis: this.redisService ? this.redisService.isConnected() : false
            });
        });

        // API routes
        this.app.use('/api/content', contentRoutes(this.contentProcessor, this.vectorService));
        this.app.use('/api/analytics', analyticsRoutes(this.analyticsService));
        this.app.use('/api/stream', streamRoutes(this.redisService));

        // Serve frontend in production
        if (process.env.NODE_ENV === 'production') {
            this.app.get('*', (req, res) => {
                res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
            });
        }

        // 404 handler for API routes
        this.app.use('/api/*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'API endpoint not found'
            });
        });
    }

    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);

            // Send demo data in demo mode
            if (this.demoMode) {
                socket.emit('demo_mode', { message: 'Running in demo mode' });

                // Send periodic demo updates
                const demoInterval = setInterval(() => {
                    socket.emit('content_processed', {
                        contentId: 'demo-' + Date.now(),
                        status: Math.random() > 0.1 ? 'approved' : 'flagged',
                        processingTime: 30 + Math.random() * 30
                    });
                }, 5000);

                socket.on('disconnect', () => {
                    clearInterval(demoInterval);
                });
            }

            socket.on('subscribe_analytics', () => {
                socket.join('analytics');
            });

            socket.on('subscribe_content_stream', () => {
                socket.join('content_stream');
            });

            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
            });
        });
    }

    async startBackgroundServices() {
        if (this.demoMode) return;

        try {
            await this.contentProcessor.startStreamConsumer();
            await this.analyticsService.startMetricsCollection();
            await this.setupPubSubListeners();
            console.log('✅ Background services started');
        } catch (error) {
            console.error('❌ Background services error:', error);
        }
    }

    async setupPubSubListeners() {
        if (this.demoMode || !this.redisService) return;

        const subscriber = this.redisService.createSubscriber();

        await subscriber.subscribe('content:processed', (message) => {
            const data = JSON.parse(message);
            this.io.to('content_stream').emit('content_processed', data);
        });

        await subscriber.subscribe('analytics:update', (message) => {
            const data = JSON.parse(message);
            this.io.to('analytics').emit('analytics_update', data);
        });
    }

    async start() {
        await this.init();

        this.server.listen(this.port, () => {
            console.log(`🚀 StreamlinAI Server running on port ${this.port}`);
            console.log(`📊 Mode: ${this.demoMode ? 'Demo' : 'Production'}`);
            if (this.redisService) {
                console.log(`🔗 Redis: ${this.redisService.isConnected() ? 'Connected' : 'Disconnected'}`);
            }
        });
    }

    async shutdown() {
        console.log('Shutting down server...');
        if (this.redisService) {
            await this.redisService.disconnect();
        }
        this.server.close();
        process.exit(0);
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down gracefully...');
    if (global.server) {
        await global.server.shutdown();
    }
});

process.on('SIGTERM', async () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    if (global.server) {
        await global.server.shutdown();
    }
});

// Start server
const server = new StreamlinAIServer();
global.server = server;
server.start().catch(console.error);

module.exports = StreamlinAIServer;
