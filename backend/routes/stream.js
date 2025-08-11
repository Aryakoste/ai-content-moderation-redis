const express = require('express');

function createStreamRoutes(redisService) {
    const router = express.Router();

    // Server-Sent Events endpoint for real-time updates
    router.get('/events', (req, res) => {
        // Set headers for SSE
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial connection message
        res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

        // Set up Redis subscriber for real-time updates
        const subscriber = redisService.createSubscriber();

        const subscribeToChannels = async () => {
            try {
                await subscriber.subscribe('content:processed', (message) => {
                    res.write(`data: ${JSON.stringify({ type: 'content_processed', data: JSON.parse(message) })}\n\n`);
                });

                await subscriber.subscribe('analytics:update', (message) => {
                    res.write(`data: ${JSON.stringify({ type: 'analytics_update', data: JSON.parse(message) })}\n\n`);
                });

                console.log('SSE client subscribed to real-time updates');
            } catch (error) {
                console.error('SSE subscription error:', error);
            }
        };

        subscribeToChannels();

        // Send periodic heartbeat
        const heartbeat = setInterval(() => {
            res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: Date.now() })}\n\n`);
        }, 30000);

        // Clean up on client disconnect
        req.on('close', async () => {
            clearInterval(heartbeat);
            try {
                await subscriber.unsubscribe();
                await subscriber.disconnect();
            } catch (error) {
                console.error('SSE cleanup error:', error);
            }
            console.log('SSE client disconnected');
        });
    });

    // Get stream messages
    router.get('/:streamKey/messages', async (req, res) => {
        try {
            const { streamKey } = req.params;
            const { count = 10, startId = '0' } = req.query;

            const validStreams = ['content:stream', 'feedback:stream'];
            if (!validStreams.includes(streamKey)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid stream key',
                    validStreams
                });
            }

            const messages = await redisService.readFromStream(streamKey, parseInt(count), startId);

            res.json({
                success: true,
                data: {
                    stream: streamKey,
                    messages: messages.map(msg => ({
                        id: msg.id,
                        timestamp: msg.id.split('-')[0],
                        data: msg.message
                    }))
                }
            });

        } catch (error) {
            console.error('Stream messages error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get stream messages'
            });
        }
    });

    // Get stream info
    router.get('/:streamKey/info', async (req, res) => {
        try {
            const { streamKey } = req.params;

            // Get stream length and other info
            // Note: In a real implementation, you'd use XINFO STREAM command
            const info = {
                name: streamKey,
                length: 1247, // Simulated
                firstEntry: '1723389600000-0',
                lastEntry: '1723389900000-0',
                consumerGroups: streamKey === 'content:stream' ? 1 : 0
            };

            res.json({
                success: true,
                data: info
            });

        } catch (error) {
            console.error('Stream info error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get stream info'
            });
        }
    });

    // Add message to stream (for testing)
    router.post('/:streamKey/add', async (req, res) => {
        try {
            const { streamKey } = req.params;
            const { data } = req.body;

            if (!data || typeof data !== 'object') {
                return res.status(400).json({
                    success: false,
                    error: 'Data object is required'
                });
            }

            const messageId = await redisService.addToStream(streamKey, data);

            res.status(201).json({
                success: true,
                data: {
                    streamKey,
                    messageId,
                    timestamp: Date.now()
                }
            });

        } catch (error) {
            console.error('Add to stream error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to add message to stream'
            });
        }
    });

    // Get recent activity feed
    router.get('/activity/recent', async (req, res) => {
        try {
            const { limit = 20 } = req.query;

            // Get recent messages from content stream
            const recentContent = await redisService.readFromStream('content:stream', parseInt(limit));

            const activities = recentContent.map(msg => ({
                id: msg.id,
                type: 'content_submission',
                timestamp: parseInt(msg.id.split('-')[0]),
                data: {
                    contentId: msg.message.contentId,
                    category: msg.message.category,
                    userId: msg.message.userId
                }
            }));

            res.json({
                success: true,
                data: activities.sort((a, b) => b.timestamp - a.timestamp)
            });

        } catch (error) {
            console.error('Recent activity error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get recent activity'
            });
        }
    });

    return router;
}

module.exports = createStreamRoutes;
