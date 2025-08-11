import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import Dashboard from './components/Dashboard';
import ContentForm from './components/ContentForm';
import AnalyticsPanel from './components/AnalyticsPanel';
import { API_BASE_URL, SOCKET_URL } from './config';

function App() {
  const [socket, setSocket] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      setConnected(true);
      newSocket.emit('subscribe_analytics');
      newSocket.emit('subscribe_content_stream');
    });

    newSocket.on('disconnect', () => {
      console.log('❌ Disconnected from server');
      setConnected(false);
    });

    newSocket.on('analytics_update', (data) => {
      console.log('📊 Analytics update:', data);
    });

    newSocket.on('content_processed', (data) => {
      console.log('🔄 Content processed:', data);
    });

    newSocket.on('demo_mode', (data) => {
      console.log('🚀 Demo mode active:', data.message);
    });

    setSocket(newSocket);

    // Fetch initial dashboard data
    fetchDashboardData();

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analytics/dashboard`);
      const result = await response.json();

      if (result.success) {
        setDashboardData(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Set demo data as fallback
      setDashboardData({
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
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const submitContent = async (contentData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/content/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(contentData),
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Content submitted:', result.data);
        return result.data;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('❌ Failed to submit content:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading StreamlinAI...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div className="logo">
              <h1>StreamlinAI</h1>
              <span className="tagline">Redis 8 Powered Content Moderation</span>
            </div>
            <div className="header-actions">
              <div className={`status ${connected ? 'status--success' : 'status--error'}`}>
                <span className="status-dot"></span>
                {connected ? 'Live' : 'Disconnected'}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <div className="app-grid">
            <div className="main-content">
              <Dashboard 
                data={dashboardData} 
                connected={connected}
              />

              <div className="content-section">
                <h2>Submit Content for Analysis</h2>
                <ContentForm onSubmit={submitContent} />
              </div>
            </div>

            <aside className="sidebar">
              <AnalyticsPanel data={dashboardData} />
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
