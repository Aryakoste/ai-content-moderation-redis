import React, { useState } from 'react';

const ContentForm = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    text: '',
    category: 'general',
    userId: 'demo-user'
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);

    try {
      const response = await onSubmit(formData);
      setResult({
        type: 'success',
        message: `Content submitted successfully! ID: ${response.contentId}`
      });
      setFormData({ ...formData, text: '' });
    } catch (error) {
      setResult({
        type: 'error',
        message: error.message || 'Failed to submit content'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // Demo content examples
  const demoTexts = [
    "This product is absolutely amazing! Best purchase ever!",
    "The service was terrible and completely disappointing.",
    "Average experience, nothing special but not bad either.",
    "Great customer support, they resolved my issue quickly!",
    "I hate this stupid thing, complete waste of money!"
  ];

  const loadDemoText = (text) => {
    setFormData({ ...formData, text });
  };

  return (
    <div className="card">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Content Text</label>
          <textarea
            name="text"
            value={formData.text}
            onChange={handleChange}
            className="form-textarea"
            placeholder="Enter content to analyze for sentiment, toxicity, and categorization..."
            required
            maxLength={5000}
          />
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {formData.text.length}/5000 characters
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              name="category"
              value={formData.category}
              onChange={handleChange}
              className="form-select"
            >
              <option value="general">General</option>
              <option value="review">Review</option>
              <option value="comment">Comment</option>
              <option value="feedback">Feedback</option>
              <option value="support">Support</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">User ID</label>
            <input
              type="text"
              name="userId"
              value={formData.userId}
              onChange={handleChange}
              className="form-input"
              placeholder="Enter user ID"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Quick Examples</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {demoTexts.map((text, index) => (
              <button
                key={index}
                type="button"
                onClick={() => loadDemoText(text)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  background: '#f8f9fa',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Example {index + 1}
              </button>
            ))}
          </div>
        </div>

        {result && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            background: result.type === 'success' 
              ? 'rgba(46, 213, 115, 0.1)' 
              : 'rgba(255, 71, 87, 0.1)',
            color: result.type === 'success' ? '#2ed573' : '#ff4757',
            border: `1px solid ${result.type === 'success' ? '#2ed573' : '#ff4757'}`
          }}>
            {result.message}
          </div>
        )}

        <button
          type="submit"
          className="btn btn--primary"
          disabled={loading || !formData.text.trim()}
        >
          {loading ? (
            <>
              <div className="loading-spinner" style={{ width: '16px', height: '16px' }}></div>
              Processing...
            </>
          ) : (
            'Submit for Analysis'
          )}
        </button>
      </form>
    </div>
  );
};

export default ContentForm;
