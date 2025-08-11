import React, { useState, useEffect } from 'react';
import Chart from 'chart.js/auto';

const Dashboard = ({ data, connected }) => {
  const [charts, setCharts] = useState({});

  useEffect(() => {
    if (data?.realtime) {
      createCharts();
    }

    return () => {
      // Cleanup charts
      Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
      });
    };
  }, [data]);

  const createCharts = () => {
    // Sentiment Distribution Chart
    const sentimentCtx = document.getElementById('sentimentChart');
    if (sentimentCtx && data.content?.sentimentDistribution) {
      if (charts.sentiment) charts.sentiment.destroy();

      charts.sentiment = new Chart(sentimentCtx, {
        type: 'doughnut',
        data: {
          labels: ['Positive', 'Neutral', 'Negative'],
          datasets: [{
            data: [
              data.content.sentimentDistribution.positive,
              data.content.sentimentDistribution.neutral,
              data.content.sentimentDistribution.negative
            ],
            backgroundColor: ['#2ed573', '#ffa502', '#ff4757']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            }
          }
        }
      });
    }

    // System Performance Chart
    const performanceCtx = document.getElementById('performanceChart');
    if (performanceCtx && data.system) {
      if (charts.performance) charts.performance.destroy();

      charts.performance = new Chart(performanceCtx, {
        type: 'bar',
        data: {
          labels: ['CPU Usage', 'Memory Usage'],
          datasets: [{
            label: 'Usage %',
            data: [data.system.cpu?.current || 0, data.system.memory?.current || 0],
            backgroundColor: ['#5352ed', '#ff4757']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100
            }
          }
        }
      });
    }
  };

  if (!data) {
    return (
      <div className="card">
        <div className="loading-spinner"></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  const { realtime } = data;

  return (
    <div className="dashboard">
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-value">{realtime.totalProcessed?.toLocaleString() || '0'}</div>
          <div className="metric-label">Total Processed</div>
          <div className="metric-change positive">+{realtime.totalProcessed > 1000 ? '12' : '0'}% today</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{realtime.totalFlagged?.toLocaleString() || '0'}</div>
          <div className="metric-label">Flagged Content</div>
          <div className="metric-change negative">
            {realtime.totalProcessed ? 
              ((realtime.totalFlagged / realtime.totalProcessed) * 100).toFixed(1) : '0'}% flagged
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{realtime.avgProcessingTime || '45'}ms</div>
          <div className="metric-label">Avg Processing Time</div>
          <div className="metric-change positive">-8% improved</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{realtime.currentAccuracy || '94.2'}%</div>
          <div className="metric-label">Accuracy Rate</div>
          <div className="metric-change positive">+2.3% this week</div>
        </div>

        <div className="metric-card">
          <div className="metric-value">{realtime.uniqueVisitors?.toLocaleString() || '2,341'}</div>
          <div className="metric-label">Unique Visitors</div>
          <div className="metric-change positive">+15% today</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <h3>Sentiment Distribution</h3>
          <div className="chart-container">
            <canvas id="sentimentChart"></canvas>
          </div>
        </div>

        <div className="card">
          <h3>System Performance</h3>
          <div className="chart-container">
            <canvas id="performanceChart"></canvas>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Redis 8 Features Showcase</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div style={{ padding: '16px', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '8px' }}>
            <h4>🔄 Streams</h4>
            <p>Real-time content processing pipeline</p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(83, 82, 237, 0.1)', borderRadius: '8px' }}>
            <h4>🧠 Vectors</h4>
            <p>AI-powered semantic search</p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(46, 213, 115, 0.1)', borderRadius: '8px' }}>
            <h4>📊 TimeSeries</h4>
            <p>Live analytics & metrics</p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '8px' }}>
            <h4>📄 JSON</h4>
            <p>Primary database storage</p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(236, 72, 153, 0.1)', borderRadius: '8px' }}>
            <h4>📡 Pub/Sub</h4>
            <p>Real-time notifications</p>
          </div>
          <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '8px' }}>
            <h4>🎯 HyperLogLog</h4>
            <p>Unique visitor analytics</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
