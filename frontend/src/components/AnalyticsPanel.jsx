import React, { useState, useEffect } from 'react';

const AnalyticsPanel = ({ data }) => {
  const [activityFeed, setActivityFeed] = useState([]);

  useEffect(() => {
    // Simulate activity feed updates
    const activities = [
      {
        id: 1,
        type: 'content_processed',
        text: 'Content approved: "Great product review"',
        timestamp: Date.now() - 30000,
        icon: '✅'
      },
      {
        id: 2,
        type: 'content_flagged',
        text: 'Content flagged: High toxicity detected',
        timestamp: Date.now() - 60000,
        icon: '⚠️'
      },
      {
        id: 3,
        type: 'system_update',
        text: 'Vector index updated: 1M+ embeddings',
        timestamp: Date.now() - 120000,
        icon: '🧠'
      },
      {
        id: 4,
        type: 'analytics_update',
        text: 'New analytics data available',
        timestamp: Date.now() - 180000,
        icon: '📊'
      },
      {
        id: 5,
        type: 'content_processed',
        text: 'Batch processed: 50 items',
        timestamp: Date.now() - 240000,
        icon: '🔄'
      }
    ];

    setActivityFeed(activities);

    // Add new activities periodically
    const interval = setInterval(() => {
      const newActivity = {
        id: Date.now(),
        type: 'content_processed',
        text: `Content ${Math.random() > 0.8 ? 'flagged' : 'approved'}: "${generateSampleText()}"`,
        timestamp: Date.now(),
        icon: Math.random() > 0.8 ? '⚠️' : '✅'
      };

      setActivityFeed(prev => [newActivity, ...prev.slice(0, 9)]);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const generateSampleText = () => {
    const samples = [
      "Excellent service quality",
      "Needs improvement",
      "Average experience",
      "Outstanding support",
      "Could be better"
    ];
    return samples[Math.floor(Math.random() * samples.length)];
  };

  const formatTime = (timestamp) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ago`;
    }
    return `${seconds}s ago`;
  };

  const getIconClass = (type) => {
    switch (type) {
      case 'content_processed':
        return 'activity-icon--success';
      case 'content_flagged':
        return 'activity-icon--warning';
      default:
        return 'activity-icon--success';
    }
  };

  return (
    <div className="analytics-sidebar">
      <div className="card">
        <h3>Redis 8 Statistics</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Vector Embeddings:</span>
            <strong>1.2M+</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Stream Messages:</span>
            <strong>45.7K</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>JSON Documents:</span>
            <strong>234K</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>TimeSeries Points:</span>
            <strong>2.1M</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Memory Usage:</span>
            <strong>256MB</strong>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Content Categories</h3>
        {data?.content?.categoryDistribution && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {Object.entries(data.content.categoryDistribution).map(([category, percentage]) => (
              <div key={category} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ textTransform: 'capitalize' }}>{category}:</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '60px',
                    height: '6px',
                    background: '#e9ecef',
                    borderRadius: '3px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      width: `${percentage}%`,
                      height: '100%',
                      background: '#ff4757',
                      borderRadius: '3px'
                    }}></div>
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: '500' }}>{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Live Activity Feed</h3>
        <div className="activity-feed">
          {activityFeed.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className={`activity-icon ${getIconClass(activity.type)}`}>
                {activity.icon}
              </div>
              <div className="activity-content">
                <div className="activity-text">{activity.text}</div>
                <div className="activity-time">{formatTime(activity.timestamp)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <h3>AI Model Performance</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Accuracy:</span>
              <strong>{data?.realtime?.currentAccuracy || '94.2'}%</strong>
            </div>
            <div style={{
              width: '100%',
              height: '6px',
              background: '#e9ecef',
              borderRadius: '3px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${data?.realtime?.currentAccuracy || 94.2}%`,
                height: '100%',
                background: '#2ed573',
                borderRadius: '3px'
              }}></div>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Processing Speed:</span>
              <strong>{data?.realtime?.avgProcessingTime || '45'}ms</strong>
            </div>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Vector Search:</span>
              <strong>&lt;10ms</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
