const express = require('express');

function createAnalyticsRoutes(analyticsService) {
    const router = express.Router();

    // Get real-time dashboard metrics
    router.get('/dashboard', async (req, res) => {
        try {
            const dashboardData = await analyticsService.getDashboardData();

            res.json({
                success: true,
                data: dashboardData
            });

        } catch (error) {
            console.error('Dashboard data error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get dashboard data'
            });
        }
    });

    // Get real-time metrics
    router.get('/realtime', async (req, res) => {
        try {
            const metrics = await analyticsService.getRealtimeMetrics();

            res.json({
                success: true,
                data: metrics
            });

        } catch (error) {
            console.error('Realtime metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get realtime metrics'
            });
        }
    });

    // Get time series data
    router.get('/timeseries/:metric', async (req, res) => {
        try {
            const { metric } = req.params;
            const { timeRange = '1h', aggregation = 'avg' } = req.query;

            const validMetrics = [
                'content:processed',
                'content:flagged', 
                'content:approved',
                'processing:time',
                'accuracy:rate',
                'system:cpu',
                'system:memory',
                'system:throughput'
            ];

            if (!validMetrics.includes(metric)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid metric',
                    validMetrics
                });
            }

            const data = await analyticsService.getTimeSeriesData(metric, timeRange, aggregation);

            res.json({
                success: true,
                data
            });

        } catch (error) {
            console.error('Time series data error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get time series data'
            });
        }
    });

    // Get content analytics
    router.get('/content', async (req, res) => {
        try {
            const analytics = await analyticsService.getContentAnalytics();

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            console.error('Content analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get content analytics'
            });
        }
    });

    // Get system analytics
    router.get('/system', async (req, res) => {
        try {
            const analytics = await analyticsService.getSystemAnalytics();

            res.json({
                success: true,
                data: analytics
            });

        } catch (error) {
            console.error('System analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get system analytics'
            });
        }
    });

    // Get analytics for specific time period
    router.get('/period/:period', async (req, res) => {
        try {
            const { period } = req.params;
            const validPeriods = ['5m', '1h', '24h', '7d', '30d'];

            if (!validPeriods.includes(period)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid period',
                    validPeriods
                });
            }

            // Get multiple metrics for the period
            const metrics = [
                'content:processed',
                'content:flagged',
                'content:approved'
            ];

            const data = {};
            for (const metric of metrics) {
                data[metric] = await analyticsService.getTimeSeriesData(metric, period, 'sum');
            }

            res.json({
                success: true,
                data,
                period
            });

        } catch (error) {
            console.error('Period analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get period analytics'
            });
        }
    });

    // Get performance metrics
    router.get('/performance', async (req, res) => {
        try {
            const { timeRange = '1h' } = req.query;

            const performanceData = await Promise.all([
                analyticsService.getTimeSeriesData('processing:time', timeRange, 'avg'),
                analyticsService.getTimeSeriesData('accuracy:rate', timeRange, 'avg'),
                analyticsService.getTimeSeriesData('system:cpu', timeRange, 'avg'),
                analyticsService.getTimeSeriesData('system:memory', timeRange, 'avg')
            ]);

            const [processingTime, accuracy, cpu, memory] = performanceData;

            res.json({
                success: true,
                data: {
                    processingTime,
                    accuracy,
                    cpu,
                    memory
                },
                timeRange
            });

        } catch (error) {
            console.error('Performance metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get performance metrics'
            });
        }
    });

    // Export analytics data
    router.get('/export/:format', async (req, res) => {
        try {
            const { format } = req.params;
            const { timeRange = '24h' } = req.query;

            if (!['json', 'csv'].includes(format)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid format. Supported: json, csv'
                });
            }

            const dashboardData = await analyticsService.getDashboardData();

            if (format === 'csv') {
                // Convert to CSV format
                let csv = 'timestamp,metric,value\n';

                // Add realtime metrics
                const { realtime } = dashboardData;
                Object.entries(realtime).forEach(([key, value]) => {
                    if (typeof value === 'number') {
                        csv += `${realtime.timestamp},${key},${value}\n`;
                    }
                });

                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=analytics_${timeRange}.csv`);
                res.send(csv);
            } else {
                res.setHeader('Content-Type', 'application/json');
                res.setHeader('Content-Disposition', `attachment; filename=analytics_${timeRange}.json`);
                res.json(dashboardData);
            }

        } catch (error) {
            console.error('Export analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to export analytics data'
            });
        }
    });

    return router;
}

module.exports = createAnalyticsRoutes;
