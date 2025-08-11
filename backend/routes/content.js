const express = require('express');
const Joi = require('joi');
const rateLimit = require('rate-limiter-flexible');

// Rate limiting for content submission
const contentSubmissionLimiter = new rateLimit.RateLimiterMemory({
    keyGenerator: (req, res) => req.ip,
    points: 10, // Number of requests
    duration: 60, // Per 60 seconds
});

// Content submission validation schema
const contentSchema = Joi.object({
    text: Joi.string().min(1).max(5000).required(),
    category: Joi.string().valid('review', 'comment', 'feedback', 'support', 'general').optional(),
    userId: Joi.string().optional(),
    source: Joi.string().optional()
});

// Feedback submission validation schema
const feedbackSchema = Joi.object({
    feedback: Joi.string().valid('correct', 'incorrect', 'spam', 'not_spam').required(),
    comment: Joi.string().max(500).optional()
});

function createContentRoutes(contentProcessor, vectorService) {
    const router = express.Router();

    // Submit new content for moderation
    router.post('/submit', async (req, res) => {
        try {
            // Rate limiting
            await contentSubmissionLimiter.consume(req.ip);

            // Validate request
            const { error, value } = contentSchema.validate(req.body);
            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details
                });
            }

            // Submit content for processing
            const result = await contentProcessor.submitContent(value);

            res.status(201).json({
                success: true,
                data: result,
                message: 'Content submitted successfully'
            });

        } catch (error) {
            if (error.remainingPoints !== undefined) {
                return res.status(429).json({
                    success: false,
                    error: 'Rate limit exceeded',
                    retryAfter: error.msBeforeNext
                });
            }

            console.error('Content submission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to submit content'
            });
        }
    });

    // Get content by ID
    router.get('/:contentId', async (req, res) => {
        try {
            const { contentId } = req.params;

            if (!contentId) {
                return res.status(400).json({
                    success: false,
                    error: 'Content ID is required'
                });
            }

            const content = await contentProcessor.getContentById(contentId);

            if (!content) {
                return res.status(404).json({
                    success: false,
                    error: 'Content not found'
                });
            }

            res.json({
                success: true,
                data: content
            });

        } catch (error) {
            console.error('Get content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve content'
            });
        }
    });

    // Search content using semantic search
    router.post('/search', async (req, res) => {
        try {
            const { query, filters = {}, limit = 10 } = req.body;

            if (!query) {
                return res.status(400).json({
                    success: false,
                    error: 'Search query is required'
                });
            }

            const results = await vectorService.semanticSearch(query, filters, limit);

            res.json({
                success: true,
                data: results
            });

        } catch (error) {
            console.error('Content search error:', error);
            res.status(500).json({
                success: false,
                error: 'Search failed'
            });
        }
    });

    // Find similar content
    router.post('/similar', async (req, res) => {
        try {
            const { text, limit = 5, threshold = 0.7 } = req.body;

            if (!text) {
                return res.status(400).json({
                    success: false,
                    error: 'Text is required'
                });
            }

            const similarContent = await vectorService.findSimilarContent(text, limit, threshold);

            res.json({
                success: true,
                data: similarContent
            });

        } catch (error) {
            console.error('Similar content error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to find similar content'
            });
        }
    });

    // Submit feedback for content
    router.post('/:contentId/feedback', async (req, res) => {
        try {
            const { contentId } = req.params;
            const { error, value } = feedbackSchema.validate(req.body);

            if (error) {
                return res.status(400).json({
                    success: false,
                    error: 'Validation failed',
                    details: error.details
                });
            }

            const feedback = await contentProcessor.submitFeedback(contentId, value.feedback);

            res.status(201).json({
                success: true,
                data: feedback,
                message: 'Feedback submitted successfully'
            });

        } catch (error) {
            console.error('Feedback submission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to submit feedback'
            });
        }
    });

    // Get processing statistics
    router.get('/stats/processing', async (req, res) => {
        try {
            const stats = await contentProcessor.getProcessingStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Processing stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get processing statistics'
            });
        }
    });

    // Get vector statistics
    router.get('/stats/vectors', async (req, res) => {
        try {
            const stats = await vectorService.getVectorStats();

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            console.error('Vector stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get vector statistics'
            });
        }
    });

    // Get content clusters
    router.get('/analysis/clusters', async (req, res) => {
        try {
            const clusters = await vectorService.getContentClusters();

            res.json({
                success: true,
                data: clusters
            });

        } catch (error) {
            console.error('Content clusters error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content clusters'
            });
        }
    });

    // Bulk content operations
    router.post('/bulk/submit', async (req, res) => {
        try {
            const { contents } = req.body;

            if (!Array.isArray(contents) || contents.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Contents array is required'
                });
            }

            if (contents.length > 50) {
                return res.status(400).json({
                    success: false,
                    error: 'Maximum 50 contents allowed per bulk request'
                });
            }

            const results = [];
            for (const content of contents) {
                try {
                    const { error } = contentSchema.validate(content);
                    if (error) {
                        results.push({ error: error.details, content });
                        continue;
                    }

                    const result = await contentProcessor.submitContent(content);
                    results.push({ success: true, ...result });
                } catch (err) {
                    results.push({ error: err.message, content });
                }
            }

            res.json({
                success: true,
                data: results,
                message: `Processed ${results.length} contents`
            });

        } catch (error) {
            console.error('Bulk submit error:', error);
            res.status(500).json({
                success: false,
                error: 'Bulk submission failed'
            });
        }
    });

    return router;
}

module.exports = createContentRoutes;
